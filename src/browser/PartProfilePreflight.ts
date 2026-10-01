import { buildClosedLinearProfile } from '../application/SketchLinearProfile';
import type { CadPartDocument } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { sharedBrowserSketchSolver } from './SharedBrowserSketchSolver';

export async function preflightLinearExtrudeProfile(
  document: Readonly<CadPartDocument>,
  sketchId: CadSketchId,
): Promise<void> {
  const sketch = document.sketches.find((item) => item.id === sketchId);
  if (!sketch) throw new Error(`Missing Sketch ${sketchId}`);
  await sharedBrowserSketchSolver.init();
  const result = sharedBrowserSketchSolver.solve(document, sketchId);
  if (!result.ok || !result.converged) {
    throw new Error(result.diagnostics.find((item) => item.severity === 'error')?.message
      ?? `${sketch.name}: sketch solution did not converge`);
  }
  buildClosedLinearProfile({ ...sketch, entities: structuredClone(result.entities) });
}
