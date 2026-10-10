import type { CadSketchSolverAdapter } from '../contracts/sketchSolver';
import { BrowserSketchSolverAdapter } from './BrowserSketchSolverAdapter';

export const sharedBrowserSketchSolver = new BrowserSketchSolverAdapter();

/** Non-owning client for UI sessions; the browser coordinator lives for the app bundle lifetime. */
export function createSharedBrowserSketchSolverClient(): CadSketchSolverAdapter {
  return {
    init: () => sharedBrowserSketchSolver.init(),
    solve: (document, sketchId) => sharedBrowserSketchSolver.solve(document, sketchId),
    dispose: () => {},
  };
}
