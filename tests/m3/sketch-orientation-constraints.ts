import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  type CadPartDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-orientation-test' };
  }
  async captureReference(): Promise<never> {
    throw new Error('reference capture is not used by M3.7A');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3.7A H/V' }), new NoopRuntime());

function part(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const sketchCreated = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Orientation test' } });
const sketchId = sketchCreated.createdIds?.[0] as CadSketchId;
const lineCreated = await app.execute({ id: 'sketch.line', payload: { sketchId, from: [-8, -4], to: [10, 6] } });
const lineId = lineCreated.createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineId);

const beforeGeometry = JSON.stringify(part().sketches[0].entities[0]);
const horizontal = await app.execute({ id: 'constraint.horizontal', payload: { sketchId, entityId: lineId } });
assert.equal(horizontal.ok, true);
assert.equal(horizontal.changed, true);
const horizontalId = horizontal.createdIds?.[0];
assert.ok(horizontalId);
assert.equal(part().constraints.length, 1);
assert.deepEqual(part().constraints[0], { id: horizontalId, type: 'horizontal', entityIds: [lineId] });
assert.deepEqual(part().sketches[0].constraintIds, [horizontalId]);
assert.equal(JSON.stringify(part().sketches[0].entities[0]), beforeGeometry, 'constraint intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedHorizontal = solved.entities.find((entity) => entity.id === lineId);
assert.ok(solvedHorizontal?.type === 'line');
if (solvedHorizontal?.type !== 'line') throw new Error('Expected solved Line');
assert.ok(Math.abs(solvedHorizontal.data.from[1] - solvedHorizontal.data.to[1]) < 1e-5, 'persisted Horizontal intent must reconstruct a horizontal PlaneGCS result');
assert.equal(JSON.stringify(part().sketches[0].entities[0]), beforeGeometry, 'solver result must stay transient');

const beforeDuplicate = JSON.stringify(app.getDocument());
const duplicate = await app.execute({ id: 'constraint.horizontal', payload: { sketchId, entityId: lineId } });
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /Horizontal constraint already exists/);
assert.equal(JSON.stringify(app.getDocument()), beforeDuplicate, 'duplicate Horizontal must rollback atomically');

const opposite = await app.execute({ id: 'constraint.vertical', payload: { sketchId, entityId: lineId } });
assert.equal(opposite.ok, false);
assert.match(opposite.error?.message ?? '', /already has horizontal constraint/);
assert.equal(JSON.stringify(app.getDocument()), beforeDuplicate, 'H/V conflict must not mutate document');

const undo = await app.undo();
assert.equal(undo.ok, true);
assert.equal(part().constraints.length, 0);
assert.deepEqual(part().sketches[0].constraintIds, []);
const redo = await app.redo();
assert.equal(redo.ok, true);
assert.deepEqual(part().constraints[0], { id: horizontalId, type: 'horizontal', entityIds: [lineId] }, 'Redo must restore the same constraint ID and intent');

const circleCreated = await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [20, 3], diameter: 8 } });
const circleId = circleCreated.createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = JSON.stringify(app.getDocument());
const wrongType = await app.execute({ id: 'constraint.vertical', payload: { sketchId, entityId: circleId } });
assert.equal(wrongType.ok, false);
assert.match(wrongType.error?.message ?? '', /Vertical constraint requires a Line entity/);
assert.equal(JSON.stringify(app.getDocument()), beforeWrongType, 'orientation constraint on Circle must rollback');

const secondSketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } });
const secondSketchId = secondSketch.createdIds?.[0] as CadSketchId;
const beforeCrossSketch = JSON.stringify(app.getDocument());
const crossSketch = await app.execute({ id: 'constraint.vertical', payload: { sketchId: secondSketchId, entityId: lineId } });
assert.equal(crossSketch.ok, false);
assert.equal(JSON.stringify(app.getDocument()), beforeCrossSketch, 'cross-Sketch orientation command must rollback');

const verticalApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const verticalSketch = await verticalApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Vertical test' } });
const verticalSketchId = verticalSketch.createdIds?.[0] as CadSketchId;
const verticalLine = await verticalApp.execute({ id: 'sketch.line', payload: { sketchId: verticalSketchId, from: [-3, -9], to: [8, 7] } });
const verticalLineId = verticalLine.createdIds?.[0] as CadSketchEntityId;
const vertical = await verticalApp.execute({ id: 'constraint.vertical', payload: { sketchId: verticalSketchId, entityId: verticalLineId } });
assert.equal(vertical.ok, true);
solved = solver.solve(verticalApp.getDocument(), verticalSketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedVertical = solved.entities.find((entity) => entity.id === verticalLineId);
assert.ok(solvedVertical?.type === 'line');
if (solvedVertical?.type !== 'line') throw new Error('Expected solved vertical Line');
assert.ok(Math.abs(solvedVertical.data.from[0] - solvedVertical.data.to[0]) < 1e-5, 'persisted Vertical intent must reconstruct a vertical PlaneGCS result');

verticalApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD M3.7A orientation constraints PASS (Line-only H/V + duplicate/conflict rollback + history + transient PlaneGCS reconstruction)');
