import assert from 'node:assert/strict';
import type { CadStableReferenceId } from '../../src/contracts/ids';
import {
  panSketchViewport,
  resetSketchViewportState,
  screenPointToSketchPoint,
  sketchDisplayFrame,
  zoomSketchViewport,
} from '../../src/web/viewport/SketchViewportGeometry';
import {
  resolveSketchWorkplaneProjection,
  sketchPointToModelPoint,
} from '../../src/web/viewport/SketchWorkplaneProjection';

const initialViewport = resetSketchViewportState();
const initialFrame = sketchDisplayFrame(initialViewport);
assert.equal(initialFrame.viewBox, '-50 -50 100 100');
assert.deepEqual(
  screenPointToSketchPoint(initialFrame, { left: 0, top: 0, width: 200, height: 200 }, 100, 100),
  [0, 0],
);
assert.deepEqual(
  screenPointToSketchPoint(initialFrame, { left: 0, top: 0, width: 200, height: 200 }, 180, 100),
  [40, 0],
  'direct drawing must not be limited to the old entity-fit ±11.6 range',
);

const panned = panSketchViewport(
  initialViewport,
  { left: 0, top: 0, width: 200, height: 200 },
  20,
  -30,
);
assert.deepEqual(panned.center, [-10, -15]);
assert.equal(panned.span, 100);

const zoomed = zoomSketchViewport(panned, 0.5, [0, 0]);
assert.deepEqual(zoomed.center, [-5, -7.5]);
assert.equal(zoomed.span, 50);
assert.notEqual(sketchDisplayFrame(zoomed).viewBox, initialFrame.viewBox);

// A geometry commit does not participate in frame calculation at all: keeping
// the same transient viewport state must keep the same frame before/after the
// document changes. This protects M3 direct manipulation from refit jumps.
assert.equal(sketchDisplayFrame(initialViewport).viewBox, initialFrame.viewBox);

const xy = resolveSketchWorkplaneProjection('XY');
assert.equal(xy.kind, 'origin-plane');
assert.deepEqual(sketchPointToModelPoint(xy, [2, 3]), [2, 3, 0]);

const xz = resolveSketchWorkplaneProjection('XZ');
assert.equal(xz.kind, 'origin-plane');
assert.deepEqual(sketchPointToModelPoint(xz, [2, 3]), [2, 0, 3]);

const yz = resolveSketchWorkplaneProjection('YZ');
assert.equal(yz.kind, 'origin-plane');
assert.deepEqual(sketchPointToModelPoint(yz, [2, 3]), [0, 2, 3]);

const stable = resolveSketchWorkplaneProjection('ref_face' as CadStableReferenceId);
assert.equal(stable.kind, 'stable-reference');
assert.equal(stable.modelContextReady, false);
assert.equal(sketchPointToModelPoint(stable, [2, 3]), null);

console.log('ASA-CAD M3.2 direct Line foundation PASS (stable view + pan/zoom + workplanes)');
