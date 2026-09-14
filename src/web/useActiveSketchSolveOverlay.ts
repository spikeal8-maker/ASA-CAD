import { useCallback, useEffect, useMemo, useState } from 'react';
import { SketchSolveSession, type CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import { BrowserSketchSolverAdapter } from '../browser/BrowserSketchSolverAdapter';
import type { CadDocument, CadPartDocument, CadSketch } from '../contracts/document';
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
  previewCandidate(candidate: Readonly<CadPartDocument>): Promise<Readonly<CadSketchSolveSnapshot>>;
  restorePersistedPreview(): Promise<Readonly<CadSketchSolveSnapshot>>;
}

/**
 * M3 editor bridge between transient Sketch editing, solve orchestration and
 * the read-only Sketch overlay. Candidate documents are editor-only and never
 * enter CadApplication history; durable commits still use typed commands.
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

  const restorePersistedPreview = useCallback(async (): Promise<Readonly<CadSketchSolveSnapshot>> => {
    if (!active || document.kind !== 'part' || !sketch || sketch.entities.length === 0) {
      const current = session.getSnapshot();
      if (current.status !== 'idle' || current.sketchId !== null) session.clear();
      return session.getSnapshot();
    }
    return session.solve(document, sketch.id);
  }, [active, document, session, sketch]);

  useEffect(() => {
    void restorePersistedPreview();
  }, [restorePersistedPreview, revisionToken, sketch?.id, sketch?.entities.length]);

  const previewCandidate = useCallback(async (
    candidate: Readonly<CadPartDocument>,
  ): Promise<Readonly<CadSketchSolveSnapshot>> => {
    if (!active || !sketch) return session.getSnapshot();
    return session.solve(candidate, sketch.id);
  }, [active, session, sketch]);

  return {
    overlay: active ? buildSketchOverlayModel(sketch, snapshot) : null,
    snapshot,
    previewCandidate,
    restorePersistedPreview,
  };
}
