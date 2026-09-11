import assert from 'node:assert/strict';
import {
  ViewportCameraController,
  fitDistance,
  type CadViewportViewName,
  type ViewportCameraPose,
  type ViewportCameraState,
} from '../../src/web/viewport/ViewportCameraController';

let state: ViewportCameraState = {
  position: [10, -10, 10],
  target: [0, 0, 0],
  up: [0, 0, 1],
  fovDegrees: 34,
  aspect: 16 / 9,
  minDistance: 0.2,
  maxDistance: 1000,
};
let lastView: CadViewportViewName | null = null;
let pose: ViewportCameraPose | null = null;

const controller = new ViewportCameraController({
  center: [5, 5, 5],
  diagonal: 20,
  readState: () => state,
  applyPose: (view, nextPose) => {
    lastView = view;
    pose = nextPose;
    state = { ...state, ...nextPose };
  },
});

const originalDistance = distance(state.position, state.target);
controller.setView('zoom-in');
assert.equal(lastView, 'zoom-in');
assert.ok(Math.abs(distance(state.position, state.target) - originalDistance * 0.82) < 1e-9);
assert.deepEqual(state.target, [0, 0, 0], 'zoom must preserve target');

const beforePanPosition = state.position;
const beforePanTarget = state.target;
controller.setView('pan-right');
assert.notDeepEqual(state.position, beforePanPosition);
assert.notDeepEqual(state.target, beforePanTarget);
assertVectorClose(
  subtract(state.position, state.target),
  subtract(beforePanPosition, beforePanTarget),
  'pan must preserve camera offset',
);

controller.setView('front');
assert.equal(lastView, 'front');
assert.deepEqual(state.target, [5, 5, 5]);
assert.deepEqual(state.up, [0, 0, 1]);
assert.ok(state.position[1] < state.target[1], 'front view must look from negative Y');

controller.setView('back');
assert.ok(state.position[1] > state.target[1], 'back view must look from positive Y');

controller.setView('top');
assert.deepEqual(state.up, [0, 1, 0]);
assert.ok(state.position[2] > state.target[2], 'top view must look from positive Z');

controller.setView('bottom');
assert.deepEqual(state.up, [0, -1, 0]);
assert.ok(state.position[2] < state.target[2], 'bottom view must look from negative Z');

controller.setView('right');
assert.deepEqual(state.up, [0, 0, 1]);
assert.ok(state.position[0] > state.target[0], 'right view must look from positive X');

controller.setView('isometric');
const isoOffset = subtract(state.position, state.target);
assert.ok(isoOffset[0] > 0 && isoOffset[1] < 0 && isoOffset[2] > 0);
assert.ok(Math.abs(Math.abs(isoOffset[0]) - Math.abs(isoOffset[1])) < 1e-9);
assert.ok(Math.abs(Math.abs(isoOffset[1]) - Math.abs(isoOffset[2])) < 1e-9);

const expectedFit = fitDistance(state, 20);
controller.setView('fit');
assert.ok(Math.abs(distance(state.position, state.target) - expectedFit) < 1e-9);
assert.deepEqual(state.target, [5, 5, 5]);
assert.ok(pose);

console.log('M2O O8 viewport camera PASS (fit/views/zoom/pan math outside Three effect)');

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function subtract(a: readonly number[], b: readonly number[]): readonly [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function assertVectorClose(
  actual: readonly number[],
  expected: readonly number[],
  message: string,
): void {
  for (let index = 0; index < 3; index++) {
    assert.ok(Math.abs(actual[index] - expected[index]) < 1e-9, `${message} at ${index}`);
  }
}
