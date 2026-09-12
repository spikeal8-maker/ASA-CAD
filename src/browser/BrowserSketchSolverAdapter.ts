import type { CadDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadSketchSolveResult,
  CadSketchSolverAdapter,
} from '../contracts/sketchSolver';

const planeGcsWasmUrl = new URL(
  '../../vendor/toubkal/node_modules/@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm',
  import.meta.url,
).toString();

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
  private disposed = false;

  async init(): Promise<void> {
    this.assertAlive();
    await this.load();
  }

  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
    this.assertAlive();
    if (!this.delegate) {
      throw new Error('BrowserSketchSolverAdapter.init() must be awaited before solve()');
    }
    return this.delegate.solve(document, sketchId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.delegate?.dispose();
    this.delegate = null;
    this.loadPromise = null;
  }

  private load(): Promise<CadSketchSolverAdapter> {
    this.assertAlive();
    if (this.delegate) return Promise.resolve(this.delegate);
    if (!this.loadPromise) {
      this.loadPromise = import('../runtime/PlaneGCSSketchSolverRuntime')
        .then(async ({ PlaneGCSSketchSolverRuntime }) => {
          const delegate = new PlaneGCSSketchSolverRuntime(planeGcsWasmUrl);
          await delegate.init();
          if (this.disposed) {
            delegate.dispose();
            throw new Error('BrowserSketchSolverAdapter was disposed while loading');
          }
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

  private assertAlive(): void {
    if (this.disposed) throw new Error('BrowserSketchSolverAdapter is disposed');
  }
}
