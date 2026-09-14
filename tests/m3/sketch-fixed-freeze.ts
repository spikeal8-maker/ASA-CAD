import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  type CadConstraintId,
  type CadPartDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-fixed-freeze-test' };
  }
  async captureReference(): Promise<never> {
    throw new Error('reference capture is not used by M3.7B Fixed test');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(
  createEmptyCadDocument('part', { title: 'M3.7B Fixed freeze' }),
  new NoopRuntime(),
);

function part(): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Fixed test' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
const lineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [0, 0], to: [30, 5] },
});
const lineId = lineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(lineId);

const horizontal = await app.execute({ id: 'constraint.horizontal', payload: { sketchId, entityId: lineId } });
assert.equal(horizontal.ok, true);
const persistedBeforeFreeze = structuredClone(part().sketches[0].entities[0]);
assert.equal(persistedBeforeFreeze.type, 'line');
if (persistedBeforeFreeze.type !== 'line') throw new Error('Expected Line');
assert.notEqual(persistedBeforeFreeze.data.from[1], persistedBeforeFreeze.data.to[1], 'fixture must keep stale pre-solve DTO geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
const solvedBeforeFreeze = solver.solve(app.getDocument(), sketchId);
assert.equal(solvedBeforeFreeze.ok, true, solvedBeforeFreeze.diagnostics.map((item) => item.message).join('; '));
assert.equal(solvedBeforeFreeze.converged, true);
const solvedLine = solvedBeforeFreeze.entities.find((entity) => entity.id === lineId);
assert.ok(solvedLine && solvedLine.type === 'line');
if (!solvedLine || solvedLine.type !== 'line') throw new Error('Expected solved Line');
assert.ok(Math.abs(solvedLine.data.from[1] - solvedLine.data.to[1]) < 1e-6, 'PlaneGCS must solve the Line horizontal before Fixed');

const fixed = await app.execute({
  id: 'constraint.fixed',
  payload: {
    sketchId,
    entityId: lineId,
    frozenGeometry: {
      type: 'line',
      from: solvedLine.data.from,
      to: solvedLine.data.to,
    },
  },
});
assert.equal(fixed.ok, true, fixed.error?.message);
assert.equal(fixed.changed, true);
const fixedId = fixed.createdIds?.[0] as CadConstraintId;
assert.ok(fixedId);

const frozenLine = part().sketches[0].entities[0];
assert.equal(frozenLine.id, lineId, 'Fixed must preserve the selected stable entity ID');
assert.equal(frozenLine.type, 'line');
if (frozenLine.type !== 'line') throw new Error('Expected frozen Line');
assert.deepEqual(frozenLine.data.from, solvedLine.data.from, 'Fixed must persist the solved visible from-point');
assert.deepEqual(frozenLine.data.to, solvedLine.data.to, 'Fixed must persist the solved visible to-point');
assert.ok(part().constraints.some((constraint) => constraint.id === fixedId && constraint.type === 'fixed'));
assert.ok(part().constraints.some((constraint) => constraint.type === 'horizontal'), 'Fixed must preserve compatible Horizontal intent');

const solvedAfterFreeze = solver.solve(app.getDocument(), sketchId);
assert.equal(solvedAfterFreeze.ok, true, solvedAfterFreeze.diagnostics.map((item) => item.message).join('; '));
assert.equal(solvedAfterFreeze.converged, true, 'Horizontal + Fixed must remain solver-valid');
const resolvedFrozen = solvedAfterFreeze.entities.find((entity) => entity.id === lineId);
assert.ok(resolvedFrozen && resolvedFrozen.type === 'line');
if (!resolvedFrozen || resolvedFrozen.type !== 'line') throw new Error('Expected re-solved frozen Line');
assert.deepEqual(resolvedFrozen.data.from, frozenLine.data.from);
assert.deepEqual(resolvedFrozen.data.to, frozenLine.data.to);

const beforeDuplicate = JSON.stringify(app.getDocument());
const duplicate = await app.execute({
  id: 'constraint.fixed',
  payload: {
    sketchId,
    entityId: lineId,
    frozenGeometry: { type: 'line', from: frozenLine.data.from, to: frozenLine.data.to },
  },
});
assert.equal(duplicate.ok, false, 'duplicate Fixed must be rejected');
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(JSON.stringify(app.getDocument()), beforeDuplicate, 'duplicate Fixed must rollback atomically');

const blockedMove = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId: lineId, delta: [1, 1] },
});
assert.equal(blockedMove.ok, false, 'fixed entity translation must remain rejected');
assert.match(blockedMove.error?.message ?? '', /Fixed sketch entity cannot be translated/);

const undo = await app.undo();
assert.equal(undo.ok, true);
const afterUndo = part();
assert.equal(afterUndo.constraints.some((constraint) => constraint.id === fixedId), false, 'Undo must remove the same Fixed constraint');
const undoLine = afterUndo.sketches[0].entities[0];
assert.equal(undoLine.type, 'line');
if (undoLine.type !== 'line') throw new Error('Expected Line after Undo');
assert.deepEqual(undoLine.data.from, persistedBeforeFreeze.data.from, 'Undo must restore pre-freeze persisted DTO geometry');
assert.deepEqual(undoLine.data.to, persistedBeforeFreeze.data.to);
assert.ok(afterUndo.constraints.some((constraint) => constraint.type === 'horizontal'), 'Undo Fixed must retain previous Horizontal intent');

const redo = await app.redo();
assert.equal(redo.ok, true);
const afterRedo = part();
assert.ok(afterRedo.constraints.some((constraint) => constraint.id === fixedId && constraint.type === 'fixed'), 'Redo must restore the same Fixed ID');
const redoLine = afterRedo.sketches[0].entities[0];
assert.equal(redoLine.type, 'line');
if (redoLine.type !== 'line') throw new Error('Expected Line after Redo');
assert.deepEqual(redoLine.data.from, frozenLine.data.from);
assert.deepEqual(redoLine.data.to, frozenLine.data.to);

const invalidBefore = JSON.stringify(app.getDocument());
const invalid = await app.execute({
  id: 'constraint.fixed',
  payload: {
    sketchId,
    entityId: lineId,
    frozenGeometry: { type: 'line', from: [Number.NaN, 0], to: [1, 0] },
  },
});
assert.equal(invalid.ok, false);
assert.equal(JSON.stringify(app.getDocument()), invalidBefore, 'invalid freeze payload must not mutate the document');

solver.dispose();
app.dispose();
console.log('ASA-CAD M3.7B Fixed freeze PASS (solved geometry -> atomic persistence + Fixed + history + stable ID + solver validity)');
