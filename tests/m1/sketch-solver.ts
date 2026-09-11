import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopGeometryRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [] };
  }

  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('not used by sketch solver test');
  }

  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopGeometryRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Solver test' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

const lineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [0, 0], to: [30, 5] },
});
const lineId = lineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(lineId);

const horizontal = await app.execute({
  id: 'constraint.horizontal',
  payload: { sketchId, entityId: lineId },
});
assert.equal(horizontal.ok, true);

const length = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [lineId], value: 40, name: 'solver-length' },
});
assert.equal(length.ok, true);

const circleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [50, 10], diameter: 8 },
});
const circleId = circleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleId);

const diameter = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: circleId, value: 10, name: 'solver-diameter' },
});
assert.equal(diameter.ok, true);

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
const result = solver.solve(app.getDocument(), sketchId);
assert.equal(result.ok, true, result.diagnostics.map((item) => item.message).join('; '));
assert.equal(result.converged, true);

const solvedLine = result.entities.find((entity) => entity.id === lineId);
assert.ok(solvedLine);
assert.equal(solvedLine.type, 'line');
if (solvedLine.type !== 'line') throw new Error('Expected solved line');
const from = solvedLine.data.from;
const to = solvedLine.data.to;
assert.ok(Array.isArray(from) && Array.isArray(to));
assert.ok(Math.abs(from[1] - to[1]) < 1e-5, `horizontal constraint failed: ${from[1]} vs ${to[1]}`);
assert.ok(Math.abs(Math.hypot(to[0] - from[0], to[1] - from[1]) - 40) < 1e-4, 'driving length was not solved to 40');

const solvedCircle = result.entities.find((entity) => entity.id === circleId);
assert.ok(solvedCircle);
assert.equal(solvedCircle.type, 'circle');
if (solvedCircle.type !== 'circle') throw new Error('Expected solved circle');
assert.ok(Math.abs(solvedCircle.data.diameter - 10) < 1e-5, 'driving diameter was not solved to 10');

solver.dispose();
app.dispose();
console.log('ASA-CAD M1 PlaneGCS sketch solver boundary PASS');
