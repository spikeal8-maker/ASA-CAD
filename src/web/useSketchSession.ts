import { useCallback, useEffect, useState } from 'react';
import type { CadPartDocument } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import {
  activateSketch,
  clearSketchEntitySelection,
  clearSketchSession,
  createSketchSessionState,
  reconcileSketchSession,
  resolveActiveSketch,
  selectSketchEntity,
} from './SketchSession';

export function useSketchSession(part: Readonly<CadPartDocument> | null) {
  const [state, setState] = useState(createSketchSessionState);

  // CadApplication mutates the active Part object in-place for normal commands.
  // Reconcile after every editor render so undo/open/delete cannot leave stale
  // transient Sketch/entity IDs behind.
  useEffect(() => {
    setState((current) => reconcileSketchSession(current, part));
  });

  const activeSketch = resolveActiveSketch(part, state.activeSketchId);
  const effectiveActiveSketchId = activeSketch ? state.activeSketchId : null;
  const selectedEntityId = activeSketch
    && state.selectedEntityId
    && activeSketch.entities.some((entity) => entity.id === state.selectedEntityId)
      ? state.selectedEntityId
      : null;

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    setState((current) => activateSketch(current, sketchId));
  }, []);

  const clearActiveSketch = useCallback(() => {
    setState((current) => clearSketchSession(current));
  }, []);

  const selectEntity = useCallback((sketchId: CadSketchId, entityId: CadSketchEntityId) => {
    setState((current) => selectSketchEntity(current, sketchId, entityId));
  }, []);

  const clearEntitySelection = useCallback(() => {
    setState((current) => clearSketchEntitySelection(current));
  }, []);

  return {
    activeSketchId: effectiveActiveSketchId,
    activeSketch,
    selectedEntityId,
    enterSketch,
    clearActiveSketch,
    selectEntity,
    clearEntitySelection,
  };
}
