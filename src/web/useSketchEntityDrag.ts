import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isZeroSketchTranslation,
  translateSketchEntitiesCandidate,
  type CadSketchTranslationDelta,
} from '../application/SketchEntityTransform';
import type { CadPoint2, CadSketch, CadSketchEntity } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';
import type { CadSketchSolveSnapshot } from '../application/SketchSolveSession';

export interface SketchEntityDragState {
  entityId: CadSketchEntityId;
  start: CadPoint2;
  current: CadPoint2;
  delta: CadSketchTranslationDelta;
}

export interface UseSketchEntityDragOptions {
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  enabled: boolean;
  previewCandidate(entities: readonly CadSketchEntity[]): Promise<Readonly<CadSketchSolveSnapshot>>;
  restorePersistedPreview(): Promise<Readonly<CadSketchSolveSnapshot>>;
  commit(entityId: CadSketchEntityId, delta: CadSketchTranslationDelta): Promise<boolean>;
  onRejected(message: string): void;
}

/**
 * Transient M3.6B rigid-drag owner.
 *
 * Pointer movement creates candidate DTOs in memory and routes them through
 * PlaneGCS. CadDocument/history are untouched until one successful pointer-up
 * commit. Stale solve completions are rejected by SketchSolveSession.
 */
export function useSketchEntityDrag(options: UseSketchEntityDragOptions) {
  const {
    sketch,
    selectedEntityId,
    enabled,
    previewCandidate,
    restorePersistedPreview,
    commit,
    onRejected,
  } = options;
  const [state, setState] = useState<SketchEntityDragState | null>(null);
  const stateRef = useRef<SketchEntityDragState | null>(null);

  const writeState = useCallback((next: SketchEntityDragState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const candidateFor = useCallback((entityId: CadSketchEntityId, delta: CadSketchTranslationDelta) => {
    if (!sketch) return null;
    return translateSketchEntitiesCandidate(sketch.entities, entityId, delta);
  }, [sketch]);

  const start = useCallback((entityId: CadSketchEntityId, point: CadPoint2) => {
    if (!enabled || !sketch || selectedEntityId !== entityId) return false;
    const next: SketchEntityDragState = {
      entityId,
      start: point,
      current: point,
      delta: [0, 0],
    };
    writeState(next);
    return true;
  }, [enabled, selectedEntityId, sketch, writeState]);

  const move = useCallback((point: CadPoint2) => {
    const current = stateRef.current;
    if (!current || !sketch) return;
    const delta: CadSketchTranslationDelta = [
      point[0] - current.start[0],
      point[1] - current.start[1],
    ];
    const next: SketchEntityDragState = { ...current, current: point, delta };
    writeState(next);
    const candidate = candidateFor(current.entityId, delta);
    if (candidate) void previewCandidate(candidate);
  }, [candidateFor, previewCandidate, sketch, writeState]);

  const cancel = useCallback(() => {
    if (!stateRef.current) return;
    writeState(null);
    void restorePersistedPreview();
  }, [restorePersistedPreview, writeState]);

  const end = useCallback(async (point: CadPoint2) => {
    const current = stateRef.current;
    if (!current || !sketch) return false;
    const delta: CadSketchTranslationDelta = [
      point[0] - current.start[0],
      point[1] - current.start[1],
    ];
    if (isZeroSketchTranslation(delta)) {
      cancel();
      return false;
    }

    const candidate = candidateFor(current.entityId, delta);
    if (!candidate) {
      cancel();
      return false;
    }

    const solved = await previewCandidate(candidate);
    if (solved.status !== 'solved') {
      writeState(null);
      await restorePersistedPreview();
      const diagnostic = solved.diagnostics.find((item) => item.severity === 'error')?.message;
      onRejected(diagnostic ?? 'Перемещение нарушает ограничения эскиза');
      return false;
    }

    const committed = await commit(current.entityId, delta);
    writeState(null);
    if (!committed) {
      await restorePersistedPreview();
      return false;
    }
    return true;
  }, [candidateFor, cancel, commit, onRejected, previewCandidate, restorePersistedPreview, sketch, writeState]);

  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    if (!enabled || !sketch || selectedEntityId !== current.entityId) cancel();
  }, [cancel, enabled, selectedEntityId, sketch?.id]);

  return {
    state,
    draggingEntityId: state?.entityId ?? null,
    start,
    move,
    end,
    cancel,
  };
}
