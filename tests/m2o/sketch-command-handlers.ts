import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  serializeCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
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

app.dispose();
console.log('M2O O6 Sketch handler behavior PASS (typed registry + atomic rollback + centralized undo/redo)');
