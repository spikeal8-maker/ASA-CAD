import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type { CadSketchSolverAdapter } from '../contracts/sketchSolver';

export interface FeatureProfileSnapshot {
  source: Readonly<CadDocument>;
  intent: string;
  sketchId: CadSketchId;
  status: 'solving' | 'solved' | 'error';
  sketch: Readonly<CadSketch> | null;
  reason?: string;
}

export function currentFeatureProfile(
  snapshot: Readonly<FeatureProfileSnapshot> | null,
  document: Readonly<CadDocument>,
  sketchId: CadSketchId,
): snapshot is Readonly<FeatureProfileSnapshot> {
  return snapshot !== null && snapshot.source === document && snapshot.sketchId === sketchId
    && snapshot.intent === JSON.stringify(document);
}

/** Read-only, revision-bound profile projection. The injected solver remains the shared ASA solver. */
export class PartFeatureProfile {
  private snapshot: Readonly<FeatureProfileSnapshot> | null = null;
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private disposed = false;
  private pending: Promise<Readonly<FeatureProfileSnapshot> | null> | null = null;

  constructor(
    private readonly document: () => Readonly<CadDocument>,
    private readonly solver: CadSketchSolverAdapter,
  ) {}

  getSnapshot = (): Readonly<FeatureProfileSnapshot> | null => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  refresh(sketchId: CadSketchId | null): Promise<Readonly<FeatureProfileSnapshot> | null> {
    if (this.disposed) return Promise.resolve(null);
    const source = this.document();
    const sketch = source.kind === 'part'
      ? source.sketches.find((item) => item.id === sketchId) : null;
    if (!sketch?.entities.length) {
      this.cancel();
      return Promise.resolve(null);
    }
    if (currentFeatureProfile(this.snapshot, source, sketch.id) && this.snapshot.status !== 'error') {
      return this.pending ?? Promise.resolve(this.snapshot);
    }

    const generation = ++this.generation;
    const intent = JSON.stringify(source);
    // The document can mutate in place while the shared WASM module initializes.
    const input = JSON.parse(intent) as CadDocument;
    const request: FeatureProfileSnapshot = {
      source, intent, sketchId: sketch.id, status: 'solving', sketch: null,
    };
    this.publish(request);
    this.pending = this.solve(input, request, generation);
    return this.pending;
  }

  /** Effect cleanup cancels a consumer without disposing the bundle-wide solver. */
  cancel(): void {
    this.generation += 1;
    this.pending = null;
    if (this.snapshot) this.publish(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.listeners.clear();
    this.solver.dispose();
  }

  private async solve(
    input: Readonly<CadDocument>,
    request: FeatureProfileSnapshot,
    generation: number,
  ): Promise<Readonly<FeatureProfileSnapshot> | null> {
    try {
      await this.solver.init();
      if (!this.isCurrent(request, generation)) return null;
      const result = this.solver.solve(input, request.sketchId);
      if (!this.isCurrent(request, generation)) return null;
      const original = input.kind === 'part'
        ? input.sketches.find((item) => item.id === request.sketchId) : null;
      const error = result.diagnostics.find((item) => item.severity === 'error');
      const solved = result.ok && result.converged && !error && original;
      this.publish({
        ...request,
        status: solved ? 'solved' : 'error',
        sketch: solved ? { ...original, entities: structuredClone(result.entities) } : null,
        reason: solved ? undefined : error?.message ?? 'Не удалось решить профиль эскиза',
      });
      return this.snapshot;
    } catch (error) {
      if (!this.isCurrent(request, generation)) return null;
      this.publish({
        ...request, status: 'error', sketch: null,
        reason: error instanceof Error ? error.message : String(error),
      });
      return this.snapshot;
    } finally {
      if (generation === this.generation) this.pending = null;
    }
  }

  private isCurrent(request: FeatureProfileSnapshot, generation: number): boolean {
    return !this.disposed && generation === this.generation
      && currentFeatureProfile(request, this.document(), request.sketchId);
  }

  private publish(snapshot: Readonly<FeatureProfileSnapshot> | null): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
