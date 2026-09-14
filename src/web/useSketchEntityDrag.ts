import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSketchTranslationCandidate,
  isZeroSketchDelta,
  type CadSketchDelta,
} from '../application/SketchEntityTransform';
import type { CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import type { CadPartDocument, CadPoint2, CadSketch } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';

export interface SketchEntityDragState {
  entityId: CadSketchEntityId;
  start: CadPoint2;
  current: CadPoint2;
  delta: CadSketchDelta;
}

export interface UseSketchEntityDragOptions {
  part: Readonly<CadPartDocument>;
  sketch: Readonly<CadSketch>;
  selectedEntityId: CadSketchEntityId | null;
  enabled: boolean;
  previewCandidate(candidate: Readonly<CadPartDocument>): Promise<Readonly<CadSketchSolveSnapshot>>;
  restorePersistedPreview(): Promise<Readonly<CadSketchSolveSnapshot>>;
  commit(entityId: CadSketchEntityId, delta: CadSketchDelta): Promise<boolean>;
  onRejected(message: string): void;
}

/**
 * Transient M3.6B rigid-drag owner. Pointer movement only builds solver
 * candidates. Exactly one typed application command may be committed on end.
 */
export function useSketchEntityDrag(options: UseSketchEntityDragOptions) {
  const {
    part,
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

  const candidateFor = useCallback((entityId: CadSketchEntityId, delta: CadSketchDelta) => (
    buildSketchTranslationCandidate(part, sketch.id, entityId, delta)
  ), [part, sketch.id]);

  const cancel = useCallback(() => {
    if (!stateRef.current) return;
    writeState(null);
    void restorePersistedPreview();
  }, [restorePersistedPreview, writeState]);

  const start = useCallback((entityId: CadSketchEntityId, point: CadPoint2) => {
    if (!enabled || selectedEntityId !== entityId) return false;
    const fixed = part.constraints.some((constraint) => (
      constraint.type === 'fixed'
      && sketch.constraintIds.includes(constraint.id)
      && constraint.entityIds[0] === entityId
    ));
    if (fixed) {
      onRejected('Зафиксированный элемент нельзя перемещать');
      return false;
    }
    writeState({ entityId, start: point, current: point, delta: [0, 0] });
    return true;
  }, [enabled, onRejected, part.constraints, selectedEntityId, sketch.constraintIds, writeState]);

  const move = useCallback((point: CadPoint2) => {
    const current = stateRef.current;
    if (!current) return;
    const delta: CadSketchDelta = [point[0] - current.start[0], point[1] - current.start[1]];
    writeState({ ...current, current: point, delta });
    void previewCandidate(candidateFor(current.entityId, delta));
  }, [candidateFor, previewCandidate, writeState]);

  const end = useCallback(async (point: CadPoint2) => {
    const current = stateRef.current;
    if (!current) return false;
    const delta: CadSketchDelta = [point[0] - current.start[0], point[1] - current.start[1]];
    if (isZeroSketchDelta(delta)) {
      cancel();
      return false;
    }

    const solved = await previewCandidate(candidateFor(current.entityId, delta));
    if (solved.status !== 'solved') {
      writeState(null);
      await restorePersistedPreview();
      const diagnostic = solved.diagnostics.find((item) => item.severity === 'error')?.message;
      onRejected(diagnostic ?? 'Перемещение нарушает ограничения эскиза');
      return false;
    }

    const committed = await commit(current.entityId, delta);
    writeState(null);
    if (!committed) await restorePersistedPreview();
    return committed;
  }, [candidateFor, cancel, commit, onRejected, previewCandidate, restorePersistedPreview, writeState]);

  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    if (!enabled || selectedEntityId !== current.entityId) cancel();
  }, [cancel, enabled, selectedEntityId, sketch.id]);

  return {
    state,
    draggingEntityId: state?.entityId ?? null,
    start,
    move,
    end,
    cancel,
  };
}
