import { useCallback, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    setState((current) => reconcileSketchSession(current, part));
  }, [part]);

  const activeSketch = useMemo(
    () => resolveActiveSketch(part, state.activeSketchId),
    [part, state.activeSketchId],
  );

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    setState((current) => activateSketch(current, sketchId));
  }, []);

  const clearActiveSketch = useCallback(() => {
    setState((current) => clearSketchSession(current));
  }, []);

  return {
    activeSketchId: state.activeSketchId,
    activeSketch,
    enterSketch,
    clearActiveSketch,
  };
}
