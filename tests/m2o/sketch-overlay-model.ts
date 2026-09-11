import assert from 'node:assert/strict';
import { createCadId, type CadSketchEntityId, type CadSketchId } from '../../src';
import type { CadSketch } from '../../src/contracts/document';
import type { CadSketchSolveSnapshot } from '../../src/application/SketchSolveSession';
import { buildSketchOverlayModel } from '../../src/web/viewport/SketchOverlayModel';

const sketchId = createCadId<CadSketchId>('sketch');
const otherSketchId = createCadId<CadSketchId>('sketch');
const lineId = createCadId<CadSketchEntityId>('entity');
const sketch: CadSketch = {
  id: sketchId,
  name: 'Overlay Sketch',
  support: 'XY',
  entities: [{ id: lineId, type: 'line', data: { from: [0, 0], to: [20, 0] } }],
  constraintIds: [],
  dimensionIds: [],
};

const documentModel = buildSketchOverlayModel(sketch, null);
assert.ok(documentModel);
assert.equal(documentModel.source, 'document');
assert.equal(documentModel.solveStatus, 'idle');
assert.deepEqual(documentModel.entities, sketch.entities);
assert.notEqual(documentModel.entities, sketch.entities, 'overlay model must clone persisted entity collection');

const solvedSnapshot: CadSketchSolveSnapshot = {
  requestId: 7,
  status: 'solved',
  sketchId,
  previewEntities: [{ id: lineId, type: 'line', data: { from: [0, 0], to: [40, 0] } }],
  converged: true,
  residual: 0,
  iterations: 3,
  degreesOfFreedom: 2,
  constraintState: 'under-constrained',
  diagnostics: [],
};
const solvedModel = buildSketchOverlayModel(sketch, solvedSnapshot);
assert.ok(solvedModel);
assert.equal(solvedModel.source, 'solver-preview');
assert.equal(solvedModel.solveStatus, 'solved');
assert.equal(solvedModel.degreesOfFreedom, 2);
assert.equal(solvedModel.constraintState, 'under-constrained');
assert.equal(solvedModel.entities[0]?.type, 'line');
if (solvedModel.entities[0]?.type !== 'line') throw new Error('expected line overlay');
assert.deepEqual(solvedModel.entities[0].data.to, [40, 0]);

// Overlay mutations must never leak back into document or solver-session state.
solvedModel.entities[0].data.to = [99, 99];
assert.deepEqual(sketch.entities[0]?.type === 'line' ? sketch.entities[0].data.to : null, [20, 0]);
assert.deepEqual(solvedSnapshot.previewEntities[0]?.type === 'line' ? solvedSnapshot.previewEntities[0].data.to : null, [40, 0]);

const staleSnapshot: CadSketchSolveSnapshot = {
  ...solvedSnapshot,
  requestId: 8,
  sketchId: otherSketchId,
};
const staleModel = buildSketchOverlayModel(sketch, staleSnapshot);
assert.ok(staleModel);
assert.equal(staleModel.source, 'document', 'preview from another Sketch must never replace persisted geometry');
assert.equal(staleModel.solveStatus, 'idle');
assert.equal(staleModel.degreesOfFreedom, null);

const errorSnapshot: CadSketchSolveSnapshot = {
  ...solvedSnapshot,
  requestId: 9,
  status: 'error',
  previewEntities: [{ id: lineId, type: 'line', data: { from: [0, 0], to: [55, 0] } }],
  converged: false,
  constraintState: 'unknown',
  diagnostics: [{ severity: 'error', code: 'TEST', message: 'not converged' }],
};
const errorModel = buildSketchOverlayModel(sketch, errorSnapshot);
assert.ok(errorModel);
assert.equal(errorModel.source, 'document', 'failed solve must not replace persisted geometry with invalid preview');
assert.equal(errorModel.solveStatus, 'error');
assert.equal(errorModel.diagnostics[0]?.code, 'TEST');

assert.equal(buildSketchOverlayModel(null, solvedSnapshot), null);
console.log('M2O O8 Sketch overlay model PASS (document/solver preview isolation + stale/error fallback)');
