import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { createEmptyCadDocument } from '../../src/contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import { OpenCascadePartRenderAdapter } from '../../src/runtime/OpenCascadePartRenderAdapter';
import { OpenCascadePartRuntime } from '../../src/runtime/OpenCascadePartRuntime';

const EPS = 1e-4;
const near = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) <= EPS, `${label}: expected ${expected}, got ${actual}`);
};

console.log('\nASA-CAD M2 neutral render model');

const oc = await initOpenCascade();
const runtime = new OpenCascadePartRuntime(oc);
const app = new CadApplicationImpl(
  createEmptyCadDocument('part', { title: 'M2 render model' }),
  runtime,
);

const sketchResult = await app.execute({
  id: 'sketch.create',
  payload: { support: 'XY', name: 'Эскиз 1' },
});
assert.equal(sketchResult.ok, true);
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

const rectangle = await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [-30, -20], width: 60, height: 40 },
});
assert.equal(rectangle.ok, true);
const edges = rectangle.createdIds as CadSketchEntityId[];
assert.equal(edges.length, 4);

await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [edges[0]], value: 60, name: 'width' },
});
await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [edges[1]], value: 40, name: 'height' },
});

const extrude = await app.execute({
  id: 'feature.extrude',
  payload: { sketchId, distance: 10 },
});
assert.equal(extrude.ok, true);

const rebuild = await app.execute({ id: 'document.rebuild', payload: {} });
assert.equal(rebuild.ok, true, rebuild.error?.message);

const adapter = new OpenCascadePartRenderAdapter(runtime);
const model = adapter.getRenderModel(app.getDocument());
assert.ok(model, 'render model was not produced after a successful B-Rep rebuild');
assert.match(model.runtimeRevision, /^occ-\d+$/);
assert.equal(model.meshes.length, 1);

const mesh = model.meshes[0];
assert.ok(mesh.bodyId, 'render mesh has no ASA body id');
assert.ok(mesh.sourceFeatureId, 'render mesh has no ASA source feature id');
assert.ok(mesh.positions instanceof Float32Array);
assert.ok(mesh.normals instanceof Float32Array);
assert.ok(mesh.indices instanceof Uint32Array);
assert.ok(mesh.positions.length > 0, 'render mesh positions are empty');
assert.equal(mesh.positions.length % 3, 0);
assert.equal(mesh.normals.length, mesh.positions.length);
assert.ok(mesh.indices.length > 0, 'render mesh indices are empty');
assert.equal(mesh.indices.length % 3, 0);
assert.ok(mesh.faceGroups.length >= 6, `expected box face groups, got ${mesh.faceGroups.length}`);
for (const group of mesh.faceGroups) {
  assert.ok(group.count > 0);
  assert.ok(group.faceIndex >= 0);
}

near(model.bounds.minX, -30, 'minX');
near(model.bounds.maxX, 30, 'maxX');
near(model.bounds.minY, -20, 'minY');
near(model.bounds.maxY, 20, 'maxY');
near(model.bounds.minZ, 0, 'minZ');
near(model.bounds.maxZ, 10, 'maxZ');

const serializedRender = JSON.stringify(model);
assert.equal(serializedRender.includes('TopoDS'), false, 'render model leaked OpenCascade type names');
assert.equal(serializedRender.includes('BufferGeometry'), false, 'render model leaked Three.js objects');
assert.equal(serializedRender.includes('MeshStandardMaterial'), false, 'render model leaked Three.js materials');

console.log(`  ✓ vertices=${mesh.positions.length / 3}, triangles=${mesh.indices.length / 3}, faceGroups=${mesh.faceGroups.length}`);
console.log('  ✓ bounds 60×40×10 and ASA IDs preserved');
console.log('  ✓ no OCC/Three objects cross the render boundary');

app.dispose();
console.log('  ✓ M2 neutral render model PASS\n');
