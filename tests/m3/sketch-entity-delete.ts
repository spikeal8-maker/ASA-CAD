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

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-delete-test' };
  }
  async captureReference(): Promise<never> {
    throw new Error('reference capture is not used by M3.6A delete test');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(
  createEmptyCadDocument('part', { title: 'M3.6A delete' }),
  new NoopRuntime(),
);

function part(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Delete test' } });
assert.equal(sketchResult.ok, true);
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;

const lineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [0, 0], to: [25, 0] },
});
assert.equal(lineResult.ok, true);
const entityId = lineResult.createdIds?.[0] as CadSketchEntityId;

const constraint = await app.execute({
  id: 'constraint.horizontal',
  payload: { sketchId, entityId },
});
assert.equal(constraint.ok, true);
const constraintId = constraint.createdIds?.[0];

const dimension = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [entityId], value: 25, name: 'length' },
});
assert.equal(dimension.ok, true);
const dimensionId = dimension.createdIds?.[0];

assert.equal(part().sketches[0].entities.length, 1);
assert.equal(part().constraints.length, 1);
assert.equal(part().dimensions.length, 1);
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.deepEqual(part().sketches[0].dimensionIds, [dimensionId]);

const deleted = await app.execute({
  id: 'sketch.entity.delete',
  payload: { sketchId, entityId },
});
assert.equal(deleted.ok, true);
assert.equal(deleted.changed, true);
assert.equal(part().sketches[0].entities.length, 0);
assert.equal(part().constraints.length, 0);
assert.equal(part().dimensions.length, 0);
assert.deepEqual(part().sketches[0].constraintIds, []);
assert.deepEqual(part().sketches[0].dimensionIds, []);

const undo = await app.undo();
assert.equal(undo.ok, true);
assert.equal(part().sketches[0].entities.length, 1);
assert.equal(part().sketches[0].entities[0].id, entityId);
assert.equal(part().constraints.length, 1);
assert.equal(part().constraints[0].id, constraintId);
assert.equal(part().dimensions.length, 1);
assert.equal(part().dimensions[0].id, dimensionId);
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.deepEqual(part().sketches[0].dimensionIds, [dimensionId]);

const redo = await app.redo();
assert.equal(redo.ok, true);
assert.equal(part().sketches[0].entities.length, 0);
assert.equal(part().constraints.length, 0);
assert.equal(part().dimensions.length, 0);

await app.undo();
const secondSketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } });
const secondSketchId = secondSketch.createdIds?.[0] as CadSketchId;
const before = JSON.stringify(app.getDocument());
const invalid = await app.execute({
  id: 'sketch.entity.delete',
  payload: { sketchId: secondSketchId, entityId },
});
assert.equal(invalid.ok, false, 'cross-Sketch delete must fail');
assert.equal(JSON.stringify(app.getDocument()), before, 'failed cross-Sketch delete must rollback atomically');

app.dispose();
console.log('ASA-CAD M3.6A Sketch entity delete PASS (dependencies + rollback + Undo/Redo)');
