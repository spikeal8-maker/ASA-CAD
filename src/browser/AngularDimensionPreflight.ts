import type { CadDocument } from '../contracts/document';
import type { CadDimensionId, CadSketchEntityId, CadSketchId } from '../contracts/ids';
import { createCadId } from '../contracts/ids';
import type { CadSketchSolverAdapter } from '../contracts/sketchSolver';

export type AngularDimensionPreflightResult =
  | { ok: true }
  | {
      ok: false;
      kind: 'invalid-context' | 'constraint-rejected' | 'solver-error';
      message: string;
    };

export async function preflightAngularDimension(
  document: Readonly<CadDocument>,
  sketchId: CadSketchId,
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
  value: number,
  solver?: CadSketchSolverAdapter,
): Promise<AngularDimensionPreflightResult> {
  if (document.kind !== 'part') {
    return { ok: false, kind: 'invalid-context', message: 'угловой размер доступен только в детали' };
  }

  const candidate = structuredClone(document);
  const sketch = candidate.sketches.find((item) => item.id === sketchId);
  if (!sketch) return { ok: false, kind: 'invalid-context', message: `эскиз ${sketchId} не найден` };

  const id = createCadId<CadDimensionId>('dimension');
  candidate.dimensions.push({
    id,
    type: 'angular',
    entityIds: [aEntityId, bEntityId],
    value,
    driving: true,
  });
  sketch.dimensionIds.push(id);

  try {
    const activeSolver = solver
      ?? (await import('./SharedBrowserSketchSolver')).sharedBrowserSketchSolver;
    await activeSolver.init();
    const solved = activeSolver.solve(candidate, sketchId);
    if (solved.ok && solved.converged) return { ok: true };

    return {
      ok: false,
      kind: 'constraint-rejected',
      message: solved.diagnostics.find((item) => item.severity === 'error')?.message
        ?? `эскиз ${sketch.name} не сошёлся`,
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'solver-error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
