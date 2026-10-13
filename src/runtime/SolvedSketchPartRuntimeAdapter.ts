import type { CadDocument, CadPartDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../contracts/runtime';
import type { CadSketchSolverAdapter } from '../contracts/sketchSolver';

/**
 * Transient solve -> B-Rep boundary.
 *
 * Persisted Sketch coordinates remain source inputs. The wrapped Part runtime
 * receives a clone whose feature-profile entities are replaced by solver output
 * from the same solver provider used by presentation.
 */
export class SolvedSketchPartRuntimeAdapter implements CadRuntimeAdapter {
  constructor(
    private readonly delegate: CadRuntimeAdapter,
    private readonly solver: CadSketchSolverAdapter,
  ) {}

  async recompute(document: Readonly<CadDocument>): Promise<CadRuntimeRecomputeResult> {
    if (document.kind !== 'part') return this.delegate.recompute(document);
    try {
      const solved = await solveFeatureDocument(document, this.solver);
      return this.delegate.recompute(solved);
    } catch (error) {
      return {
        ok: false,
        diagnostics: [{
          severity: 'error',
          code: 'PART_PROFILE_SKETCH_SOLVE_FAILED',
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

  async captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    const rebuilt = await this.recompute(document);
    if (!rebuilt.ok) {
      throw new Error(rebuilt.diagnostics.find((item) => item.severity === 'error')?.message
        ?? 'Cannot capture reference from an invalid model');
    }
    return this.delegate.captureReference(document, request);
  }

  dispose(): void {
    this.delegate.dispose();
    this.solver.dispose();
  }
}

async function solveFeatureDocument(
  document: Readonly<CadPartDocument>,
  solver: CadSketchSolverAdapter,
): Promise<CadPartDocument> {
  const sketchIds = new Set<CadSketchId>();
  for (const feature of document.features) {
    if (feature.suppressed) continue;
    if (feature.type !== 'extrude' && feature.type !== 'cut-extrude') continue;
    const sketchId = feature.parameters.sketchId;
    if (typeof sketchId === 'string') sketchIds.add(sketchId as CadSketchId);
  }
  if (sketchIds.size === 0) return structuredClone(document);

  await solver.init();
  const solved = structuredClone(document);
  for (const sketchId of sketchIds) {
    const result = solver.solve(document, sketchId);
    if (!result.ok || !result.converged) {
      const reason = result.diagnostics.find((item) => item.severity === 'error')?.message
        ?? `Sketch ${sketchId} did not converge`;
      throw new Error(reason);
    }
    const sketch = solved.sketches.find((item) => item.id === sketchId);
    if (!sketch) throw new Error(`Feature references missing Sketch ${sketchId}`);
    sketch.entities = structuredClone(result.entities);
  }
  return solved;
}
