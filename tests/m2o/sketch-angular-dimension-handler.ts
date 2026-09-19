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

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [] };
  }
  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('not used');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

async function line(from: readonly [number, number], to: readonly [number, number]) {
  const result = await app.execute({ id: 'sketch.line', payload: { sketchId, from, to } });
  assert.equal(result.ok, true);
  const id = result.createdIds?.[0] as CadSketchEntityId;
  assert.ok(id);
  return id;
}
const lineAId = await line([0, 0], [20, 0]);
const lineBId = await line([0, 0], [10, 10]);

const circleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [40, 10], diameter: 10 },
});
const circleId = circleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleId);

const arcResult = await app.execute({
  id: 'sketch.arc',
  payload: { sketchId, center: [60, 10], start: [70, 10], end: [60, 20] },
});
const arcId = arcResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(arcId);

const angular = await app.execute({
  id: 'dimension.angular',
  payload: { sketchId, aEntityId: lineAId, bEntityId: lineBId, value: 60, name: 'angle-60' },
});
assert.equal(angular.ok, true);
const angularId = angular.createdIds?.[0] as CadDimensionId;
assert.ok(angularId);

const part = app.getDocument();
assert.equal(part.kind, 'part');
if (part.kind !== 'part') throw new Error('Expected Part document');
const stored = part.dimensions.find((dimension) => dimension.id === angularId);
assert.ok(stored && stored.type === 'angular');
if (!stored || stored.type !== 'angular') throw new Error('Expected Angular dimension');
assert.deepEqual(stored.entityIds, [lineAId, lineBId], 'Angular refs must preserve command order');
assert.equal(stored.value, 60);
assert.equal(stored.driving, true);
assert.equal(part.sketches[0]?.dimensionIds.filter((id) => id === angularId).length, 1);

async function rejectAngular(
  payload: { aEntityId: CadSketchEntityId; bEntityId: CadSketchEntityId; value: number },
  pattern: RegExp,
) {
  const before = serializeCadDocument(app.getDocument());
  const result = await app.execute({ id: 'dimension.angular', payload: { sketchId, ...payload } });
  assert.equal(result.ok, false);
  assert.match(result.error?.message ?? '', pattern);
  assert.equal(serializeCadDocument(app.getDocument()), before, 'invalid Angular command must roll back atomically');
}

await rejectAngular({ aEntityId: lineAId, bEntityId: lineAId, value: 60 }, /two distinct Line entities/);
await rejectAngular({ aEntityId: lineAId, bEntityId: circleId, value: 60 }, /requires two Line entities/);
await rejectAngular({ aEntityId: lineAId, bEntityId: arcId, value: 60 }, /requires two Line entities/);
for (const value of [0, 180, 200, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
  await rejectAngular(
    { aEntityId: lineAId, bEntityId: lineBId, value },
    /finite and between 0 and 180 degrees/,
  );
}

async function rejectSetValue(value: number, pattern: RegExp) {
  const before = serializeCadDocument(app.getDocument());
  const result = await app.execute({
    id: 'part.dimension.setValue',
    payload: { dimensionId: angularId, value },
  });
  assert.equal(result.ok, false);
  assert.match(result.error?.message ?? '', pattern);
  assert.equal(serializeCadDocument(app.getDocument()), before, 'invalid Angular setValue must roll back atomically');
}

await rejectSetValue(Number.POSITIVE_INFINITY, /positive finite/);
await rejectSetValue(Number.NEGATIVE_INFINITY, /positive finite/);
await rejectSetValue(Number.NaN, /positive finite/);
await rejectSetValue(180, /less than 180 degrees/);
await rejectSetValue(200, /less than 180 degrees/);

app.dispose();
console.log('M2O Angular handler PASS (two distinct Lines + degree domain + atomic rollback + generic setValue guard)');
