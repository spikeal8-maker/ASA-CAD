import planeGcsWasmUrl from '../../vendor/toubkal/node_modules/@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm';
import type { CadDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadSketchSolveResult,
  CadSketchSolverAdapter,
} from '../contracts/sketchSolver';

const MAX_SOLVE_CACHE = 32;

/**
 * Browser-owned lazy boundary for the Sketch solver.
 *
 * The cache is deliberately keyed by the complete solver-relevant persisted
 * Sketch state. UI overlay and Part runtime therefore consume the same solved
 * result for the same document revision instead of independently deriving shape.
 */
export class BrowserSketchSolverAdapter implements CadSketchSolverAdapter {
  private delegate: CadSketchSolverAdapter | null = null;
  private loadPromise: Promise<CadSketchSolverAdapter> | null = null;
  private readonly cache = new Map<string, CadSketchSolveResult>();
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
    const key = solveKey(document, sketchId);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return structuredClone(cached);
    }

    const result = this.delegate.solve(document, sketchId);
    this.cache.set(key, structuredClone(result));
    while (this.cache.size > MAX_SOLVE_CACHE) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return structuredClone(result);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.delegate?.dispose();
    this.delegate = null;
    this.loadPromise = null;
    this.cache.clear();
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

function solveKey(document: Readonly<CadDocument>, sketchId: CadSketchId): string {
  if (document.kind !== 'part') return JSON.stringify({ kind: document.kind, sketchId });
  const sketch = document.sketches.find((item) => item.id === sketchId);
  if (!sketch) return JSON.stringify({ kind: document.kind, sketchId, missing: true });
  const constraintIds = new Set(sketch.constraintIds);
  const dimensionIds = new Set(sketch.dimensionIds);
  return JSON.stringify({
    sketch,
    constraints: document.constraints.filter((item) => constraintIds.has(item.id)),
    dimensions: document.dimensions.filter((item) => dimensionIds.has(item.id)),
  });
}
