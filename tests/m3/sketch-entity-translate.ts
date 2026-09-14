import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  type CadPartDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';
import {
  buildSketchTranslationCandidate,
  translateSketchEntity,
} from '../../src/application/SketchEntityTransform';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-translate-test' };
  }
  async captureReference(): Promise<never> {
    throw new Error('reference capture is not used by M3.6B translate test');
  }
  dispose(): void {}
}

const line = translateSketchEntity({
  id: 'entity_line' as CadSketchEntityId,
  type: 'line',
  data: { from: [1, 2], to: [4, 6], role: 'rectangle-edge-2' },
}, [3, -2]);
assert.deepEqual(line, {
  id: 'entity_line',
  type: 'line',
  data: { from: [4, 0], to: [7, 4], role: 'rectangle-edge-2' },
});

const circle = translateSketchEntity({
  id: 'entity_circle' as CadSketchEntityId,
  type: 'circle',
  data: { center: [5, 7], diameter: 12 },
}, [-2, 3]);
assert.deepEqual(circle.data, { center: [3, 10], diameter: 12 });

const arc = translateSketchEntity({
  id: 'entity_arc' as CadSketchEntityId,
  type: 'arc',
  data: { center: [0, 0], radius: 8, startAngle: 0.2, endAngle: 1.7 },
}, [10, 4]);
assert.deepEqual(arc.data, { center: [10, 4], radius: 8, startAngle: 0.2, endAngle: 1.7 });
assert.throws(() => translateSketchEntity(line, [Number.NaN, 0]), /translation delta must be finite/);

const app = new CadApplicationImpl(
  createEmptyCadDocument('part', { title: 'M3.6B translate' }),
  new NoopRuntime(),
);

function part(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Drag test' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
const created = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [0, 0], to: [20, 0] },
});
const entityId = created.createdIds?.[0] as CadSketchEntityId;
assert.ok(entityId);

const horizontal = await app.execute({ id: 'constraint.horizontal', payload: { sketchId, entityId } });
assert.equal(horizontal.ok, true);

const translated = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId, delta: [7, -3] },
});
assert.equal(translated.ok, true);
assert.equal(translated.changed, true);
const moved = part().sketches[0].entities[0];
assert.equal(moved.id, entityId, 'translation must preserve stable entity ID');
assert.deepEqual(moved.type === 'line' ? moved.data.from : null, [7, -3]);
assert.deepEqual(moved.type === 'line' ? moved.data.to : null, [27, -3]);
assert.equal(part().constraints.length, 1, 'translation must preserve existing constraints');

const undo = await app.undo();
assert.equal(undo.ok, true);
const restored = part().sketches[0].entities[0];
assert.equal(restored.id, entityId);
assert.deepEqual(restored.type === 'line' ? restored.data.from : null, [0, 0]);

const redo = await app.redo();
assert.equal(redo.ok, true);
const redone = part().sketches[0].entities[0];
assert.equal(redone.id, entityId);
assert.deepEqual(redone.type === 'line' ? redone.data.from : null, [7, -3]);

const noOp = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId, delta: [0, 0] },
});
assert.equal(noOp.ok, true);
assert.equal(noOp.changed, false, 'zero drag must not create a document mutation');

const fixed = await app.execute({ id: 'constraint.fixed', payload: { sketchId, entityId } });
assert.equal(fixed.ok, true);
const beforeFixedMove = JSON.stringify(app.getDocument());
const blocked = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId, delta: [1, 1] },
});
assert.equal(blocked.ok, false, 'fixed entity translation must fail at application boundary');
assert.match(blocked.error?.message ?? '', /Fixed sketch entity cannot be translated/);
assert.equal(JSON.stringify(app.getDocument()), beforeFixedMove, 'fixed translation must rollback atomically');

const candidate = buildSketchTranslationCandidate(part(), sketchId, entityId, [-2, 5]);
const candidateEntity = candidate.sketches.find((item) => item.id === sketchId)?.entities.find((item) => item.id === entityId);
assert.ok(candidateEntity && candidateEntity.type === 'line');
assert.deepEqual(candidateEntity.data.from, [5, 2]);
assert.deepEqual(part().sketches[0].entities[0].type === 'line' ? part().sketches[0].entities[0].data.from : null, [7, -3], 'candidate builder must not mutate persisted document');

const secondSketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } });
const secondSketchId = secondSketch.createdIds?.[0] as CadSketchId;
const beforeInvalid = JSON.stringify(app.getDocument());
const invalid = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId: secondSketchId, entityId, delta: [1, 1] },
});
assert.equal(invalid.ok, false, 'cross-Sketch translation must fail');
assert.equal(JSON.stringify(app.getDocument()), beforeInvalid, 'failed translation must rollback atomically');

app.dispose();
console.log('ASA-CAD M3.6B Sketch entity translate PASS (rigid DTO semantics + stable ID + fixed guard + rollback + history + transient candidate)');
