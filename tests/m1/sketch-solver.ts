import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadDimensionId,
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

const horizontalLineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [30, 15], to: [10, 5] },
});
const horizontalLineId = horizontalLineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(horizontalLineId);
const horizontalDimension = await app.execute({
  id: 'dimension.horizontal',
  payload: { sketchId, entityId: horizontalLineId, value: 40, name: 'solver-horizontal' },
});
assert.equal(horizontalDimension.ok, true);
const horizontalDimensionId = horizontalDimension.createdIds?.[0] as CadDimensionId;
assert.ok(horizontalDimensionId);

const verticalLineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [15, 35], to: [5, 10] },
});
const verticalLineId = verticalLineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(verticalLineId);
const verticalDimension = await app.execute({
  id: 'dimension.vertical',
  payload: { sketchId, entityId: verticalLineId, value: 30, name: 'solver-vertical' },
});
assert.equal(verticalDimension.ok, true);
const verticalDimensionId = verticalDimension.createdIds?.[0] as CadDimensionId;
assert.ok(verticalDimensionId);

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

const solvedHorizontalLine = result.entities.find((entity) => entity.id === horizontalLineId);
assert.ok(solvedHorizontalLine);
assert.equal(solvedHorizontalLine.type, 'line');
if (solvedHorizontalLine.type !== 'line') throw new Error('Expected solved horizontal-dimension line');
assert.ok(
  Math.abs(Math.abs(solvedHorizontalLine.data.to[0] - solvedHorizontalLine.data.from[0]) - 40) < 1e-4,
  'horizontal dimension was not solved to absolute ΔX = 40',
);
assert.ok(
  solvedHorizontalLine.data.from[0] > solvedHorizontalLine.data.to[0],
  'reverse-X seed ordering must remain deterministic: endpoint b is the lower-X first vendor ref',
);

const solvedVerticalLine = result.entities.find((entity) => entity.id === verticalLineId);
assert.ok(solvedVerticalLine);
assert.equal(solvedVerticalLine.type, 'line');
if (solvedVerticalLine.type !== 'line') throw new Error('Expected solved vertical-dimension line');
assert.ok(
  Math.abs(Math.abs(solvedVerticalLine.data.to[1] - solvedVerticalLine.data.from[1]) - 30) < 1e-4,
  'vertical dimension was not solved to absolute ΔY = 30',
);
assert.ok(
  solvedVerticalLine.data.from[1] > solvedVerticalLine.data.to[1],
  'reverse-Y seed ordering must remain deterministic: endpoint b is the lower-Y first vendor ref',
);

const horizontalEdit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: horizontalDimensionId, value: 55 },
});
assert.equal(horizontalEdit.ok, true);
const verticalEdit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: verticalDimensionId, value: 45 },
});
assert.equal(verticalEdit.ok, true);

const editedResult = solver.solve(app.getDocument(), sketchId);
assert.equal(editedResult.ok, true, editedResult.diagnostics.map((item) => item.message).join('; '));
const editedHorizontalLine = editedResult.entities.find((entity) => entity.id === horizontalLineId);
const editedVerticalLine = editedResult.entities.find((entity) => entity.id === verticalLineId);
assert.ok(editedHorizontalLine && editedHorizontalLine.type === 'line');
assert.ok(editedVerticalLine && editedVerticalLine.type === 'line');
if (editedHorizontalLine.type !== 'line' || editedVerticalLine.type !== 'line') {
  throw new Error('Expected edited directional-dimension lines');
}
assert.ok(
  Math.abs(Math.abs(editedHorizontalLine.data.to[0] - editedHorizontalLine.data.from[0]) - 55) < 1e-4,
  'part.dimension.setValue must re-drive horizontal ΔX to 55',
);
assert.ok(
  Math.abs(Math.abs(editedVerticalLine.data.to[1] - editedVerticalLine.data.from[1]) - 45) < 1e-4,
  'part.dimension.setValue must re-drive vertical ΔY to 45',
);
assert.ok(editedHorizontalLine.data.from[0] > editedHorizontalLine.data.to[0]);
assert.ok(editedVerticalLine.data.from[1] > editedVerticalLine.data.to[1]);

solver.dispose();
app.dispose();
console.log('ASA-CAD M1 PlaneGCS sketch solver boundary PASS');
