import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadPartDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-coincident-test' };
  }
  async captureReference(): Promise<never> {
    throw new Error('reference capture is not used by M3.7C');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3.7C Coincident' }), new NoopRuntime());

function part(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Coincident test' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
const lineAResult = await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [10, 2] } });
const lineBResult = await app.execute({ id: 'sketch.line', payload: { sketchId, from: [18, 8], to: [28, 12] } });
const lineA = lineAResult.createdIds?.[0] as CadSketchEntityId;
const lineB = lineBResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineA && lineB);

const sourceGeometry = JSON.stringify(part().sketches[0].entities);
const created = await app.execute({
  id: 'constraint.coincident',
  payload: {
    sketchId,
    a: { entityId: lineA, point: 'b' },
    b: { entityId: lineB, point: 'a' },
  },
});
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
assert.deepEqual(part().constraints[0], {
  id: constraintId,
  type: 'coincident',
  entityIds: [lineA, lineB],
  data: { refs: [{ entityId: lineA, point: 'b' }, { entityId: lineB, point: 'a' }] },
});
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Coincident intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedA = solved.entities.find((entity) => entity.id === lineA);
const solvedB = solved.entities.find((entity) => entity.id === lineB);
assert.ok(solvedA?.type === 'line' && solvedB?.type === 'line');
if (solvedA?.type !== 'line' || solvedB?.type !== 'line') throw new Error('Expected solved Lines');
assert.ok(Math.abs(solvedA.data.to[0] - solvedB.data.from[0]) < 1e-5);
assert.ok(Math.abs(solvedA.data.to[1] - solvedB.data.from[1]) < 1e-5);

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
const reopenedSolved = solver.solve(reopened, sketchId);
assert.equal(reopenedSolved.ok, true, reopenedSolved.diagnostics.map((item) => item.message).join('; '));
assert.deepEqual(
  reopened.kind === 'part' ? reopened.constraints[0] : null,
  part().constraints[0],
  'Save/Open must preserve Coincident ID and refs',
);

const beforeDuplicate = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({
  id: 'constraint.coincident',
  payload: {
    sketchId,
    a: { entityId: lineB, point: 'a' },
    b: { entityId: lineA, point: 'b' },
  },
});
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate, 'symmetric duplicate must roll back');

const sameLine = await app.execute({
  id: 'constraint.coincident',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: lineA, point: 'b' } },
});
assert.equal(sameLine.ok, false);
assert.match(sameLine.error?.message ?? '', /two distinct Lines/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const missingEndpoint = await app.execute({
  id: 'constraint.coincident',
  payload: { sketchId, a: { entityId: lineA }, b: { entityId: lineB, point: 'b' } },
});
assert.equal(missingEndpoint.ok, false);
assert.match(missingEndpoint.error?.message ?? '', /endpoint a or b/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const invalidEndpoint = await app.execute({
  id: 'constraint.coincident',
  payload: { sketchId, a: { entityId: lineA, point: 'c' }, b: { entityId: lineB, point: 'b' } },
});
assert.equal(invalidEndpoint.ok, false);
assert.match(invalidEndpoint.error?.message ?? '', /endpoint a or b/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const circleResult = await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [40, 0], diameter: 8 } });
const circleId = circleResult.createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = serializeCadDocument(app.getDocument());
const wrongType = await app.execute({
  id: 'constraint.coincident',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: circleId, point: 'a' } },
});
assert.equal(wrongType.ok, false);
assert.match(wrongType.error?.message ?? '', /must target a Line entity/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);

const otherSketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } });
const otherSketchId = otherSketchResult.createdIds?.[0] as CadSketchId;
const otherLineResult = await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 0], to: [3, 4] } });
const otherLine = otherLineResult.createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({
  id: 'constraint.coincident',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: otherLine, point: 'a' } },
});
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch Coincident must roll back');

const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketchResult = await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } });
const undoSketch = undoSketchResult.createdIds?.[0] as CadSketchId;
const undoLineA = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, 0], to: [5, 0] } })).createdIds?.[0] as CadSketchEntityId;
const undoLineB = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [8, 2], to: [12, 2] } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({ id: 'constraint.coincident', payload: { sketchId: undoSketch, a: { entityId: undoLineA, point: 'b' }, b: { entityId: undoLineB, point: 'a' } } });
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Coincident ID');

undoApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD M3.7C Coincident PASS (Line endpoints + duplicate/type/scope guards + PlaneGCS + persistence + history)');
