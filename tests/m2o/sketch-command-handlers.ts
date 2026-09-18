import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  serializeCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadDimensionId,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';
import {
  SKETCH_GROWTH_COMMAND_IDS,
  getSketchGrowthCommandAvailability,
  isSketchGrowthCommandId,
} from '../../src/application/commands/SketchCommandHandlers';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'o6-test' };
  }

  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('captureReference is not used by O6 handler test');
  }

  dispose(): void {}
}

assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('sketch.rectangle'));
assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('constraint.coincident'));
assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('dimension.linear'));
assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('dimension.horizontal'));
assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('dimension.vertical'));
assert.ok(SKETCH_GROWTH_COMMAND_IDS.includes('part.dimension.setValue'));
assert.equal(isSketchGrowthCommandId('feature.extrude'), false);

const initial = createEmptyCadDocument('part', { title: 'O6 handler registry' });
assert.equal(getSketchGrowthCommandAvailability(initial, 'sketch.line').enabled, false);
assert.equal(getSketchGrowthCommandAvailability(initial, 'sketch.create').enabled, true);

const app = new CadApplicationImpl(initial, new NoopRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
assert.equal(sketchResult.ok, true);
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);
assert.equal(app.getCommandAvailability('sketch.rectangle').enabled, true);

const beforeInvalid = serializeCadDocument(app.getDocument());
const invalidRectangle = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [0, 0], width: -1, height: 40 },
});
assert.equal(invalidRectangle.ok, false);
assert.equal(
  serializeCadDocument(app.getDocument()),
  beforeInvalid,
  'failed extracted handler must roll the document back atomically in CadApplicationImpl',
);

const rectangle = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [0, 0], width: 60, height: 40 },
});
assert.equal(rectangle.ok, true);
const afterRectangle = serializeCadDocument(app.getDocument());
assert.notEqual(afterRectangle, beforeInvalid);

const undo = await app.undo();
assert.equal(undo.ok, true);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid, 'undo stays centralized around extracted handlers');

const redo = await app.redo();
assert.equal(redo.ok, true);
assert.equal(serializeCadDocument(app.getDocument()), afterRectangle, 'redo stays centralized around extracted handlers');

const line = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [30, 20], to: [10, 5] },
});
assert.equal(line.ok, true);
const lineId = line.createdIds?.[0] as CadSketchEntityId;
assert.ok(lineId);
assert.equal(app.getCommandAvailability('dimension.horizontal').enabled, true);
assert.equal(app.getCommandAvailability('dimension.vertical').enabled, true);

const beforeHorizontal = serializeCadDocument(app.getDocument());
const horizontal = await app.execute({
  id: 'dimension.horizontal',
  payload: { sketchId, entityId: lineId, value: 40, name: 'width-x' },
});
assert.equal(horizontal.ok, true);
const horizontalId = horizontal.createdIds?.[0] as CadDimensionId;
assert.ok(horizontalId);
const afterHorizontal = serializeCadDocument(app.getDocument());
assert.notEqual(afterHorizontal, beforeHorizontal);

const undoHorizontal = await app.undo();
assert.equal(undoHorizontal.ok, true);
assert.equal(
  serializeCadDocument(app.getDocument()),
  beforeHorizontal,
  'horizontal dimension mutation must remain inside central application history',
);
const redoHorizontal = await app.redo();
assert.equal(redoHorizontal.ok, true);
assert.equal(serializeCadDocument(app.getDocument()), afterHorizontal);

const vertical = await app.execute({
  id: 'dimension.vertical',
  payload: { sketchId, entityId: lineId, value: 25, name: 'height-y' },
});
assert.equal(vertical.ok, true);
assert.ok(vertical.createdIds?.[0]);

const circle = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [50, 10], diameter: 8 },
});
assert.equal(circle.ok, true);
const circleId = circle.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleId);

const diameter = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: circleId, value: 18 },
});
assert.equal(diameter.ok, true);
assert.ok(diameter.createdIds?.[0]);
const afterDiameter = serializeCadDocument(app.getDocument());

const invalidDiameterLine = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: lineId, value: 20 },
});
assert.equal(invalidDiameterLine.ok, false);
assert.match(invalidDiameterLine.error?.message ?? '', /requires a Circle entity, got line/);
assert.equal(serializeCadDocument(app.getDocument()), afterDiameter, 'invalid Line Diameter target must roll back atomically');

const invalidDiameterValue = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: circleId, value: Number.POSITIVE_INFINITY },
});
assert.equal(invalidDiameterValue.ok, false);
assert.match(invalidDiameterValue.error?.message ?? '', /positive finite/);
assert.equal(serializeCadDocument(app.getDocument()), afterDiameter, 'non-finite Diameter value must roll back atomically');

const beforeInvalidCircle = serializeCadDocument(app.getDocument());
const invalidHorizontalCircle = await app.execute({
  id: 'dimension.horizontal',
  payload: { sketchId, entityId: circleId, value: 15 },
});
assert.equal(invalidHorizontalCircle.ok, false);
assert.match(invalidHorizontalCircle.error?.message ?? '', /requires a Line entity/);
assert.equal(
  serializeCadDocument(app.getDocument()),
  beforeInvalidCircle,
  'invalid Circle target must roll back atomically',
);

const arc = await app.execute({
  id: 'sketch.arc',
  payload: { sketchId, center: [80, 20], start: [90, 20], end: [80, 30] },
});
assert.equal(arc.ok, true);
const arcId = arc.createdIds?.[0] as CadSketchEntityId;
assert.ok(arcId);
const beforeInvalidArc = serializeCadDocument(app.getDocument());

const invalidDiameterArc = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: arcId, value: 12 },
});
assert.equal(invalidDiameterArc.ok, false);
assert.match(invalidDiameterArc.error?.message ?? '', /requires a Circle entity, got arc/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalidArc, 'invalid Arc Diameter target must roll back atomically');

const invalidVerticalArc = await app.execute({
  id: 'dimension.vertical',
  payload: { sketchId, entityId: arcId, value: 12 },
});
assert.equal(invalidVerticalArc.ok, false);
assert.match(invalidVerticalArc.error?.message ?? '', /requires a Line entity/);
assert.equal(
  serializeCadDocument(app.getDocument()),
  beforeInvalidArc,
  'invalid Arc target must roll back atomically',
);

app.dispose();
console.log('M2O O6 Sketch handler behavior PASS (typed registry + atomic rollback + centralized undo/redo)');
