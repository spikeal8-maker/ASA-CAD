import { useCallback, useEffect, useState } from 'react';
import type { CadPartDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import {
  activateSketch,
  clearSketchSession,
  createSketchSessionState,
  reconcileSketchSession,
  resolveActiveSketch,
} from './SketchSession';

export function useSketchSession(part: Readonly<CadPartDocument> | null) {
  const [state, setState] = useState(createSketchSessionState);

  // CadApplication currently mutates the active Part object in-place for normal
  // commands. Reconcile after every editor render rather than relying on object
  // identity so a future Sketch-delete command cannot leave a stale active ID.
  useEffect(() => {
    setState((current) => reconcileSketchSession(current, part));
  });

  const activeSketch = resolveActiveSketch(part, state.activeSketchId);
  const effectiveActiveSketchId = activeSketch ? state.activeSketchId : null;

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    setState((current) => activateSketch(current, sketchId));
  }, []);

  const clearActiveSketch = useCallback(() => {
    setState((current) => clearSketchSession(current));
  }, []);

  return {
    activeSketchId: effectiveActiveSketchId,
    activeSketch,
    enterSketch,
    clearActiveSketch,
  };
}
