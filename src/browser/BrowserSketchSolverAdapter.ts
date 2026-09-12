import type { CadDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadSketchSolveResult,
  CadSketchSolverAdapter,
} from '../contracts/sketchSolver';

/**
 * Browser-owned lazy boundary for the Sketch solver.
 *
 * The product shell may import this lightweight adapter at startup, but the
 * PlaneGCS implementation and its WASM are loaded only when SketchSolveSession
 * first initializes a real solve. This is independent from OpenCascade loading.
 */
export class BrowserSketchSolverAdapter implements CadSketchSolverAdapter {
  private delegate: CadSketchSolverAdapter | null = null;
  private loadPromise: Promise<CadSketchSolverAdapter> | null = null;

  async init(): Promise<void> {
    await this.load();
  }

  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
    if (!this.delegate) {
      throw new Error('BrowserSketchSolverAdapter.init() must be awaited before solve()');
    }
    return this.delegate.solve(document, sketchId);
  }

  dispose(): void {
    this.delegate?.dispose();
    this.delegate = null;
    this.loadPromise = null;
  }

  private load(): Promise<CadSketchSolverAdapter> {
    if (this.delegate) return Promise.resolve(this.delegate);
    if (!this.loadPromise) {
      this.loadPromise = import('../runtime/PlaneGCSSketchSolverRuntime')
        .then(async ({ PlaneGCSSketchSolverRuntime }) => {
          const delegate = new PlaneGCSSketchSolverRuntime();
          await delegate.init();
          this.delegate = delegate;
          return delegate;
        })
        .catch((error) => {
          this.loadPromise = null;
          throw error;
        });
    }
    return this.loadPromise;
  }
}
