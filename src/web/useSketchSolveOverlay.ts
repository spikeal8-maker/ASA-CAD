import { useEffect, useMemo, useState } from 'react';
import { SketchSolveSession, type CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import { BrowserSketchSolverAdapter } from '../browser/BrowserSketchSolverAdapter';
import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { buildSketchOverlayModel } from './viewport/SketchOverlayModel';

export interface UseSketchSolveOverlayOptions {
  document: Readonly<CadDocument>;
  activeSketchId: CadSketchId | null;
  activeSketch: Readonly<CadSketch> | null;
  active: boolean;
  /** Editor mutation token; required because CadApplication may mutate Part in place. */
  revisionToken: number;
}

/**
 * M3 browser orchestration from explicit active Sketch to transient solver
 * preview. Persisted document changes remain exclusively owned by CadApplication.
 */
export function useSketchSolveOverlay(options: UseSketchSolveOverlayOptions) {
  const { document, activeSketchId, activeSketch, active, revisionToken } = options;
  const session = useMemo(
    () => new SketchSolveSession(new BrowserSketchSolverAdapter()),
    [],
  );
  const [snapshot, setSnapshot] = useState<CadSketchSolveSnapshot>(() => session.getSnapshot());

  useEffect(() => {
    const unsubscribe = session.subscribe((next) => setSnapshot(structuredClone(next)));
    return () => {
      unsubscribe();
      session.dispose();
    };
  }, [session]);

  useEffect(() => {
    if (
      !active
      || document.kind !== 'part'
      || !activeSketchId
      || !activeSketch
      || activeSketch.id !== activeSketchId
      || activeSketch.entities.length === 0
    ) {
      if (session.getSnapshot().status !== 'idle' || session.getSnapshot().sketchId !== null) {
        session.clear();
      }
      return;
    }

    void session.solve(document, activeSketchId);
  }, [active, activeSketch, activeSketchId, document, revisionToken, session]);

  const sketchOverlay = active && activeSketch && activeSketch.entities.length > 0
    ? buildSketchOverlayModel(activeSketch, snapshot)
    : null;

  return {
    solveSnapshot: snapshot,
    sketchOverlay,
  };
}
