import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hash } from './performance-common.mjs';

export const near = (actual, expected, tolerance = 1e-5, label = 'value') =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' != ' + expected);

export async function command(app, value) {
  const result = await app.execute(value);
  assert.equal(result.ok, true, value.id + ': ' + JSON.stringify(result.error ?? result.diagnostics ?? null));
  return result;
}

function fixtureOnlyRuntime() {
  return {
    async recompute(document) {
      assert.equal(document.kind, 'part');
      assert.equal(document.features.length, 0, 'Fixture setup must never substitute for a B-Rep runtime');
      return { ok: true, diagnostics: [], runtimeRevision: 'fixture-no-brep' };
    },
    async captureReference() { throw new Error('Fixture-only runtime cannot capture topology'); },
    dispose() {},
  };
}

export function newSketchApp(api, runtime) {
  return new api.CadApplicationImpl(api.createEmptyCadDocument('part', { title: 'Audit sketch corpus' }), runtime ?? fixtureOnlyRuntime());
}

export function counts(document) {
  assert.equal(document.kind, 'part');
  return {
    sketches: document.sketches.length,
    entities: document.sketches.reduce((n, sketch) => n + sketch.entities.length, 0),
    constraints: document.constraints.length, dimensions: document.dimensions.length,
    features: document.features.length, stableReferences: document.stableReferences.length,
  };
}

export function ids(document) {
  return {
    documentId: document.documentId, sketches: document.sketches.map((item) => item.id),
    entities: document.sketches.flatMap((sketch) => sketch.entities.map((item) => item.id)),
    constraints: document.constraints.map((item) => item.id), dimensions: document.dimensions.map((item) => item.id),
    features: document.features.map((item) => item.id), stableReferences: document.stableReferences.map((item) => item.id),
  };
}

export function corpus(api, directory, name, document) {
  const serialized = api.serializeCadDocument(document);
  const file = path.join(directory, name + '.json');
  fs.writeFileSync(file, serialized + '\n', { flag: 'wx' });
  return { file, sha256: hash(serialized + '\n'), serializedBytes: Buffer.byteLength(serialized), counts: counts(document), ids: ids(document) };
}

export async function sketchFixture(api, size) {
  const app = newSketchApp(api);
  try {
    const sketchId = (await command(app, { id: 'sketch.create', payload: { support: 'XY', name: 'Scaled constrained lines' } })).createdIds[0];
    for (let i = 0; i < size; i++) {
      const lineId = (await command(app, { id: 'sketch.line', payload: { sketchId, from: [0, i * 10], to: [30, i * 10 + 5] } })).createdIds[0];
      await command(app, { id: 'constraint.horizontal', payload: { sketchId, entityId: lineId } });
      await command(app, { id: 'dimension.linear', payload: { sketchId, entityIds: [lineId], value: 40 } });
    }
    const document = api.parseCadDocument(api.serializeCadDocument(app.getDocument()));
    assert.deepEqual(counts(document), { sketches: 1, entities: size, constraints: size, dimensions: size, features: 0, stableReferences: 0 });
    return { document, sketchId };
  } finally { app.dispose(); }
}

export function solvedChecks(document, result, size) {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.converged, true);
  assert.equal(result.entities.length, size);
  assert.ok(Number.isFinite(result.degreesOfFreedom) && result.degreesOfFreedom > 0, 'Actual native DOF must be present');
  assert.equal(result.diagnostics.some((item) => item.severity === 'error'), false);
  assert.deepEqual(result.entities.map((item) => item.id), document.sketches[0].entities.map((item) => item.id));
  for (const entity of result.entities) {
    assert.equal(entity.type, 'line');
    near(entity.data.from[1], entity.data.to[1], 1e-5, 'horizontal');
    near(Math.hypot(entity.data.to[0] - entity.data.from[0], entity.data.to[1] - entity.data.from[1]), 40, 1e-5, 'driving length');
  }
  return { degreesOfFreedom: result.degreesOfFreedom, residual: result.residual, iterations: result.iterations, entityIdsPreserved: true, actualHorizontalAndLength40: true };
}

export async function protectedPart(api, rectangleOwner, oc) {
  const core = new api.OpenCascadePartRuntime(oc);
  const app = new api.CadApplicationImpl(
    api.createEmptyCadDocument('part', { title: 'Audit Protected Part' }),
    new api.SolvedSketchPartRuntimeAdapter(core, new api.PlaneGCSSketchSolverRuntime()),
  );
  try {
    const sketch1 = (await command(app, { id: 'sketch.create', payload: { support: 'XY', name: 'Base sketch' } })).createdIds[0];
    const rectangle = await rectangleOwner.commitParametricRectangle(app, sketch1, 60, 40);
    assert.equal(rectangle.ok, true, rectangle.error);
    const widthId = app.getDocument().dimensions.find((item) => item.name === 'width')?.id;
    assert.ok(widthId);
    const extrude = (await command(app, { id: 'feature.extrude', payload: { sketchId: sketch1, distance: 10 } })).createdIds[0];
    const topFace = await app.captureReference({ kind: 'face', sourceFeatureId: extrude, point: [0, 0, 10], semanticRole: 'top-face-for-hole-sketch' });
    const sketch2 = (await command(app, { id: 'sketch.create', payload: { support: topFace, name: 'Hole sketch' } })).createdIds[0];
    const circle = (await command(app, { id: 'sketch.circle', payload: { sketchId: sketch2, center: [0, 0], diameter: 12 } })).createdIds[0];
    await command(app, { id: 'dimension.diameter', payload: { sketchId: sketch2, entityId: circle, value: 12, name: 'diameter' } });
    const cut = (await command(app, { id: 'feature.cutExtrude', payload: { sketchId: sketch2, end: 'through-all' } })).createdIds[0];
    const edge = await app.captureReference({ kind: 'edge', sourceFeatureId: cut, point: [0, -20, 0], semanticRole: 'outer-bottom-edge-for-fillet' });
    await command(app, { id: 'feature.fillet', payload: { references: [edge], radius: 1 } });
    await command(app, { id: 'document.rebuild', payload: {} });
    assert.deepEqual(counts(app.getDocument()), { sketches: 2, entities: 5, constraints: 8, dimensions: 3, features: 3, stableReferences: 2 });
    const initial = partChecks(core, 60);
    return { app, core, widthId, initial };
  } catch (error) { app.dispose(); throw error; }
}

export function partChecks(core, width, baselineVolume) {
  const value = core.getLastAnalysis();
  assert.ok(value, 'Missing actual OCC analysis');
  assert.equal(value.featureCount, 3);
  for (const [key, expected] of Object.entries({ minX: -width / 2, maxX: width / 2, minY: -20, maxY: 20, minZ: 0, maxZ: 10 })) {
    near(value.bounds[key], expected, 1e-4, key);
  }
  if (width === 60) assert.ok(value.volume > 22000 && value.volume < 24000, 'Unexpected protected volume');
  if (baselineVolume !== undefined) assert.ok(value.volume > baselineVolume + 7900 && value.volume < baselineVolume + 8050, 'Width edit changed the wrong solid');
  return structuredClone(value);
}
