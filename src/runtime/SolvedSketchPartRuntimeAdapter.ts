import type { CadDocument, CadPartDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
  CadRuntimeRequest,
} from '../contracts/runtime';
import type { CadSketchSolverAdapter } from '../contracts/sketchSolver';

const superseded = (): CadRuntimeRecomputeResult => ({
  ok: false,
  diagnostics: [{ severity: 'error', code: 'CAD_RUNTIME_SUPERSEDED', message: 'CAD runtime request superseded' }],
});
function assertCurrent(request: CadRuntimeRequest): void {
  if (!request.isCurrent()) throw new Error('CAD runtime request superseded');
}

/**
 * Transient solve -> B-Rep boundary. Persisted coordinates remain source inputs;
 * only the current immutable request may enter the synchronous kernel.
 */
export class SolvedSketchPartRuntimeAdapter implements CadRuntimeAdapter {
  private requestId = 0;
  private disposed = false;

  constructor(
    private readonly delegate: CadRuntimeAdapter,
    private readonly solver: CadSketchSolverAdapter,
  ) {}

  async recompute(document: Readonly<CadDocument>, parent?: CadRuntimeRequest): Promise<CadRuntimeRecomputeResult> {
    const ownership = this.beginRequest(parent);
    if (!ownership.isCurrent()) return superseded();
    const outcome = await this.rebuild(structuredClone(document), ownership);
    return ownership.isCurrent() ? outcome.result : superseded();
  }

  async captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
    parent?: CadRuntimeRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    const ownership = this.beginRequest(parent);
    assertCurrent(ownership);
    const input = structuredClone(request);
    const outcome = await this.rebuild(structuredClone(document), ownership);
    assertCurrent(ownership);
    if (!outcome.result.ok) {
      throw new Error(outcome.result.diagnostics.find(item => item.severity === 'error')?.message
        ?? 'Cannot capture reference from an invalid model');
    }
    const captured = await this.delegate.captureReference(outcome.document, input, ownership);
    assertCurrent(ownership);
    return captured;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestId++;
    this.delegate.dispose();
    this.solver.dispose();
  }

  private beginRequest(parent?: CadRuntimeRequest): CadRuntimeRequest {
    const id = ++this.requestId;
    return { isCurrent: () => !this.disposed && id === this.requestId && (parent?.isCurrent() ?? true) };
  }

  private async rebuild(document: CadDocument, ownership: CadRuntimeRequest): Promise<{
    document: CadDocument; result: CadRuntimeRecomputeResult;
  }> {
    let solved = document;
    try {
      assertCurrent(ownership);
      if (document.kind === 'part') solved = await solveFeatureDocument(document, this.solver, ownership);
      assertCurrent(ownership);
    } catch (error) {
      return {
        document,
        result: !ownership.isCurrent() ? superseded() : {
          ok: false,
          diagnostics: [{
            severity: 'error', code: 'PART_PROFILE_SKETCH_SOLVE_FAILED',
            message: error instanceof Error ? error.message : String(error),
          }],
        },
      };
    }
    // This check must precede the delegate call: OCC mutates its real shape cache synchronously.
    assertCurrent(ownership);
    try {
      const result = await this.delegate.recompute(solved, ownership);
      return { document: solved, result: ownership.isCurrent() ? result : superseded() };
    } catch (error) {
      if (!ownership.isCurrent()) return { document: solved, result: superseded() };
      throw error;
    }
  }
}

async function solveFeatureDocument(
  document: Readonly<CadPartDocument>,
  solver: CadSketchSolverAdapter,
  ownership: CadRuntimeRequest,
): Promise<CadPartDocument> {
  const sketchIds = new Set<CadSketchId>();
  for (const feature of document.features) {
    if (feature.suppressed) continue;
    if (feature.type !== 'extrude' && feature.type !== 'cut-extrude') continue;
    const sketchId = feature.parameters.sketchId;
    if (typeof sketchId === 'string') sketchIds.add(sketchId as CadSketchId);
  }
  const solved = structuredClone(document);
  if (sketchIds.size === 0) return solved;

  await solver.init();
  assertCurrent(ownership);
  for (const sketchId of sketchIds) {
    const result = solver.solve(document, sketchId);
    if (!result.ok || !result.converged) {
      const reason = result.diagnostics.find(item => item.severity === 'error')?.message
        ?? ('Sketch ' + sketchId + ' did not converge');
      throw new Error(reason);
    }
    const sketch = solved.sketches.find(item => item.id === sketchId);
    if (!sketch) throw new Error('Feature references missing Sketch ' + sketchId);
    sketch.entities = structuredClone(result.entities);
  }
  return solved;
}
