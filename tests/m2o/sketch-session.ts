import assert from 'node:assert/strict';
import {
  createCadId,
  createEmptyCadDocument,
  type CadSketchId,
} from '../../src';
import {
  activateSketch,
  clearSketchSession,
  createSketchSessionState,
  reconcileSketchSession,
  resolveActiveSketch,
} from '../../src/web/SketchSession';

const part = createEmptyCadDocument('part', { title: 'SketchSession test' });
const sketchA = createCadId<CadSketchId>('sketch');
const sketchB = createCadId<CadSketchId>('sketch');
part.sketches.push(
  { id: sketchA, name: 'Sketch A', support: 'XY', entities: [], constraintIds: [], dimensionIds: [] },
  { id: sketchB, name: 'Sketch B', support: 'XY', entities: [], constraintIds: [], dimensionIds: [] },
);

let state = createSketchSessionState();
assert.equal(state.activeSketchId, null, 'opening a Part must not implicitly activate the latest Sketch');
assert.equal(resolveActiveSketch(part, state.activeSketchId), null);

state = activateSketch(state, sketchA);
assert.equal(state.activeSketchId, sketchA);
assert.equal(resolveActiveSketch(part, state.activeSketchId)?.id, sketchA, 'explicit Sketch A selection must win even when Sketch B is newer');

state = activateSketch(state, sketchB);
assert.equal(resolveActiveSketch(part, state.activeSketchId)?.id, sketchB);

part.sketches.splice(1, 1);
state = reconcileSketchSession(state, part);
assert.equal(state.activeSketchId, null, 'undo/delete/document replacement must invalidate a missing active Sketch');

state = activateSketch(state, sketchA);
state = clearSketchSession(state);
assert.equal(state.activeSketchId, null);

console.log('M2O SketchSession PASS (explicit activeSketchId + no implicit latest Sketch)');
