import { useEffect, useMemo, useState } from 'react';
import { SketchSolveSession, type CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import { BrowserSketchSolverAdapter } from '../browser/BrowserSketchSolverAdapter';
import type { CadDocument, CadSketch } from '../contracts/document';
import {
  buildSketchOverlayModel,
  type SketchOverlayModel,
} from './viewport/SketchOverlayModel';

export interface ActiveSketchSolveOverlayOptions {
  document: Readonly<CadDocument>;
  sketch: Readonly<CadSketch> | null;
  /** True only while the editor is actively presenting the Sketch workspace. */
  active: boolean;
  /** CadApplication revision signal; increments after document/history changes. */
  revisionToken: number;
}

export interface ActiveSketchSolveOverlayResult {
  overlay: SketchOverlayModel | null;
  snapshot: Readonly<CadSketchSolveSnapshot>;
}

/**
 * M3 editor bridge between transient Sketch selection, solve orchestration and
 * the read-only Sketch overlay. It owns no persisted geometry and never writes
 * CadDocument directly; commits continue through CadApplication commands.
 */
export function useActiveSketchSolveOverlay(
  options: ActiveSketchSolveOverlayOptions,
): ActiveSketchSolveOverlayResult {
  const { document, sketch, active, revisionToken } = options;
  const solver = useMemo(() => new BrowserSketchSolverAdapter(), []);
  const session = useMemo(() => new SketchSolveSession(solver), [solver]);
  const [snapshot, setSnapshot] = useState<Readonly<CadSketchSolveSnapshot>>(
    () => session.getSnapshot(),
  );

  useEffect(() => session.subscribe((next) => setSnapshot({ ...next })), [session]);

  useEffect(() => () => session.dispose(), [session]);

  useEffect(() => {
    if (!active || document.kind !== 'part' || !sketch) {
      const current = session.getSnapshot();
      if (current.status !== 'idle' || current.sketchId !== null) session.clear();
      return;
    }

    // An empty Sketch needs no solver yet; keep its persisted empty overlay
    // visible without paying the PlaneGCS/WASM startup cost.
    if (sketch.entities.length === 0) {
      const current = session.getSnapshot();
      if (current.status !== 'idle' || current.sketchId !== null) session.clear();
      return;
    }

    void session.solve(document, sketch.id);
  }, [active, document, revisionToken, session, sketch?.id, sketch?.entities.length]);

  return {
    overlay: active ? buildSketchOverlayModel(sketch, snapshot) : null,
    snapshot,
  };
}
