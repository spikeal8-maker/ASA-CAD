import type { CadDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type { CadSketchSolveResult, CadSketchSolverAdapter } from '../contracts/sketchSolver';

/**
 * Lazy browser boundary for PlaneGCS. Product UI depends only on the ASA solver
 * contract and never imports vendor/solver runtime modules directly.
 */
export class BrowserSketchSolverAdapter implements CadSketchSolverAdapter {
  private runtime: CadSketchSolverAdapter | null = null;
  private loadPromise: Promise<CadSketchSolverAdapter> | null = null;
  private disposed = false;

  async init(): Promise<void> {
    await this.load();
  }

  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
    if (this.disposed) throw new Error('BrowserSketchSolverAdapter is disposed');
    if (!this.runtime) throw new Error('BrowserSketchSolverAdapter.init() must complete before solve()');
    return this.runtime.solve(document, sketchId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime?.dispose();
    this.runtime = null;
    this.loadPromise = null;
  }

  private load(): Promise<CadSketchSolverAdapter> {
    if (this.disposed) return Promise.reject(new Error('BrowserSketchSolverAdapter is disposed'));
    if (this.runtime) return Promise.resolve(this.runtime);
    if (!this.loadPromise) {
      this.loadPromise = import('../runtime/PlaneGCSSketchSolverRuntime')
        .then(async ({ PlaneGCSSketchSolverRuntime }) => {
          const runtime = new PlaneGCSSketchSolverRuntime();
          await runtime.init();
          if (this.disposed) {
            runtime.dispose();
            throw new Error('BrowserSketchSolverAdapter disposed during initialization');
          }
          this.runtime = runtime;
          return runtime;
        })
        .catch((error) => {
          this.loadPromise = null;
          throw error;
        });
    }
    return this.loadPromise;
  }
}
