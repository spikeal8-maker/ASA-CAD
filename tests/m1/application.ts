import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDimensionId,
  type CadFeatureId,
  type CadPartDocument,
  type CadReferenceCaptureRequest,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class RecordingRuntime implements CadRuntimeAdapter {
  recomputeCount = 0;
  captureCount = 0;
  lastSerializedDocument = '';
  disposed = false;

  async recompute(document: Parameters<CadRuntimeAdapter['recompute']>[0]): Promise<CadRuntimeRecomputeResult> {
    this.recomputeCount++;
    this.lastSerializedDocument = JSON.stringify(document);
    return { ok: true, diagnostics: [], runtimeRevision: `test-${this.recomputeCount}` };
  }

  async captureReference(
    _document: Parameters<CadRuntimeAdapter['captureReference']>[0],
    request: CadReferenceCaptureRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    this.captureCount++;
    return {
      ownerFeatureId: request.sourceFeatureId,
      semanticRole: request.semanticRole,
      locator: { kind: request.kind, point: [...request.point] },
    };
  }

  dispose(): void {
    this.disposed = true;
  }
}

const runtime = new RecordingRuntime();
const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M1 application test' }), runtime);

function getPart(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part document');
  return document;
}

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
const extrudeFeatureId = extrude.createdIds?.[0] as CadFeatureId;
assert.ok(extrudeFeatureId);
assert.equal(getPart().features.at(-1)?.type, 'extrude');
assert.equal(getPart().bodies.length, 1);

const edgeReferenceId = await app.captureReference({
  kind: 'edge',
  sourceFeatureId: extrudeFeatureId,
  point: [0, 0, 0],
  semanticRole: 'protected-fillet-edge',
});
assert.equal(runtime.recomputeCount, 1, 'dirty document is rebuilt before reference capture');
assert.equal(runtime.captureCount, 1);
assert.equal(getPart().stableReferences.length, 1);
assert.deepEqual(getPart().stableReferences[0].locator, { kind: 'edge', point: [0, 0, 0] });
assert.equal(app.getCommandAvailability('feature.fillet').enabled, true);

const fillet = await app.execute({
  id: 'feature.fillet',
  payload: { references: [edgeReferenceId], radius: 1 },
});
assert.equal(fillet.ok, true);
assert.equal(getPart().features.at(-1)?.type, 'fillet');
assert.deepEqual(getPart().features.at(-1)?.inputReferences, [edgeReferenceId]);

const editWidth = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: widthDimensionId, value: 80 },
});
assert.equal(editWidth.ok, true);
assert.equal(getPart().dimensions.find((item) => item.id === widthDimensionId)?.value, 80);
assert.equal(app.getState().dirty, true);
assert.equal(app.getState().recompute.status, 'dirty');

const rebuild = await app.execute({ id: 'document.rebuild', payload: {} });
assert.equal(rebuild.ok, true);
assert.equal(runtime.recomputeCount, 2);
assert.equal(app.getState().recompute.status, 'clean');
assert.match(runtime.lastSerializedDocument, /\"width\"/);

const undo = await app.undo();
assert.equal(undo.ok, true);
assert.equal(runtime.recomputeCount, 3);
assert.equal(getPart().dimensions.find((item) => item.id === widthDimensionId)?.value, 60);
assert.equal(app.getState().canRedo, true);

const redo = await app.redo();
assert.equal(redo.ok, true);
assert.equal(runtime.recomputeCount, 4);
assert.equal(getPart().dimensions.find((item) => item.id === widthDimensionId)?.value, 80);

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
await app.replaceDocument(reopened);
assert.equal(runtime.recomputeCount, 5);
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
assert.equal(app.getCommandAvailability('document.rebuild').enabled, false);
await assert.rejects(
  () => app.execute({ id: 'document.rebuild', payload: {} }),
  /disposed/i,
);

console.log('ASA-CAD M1 CadApplication behavior PASS');
