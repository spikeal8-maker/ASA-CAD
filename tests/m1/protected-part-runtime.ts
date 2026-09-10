import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import {
  CadApplicationImpl,
  OpenCascadePartRuntime,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDimensionId,
  type CadFeatureId,
  type CadPartDocument,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

const EPS = 1e-4;

function near(actual: number, expected: number, tolerance = EPS, label = 'value'): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function requirePart(app: CadApplicationImpl): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part document');
  return document;
}

console.log('\nASA-CAD M1 protected Part through CadApplication + OpenCascade');

const oc = await initOpenCascade();
const runtime = new OpenCascadePartRuntime(oc);
const app = new CadApplicationImpl(
  createEmptyCadDocument('part', { title: 'M1 protected Part' }),
  runtime,
);

const sketch1Result = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } });
assert.equal(sketch1Result.ok, true);
const sketch1 = sketch1Result.createdIds?.[0] as CadSketchId;

const rectangleResult = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId: sketch1, origin: [-30, -20], width: 60, height: 40 },
});
assert.equal(rectangleResult.ok, true);
const rectangleEdges = rectangleResult.createdIds as CadSketchEntityId[];
assert.equal(rectangleEdges.length, 4);

const widthDimensionResult = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId: sketch1, entityIds: [rectangleEdges[0]], value: 60, name: 'width' },
});
const widthDimensionId = widthDimensionResult.createdIds?.[0] as CadDimensionId;
assert.ok(widthDimensionId);

const heightDimensionResult = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId: sketch1, entityIds: [rectangleEdges[1]], value: 40, name: 'height' },
});
assert.ok(heightDimensionResult.createdIds?.[0]);

const extrudeResult = await app.execute({
  id: 'feature.extrude',
  payload: { sketchId: sketch1, distance: 10 },
});
assert.equal(extrudeResult.ok, true);
const extrudeFeatureId = extrudeResult.createdIds?.[0] as CadFeatureId;
assert.ok(extrudeFeatureId);

const topFaceReferenceId = await app.captureReference({
  kind: 'face',
  sourceFeatureId: extrudeFeatureId,
  point: [0, 0, 10],
  semanticRole: 'top-face-for-hole-sketch',
});
assert.ok(topFaceReferenceId);

const sketch2Result = await app.execute({
  id: 'sketch.create',
  payload: { support: topFaceReferenceId, name: 'Эскиз 2' },
});
assert.equal(sketch2Result.ok, true);
const sketch2 = sketch2Result.createdIds?.[0] as CadSketchId;

const circleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId: sketch2, center: [0, 0], diameter: 12 },
});
assert.equal(circleResult.ok, true);
const circleEntityId = circleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleEntityId);

const diameterResult = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId: sketch2, entityId: circleEntityId, value: 12, name: 'diameter' },
});
assert.ok(diameterResult.createdIds?.[0]);

const cutResult = await app.execute({
  id: 'feature.cutExtrude',
  payload: { sketchId: sketch2, end: 'through-all' },
});
assert.equal(cutResult.ok, true);
const cutFeatureId = cutResult.createdIds?.[0] as CadFeatureId;
assert.ok(cutFeatureId);

// Pick the midpoint of the long lower outer edge. Its logical geometric
// signature remains resolvable after width changes 60 -> 80 even though OCC
// subshape ordinals may change.
const filletEdgeReferenceId = await app.captureReference({
  kind: 'edge',
  sourceFeatureId: cutFeatureId,
  point: [0, -20, 0],
  semanticRole: 'outer-bottom-edge-for-fillet',
});
assert.ok(filletEdgeReferenceId);

const filletResult = await app.execute({
  id: 'feature.fillet',
  payload: { references: [filletEdgeReferenceId], radius: 1 },
});
assert.equal(filletResult.ok, true);

const initialRebuild = await app.execute({ id: 'document.rebuild', payload: {} });
assert.equal(initialRebuild.ok, true, initialRebuild.error?.message);
const initial = runtime.getLastAnalysis();
assert.ok(initial);
near(initial.bounds.minX, -30, EPS, 'initial minX');
near(initial.bounds.maxX, 30, EPS, 'initial maxX');
near(initial.bounds.minY, -20, EPS, 'initial minY');
near(initial.bounds.maxY, 20, EPS, 'initial maxY');
near(initial.bounds.minZ, 0, EPS, 'initial minZ');
near(initial.bounds.maxZ, 10, EPS, 'initial maxZ');
assert.equal(initial.featureCount, 3);
assert.ok(initial.volume > 22_000 && initial.volume < 24_000, `unexpected initial volume ${initial.volume}`);
console.log(`  ✓ 60x40x10 + centered Ø12 through cut + R1 fillet (V=${initial.volume.toFixed(3)})`);

const editWidth = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: widthDimensionId, value: 80 },
});
assert.equal(editWidth.ok, true);

const editedRebuild = await app.execute({ id: 'document.rebuild', payload: {} });
assert.equal(editedRebuild.ok, true, editedRebuild.error?.message);
const edited = runtime.getLastAnalysis();
assert.ok(edited);
near(edited.bounds.minX, -40, EPS, 'edited minX');
near(edited.bounds.maxX, 40, EPS, 'edited maxX');
near(edited.bounds.minY, -20, EPS, 'edited minY');
near(edited.bounds.maxY, 20, EPS, 'edited maxY');
near(edited.bounds.maxZ, 10, EPS, 'edited maxZ');
assert.equal(edited.featureCount, 3);
assert.ok(edited.volume > initial.volume + 7_900, 'width edit did not grow the rebuilt solid as expected');
assert.ok(edited.volume < initial.volume + 8_050, 'width edit changed implausibly much volume');
assert.equal(requirePart(app).stableReferences.length, 2);
assert.equal(requirePart(app).features.at(-1)?.type, 'fillet');
console.log(`  ✓ driving width 60 -> 80 rebuilds cut + stable-reference fillet (V=${edited.volume.toFixed(3)})`);

const saved = serializeCadDocument(app.getDocument());
const savedSnapshot = JSON.parse(saved) as unknown;
assert.equal(JSON.stringify(savedSnapshot).includes('TopoDS'), false, 'serialized document leaked OCC type names');
assert.equal(JSON.stringify(savedSnapshot).includes('window.oc'), false, 'serialized document leaked OCC globals');

app.dispose();

const runtime2 = new OpenCascadePartRuntime(oc);
const reopenedApp = new CadApplicationImpl(parseCadDocument(saved), runtime2);
const reopenRebuild = await reopenedApp.execute({ id: 'document.rebuild', payload: {} });
assert.equal(reopenRebuild.ok, true, reopenRebuild.error?.message);
const reopened = runtime2.getLastAnalysis();
assert.ok(reopened);
near(reopened.volume, edited.volume, 1e-5, 'reopened volume');
near(reopened.bounds.minX, -40, EPS, 'reopened minX');
near(reopened.bounds.maxX, 40, EPS, 'reopened maxX');
assert.equal(requirePart(reopenedApp).stableReferences.length, 2);
console.log('  ✓ serialized ASA CadDocument reopens and recomputes identical B-Rep result');

reopenedApp.dispose();
console.log('  ✓ M1 protected Part runtime vertical slice PASS\n');
