import type { CadDocument } from '../contracts/document';
import type { CadDimensionId, CadSketchEntityId, CadSketchId } from '../contracts/ids';
import { createCadId } from '../contracts/ids';
import { sharedBrowserSketchSolver } from './SharedBrowserSketchSolver';

export async function preflightAngularDimension(
  document: Readonly<CadDocument>,
  sketchId: CadSketchId,
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
  value: number,
): Promise<string | null> {
  if (document.kind !== 'part') return 'угловой размер доступен только в детали';

  const candidate = structuredClone(document);
  const sketch = candidate.sketches.find((item) => item.id === sketchId);
  if (!sketch) return `эскиз ${sketchId} не найден`;

  const id = createCadId<CadDimensionId>('dimension');
  candidate.dimensions.push({
    id,
    type: 'angular',
    entityIds: [aEntityId, bEntityId],
    value,
    driving: true,
  });
  sketch.dimensionIds.push(id);

  await sharedBrowserSketchSolver.init();
  const solved = sharedBrowserSketchSolver.solve(candidate, sketchId);
  if (solved.ok && solved.converged) return null;

  return solved.diagnostics.find((item) => item.severity === 'error')?.message
    ?? `эскиз ${sketch.name} не сошёлся`;
}
