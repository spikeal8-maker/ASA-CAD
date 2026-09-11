import type { CadDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadSketchSolveDiagnostic,
  CadSketchSolverAdapter,
  CadSolvedSketchEntity,
} from '../contracts/sketchSolver';

export type CadSketchConstraintState =
  | 'unknown'
  | 'under-constrained'
  | 'fully-constrained';

export type CadSketchSolveStatus = 'idle' | 'solving' | 'solved' | 'error';

export interface CadSketchSolveSnapshot {
  requestId: number;
  status: CadSketchSolveStatus;
  sketchId: CadSketchId | null;
  /** Transient solved geometry for SketchOverlay. Never persisted directly. */
  previewEntities: CadSolvedSketchEntity[];
  converged: boolean | null;
  residual: number | null;
  iterations: number | null;
  degreesOfFreedom: number | null;
  constraintState: CadSketchConstraintState;
  diagnostics: CadSketchSolveDiagnostic[];
}

export type CadSketchSolveListener = (snapshot: Readonly<CadSketchSolveSnapshot>) => void;

/**
 * ASA-owned solve orchestration for one editor session.
 *
 * Responsibilities:
 * - lazy-init the concrete solver;
 * - keep only transient preview/diagnostics/DoF state;
 * - reject stale async solve completions;
 * - never mutate CadDocument or CadApplication history.
 *
 * Persisting a solved edit must happen through a normal CadApplication command,
 * which is the only path that may create an Undo/Redo history entry.
 */
export class SketchSolveSession {
  private readonly listeners = new Set<CadSketchSolveListener>();
  private snapshot: CadSketchSolveSnapshot = idleSnapshot(0);
  private initPromise: Promise<void> | null = null;
  private requestId = 0;
  private disposed = false;

  constructor(private readonly solver: CadSketchSolverAdapter) {}

  getSnapshot(): Readonly<CadSketchSolveSnapshot> {
    return this.snapshot;
  }

  subscribe(listener: CadSketchSolveListener): () => void {
    this.assertAlive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async solve(document: Readonly<CadDocument>, sketchId: CadSketchId): Promise<Readonly<CadSketchSolveSnapshot>> {
    this.assertAlive();
    const requestId = ++this.requestId;
    this.snapshot = {
      ...idleSnapshot(requestId),
      status: 'solving',
      sketchId,
    };
    this.emit();

    try {
      await this.ensureInitialized();
      if (requestId !== this.requestId || this.disposed) return this.snapshot;

      const result = this.solver.solve(document, sketchId);
      if (requestId !== this.requestId || this.disposed) return this.snapshot;

      const solved = result.ok && result.converged;
      this.snapshot = {
        requestId,
        status: solved ? 'solved' : 'error',
        sketchId,
        previewEntities: structuredClone(result.entities),
        converged: result.converged,
        residual: result.residual,
        iterations: result.iterations,
        degreesOfFreedom: result.degreesOfFreedom,
        constraintState: solved ? constraintState(result.degreesOfFreedom) : 'unknown',
        diagnostics: structuredClone(result.diagnostics),
      };
      this.emit();
      return this.snapshot;
    } catch (error) {
      if (requestId !== this.requestId || this.disposed) return this.snapshot;
      this.snapshot = {
        ...idleSnapshot(requestId),
        status: 'error',
        sketchId,
        converged: false,
        diagnostics: [{
          severity: 'error',
          code: 'SKETCH_SOLVE_SESSION_FAILED',
          message: error instanceof Error ? error.message : String(error),
        }],
      };
      this.emit();
      return this.snapshot;
    }
  }

  clear(): void {
    this.assertAlive();
    const requestId = ++this.requestId;
    this.snapshot = idleSnapshot(requestId);
    this.emit();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestId += 1;
    this.listeners.clear();
    this.solver.dispose();
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.solver.init().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('SketchSolveSession is disposed');
  }
}

function idleSnapshot(requestId: number): CadSketchSolveSnapshot {
  return {
    requestId,
    status: 'idle',
    sketchId: null,
    previewEntities: [],
    converged: null,
    residual: null,
    iterations: null,
    degreesOfFreedom: null,
    constraintState: 'unknown',
    diagnostics: [],
  };
}

function constraintState(degreesOfFreedom: number | null): CadSketchConstraintState {
  if (degreesOfFreedom == null) return 'unknown';
  return degreesOfFreedom === 0 ? 'fully-constrained' : 'under-constrained';
}
