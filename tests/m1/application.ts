import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDimensionId,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class RecordingRuntime implements CadRuntimeAdapter {
  recomputeCount = 0;
  lastSerializedDocument = '';
  disposed = false;

  async recompute(document: Parameters<CadRuntimeAdapter['recompute']>[0]): Promise<CadRuntimeRecomputeResult> {
    this.recomputeCount++;
    this.lastSerializedDocument = JSON.stringify(document);
    return { ok: true, diagnostics: [], runtimeRevision: `test-${this.recomputeCount}` };
  }

  dispose(): void {
    this.disposed = true;
  }
}

const runtime = new RecordingRuntime();
const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M1 application test' }), runtime);

assert.equal(app.getDocument().kind, 'part');
assert.equal(app.getCommandAvailability('feature.extrude').enabled, false);

const createSketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
assert.equal(createSketch.ok, true);
const sketchId = createSketch.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);
assert.equal(app.getCommandAvailability('feature.extrude').enabled, true);

const rectangle = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [0, 0], width: 60, height: 40 },
});
assert.equal(rectangle.ok, true);
assert.equal(rectangle.createdIds?.length, 4);
const rectangleEdges = rectangle.createdIds as CadSketchEntityId[];

const widthDimensionResult = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [rectangleEdges[0]], value: 60, name: 'width' },
});
const widthDimensionId = widthDimensionResult.createdIds?.[0] as CadDimensionId;

const heightDimensionResult = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [rectangleEdges[1]], value: 40, name: 'height' },
});
assert.ok(heightDimensionResult.createdIds?.[0]);

const extrude = await app.execute({
  id: 'feature.extrude',
  payload: { sketchId, distance: 10 },
});
assert.equal(extrude.ok, true);
assert.equal(app.getDocument().kind, 'part');
if (app.getDocument().kind === 'part') {
  assert.equal(app.getDocument().features.at(-1)?.type, 'extrude');
  assert.equal(app.getDocument().bodies.length, 1);
}

const editWidth = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: widthDimensionId, value: 80 },
});
assert.equal(editWidth.ok, true);
if (app.getDocument().kind === 'part') {
  assert.equal(app.getDocument().dimensions.find((item) => item.id === widthDimensionId)?.value, 80);
}
assert.equal(app.getState().dirty, true);
assert.equal(app.getState().recompute.status, 'dirty');

const rebuild = await app.execute({ id: 'document.rebuild', payload: {} });
assert.equal(rebuild.ok, true);
assert.equal(runtime.recomputeCount, 1);
assert.equal(app.getState().recompute.status, 'clean');
assert.match(runtime.lastSerializedDocument, /\"width\"/);

const undo = await app.undo();
assert.equal(undo.ok, true);
assert.equal(runtime.recomputeCount, 2);
if (app.getDocument().kind === 'part') {
  assert.equal(app.getDocument().dimensions.find((item) => item.id === widthDimensionId)?.value, 60);
}
assert.equal(app.getState().canRedo, true);

const redo = await app.redo();
assert.equal(redo.ok, true);
assert.equal(runtime.recomputeCount, 3);
if (app.getDocument().kind === 'part') {
  assert.equal(app.getDocument().dimensions.find((item) => item.id === widthDimensionId)?.value, 80);
}

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
await app.replaceDocument(reopened);
assert.equal(runtime.recomputeCount, 4);
assert.equal(app.getState().dirty, false);
assert.equal(app.getState().canUndo, false);
assert.equal(app.getState().canRedo, false);

const invalid = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [0, 0], width: -1, height: 40 },
});
assert.equal(invalid.ok, false);

app.dispose();
assert.equal(runtime.disposed, true);
assert.throws(() => app.getCommandAvailability('document.rebuild'), /disposed/i);

console.log('ASA-CAD M1 CadApplication behavior PASS');
