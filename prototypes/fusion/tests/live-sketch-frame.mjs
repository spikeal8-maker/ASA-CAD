import assert from 'node:assert/strict';
import { tsImport } from '../../../vendor/toubkal/node_modules/tsx/dist/esm/api/index.mjs';

const { sketchFrameForScreen, sketchGridStep, sketchGridTicks, sketchDisplayOverlay,
  sketchPointMarks, resolveSketchSnap } = await tsImport('../live/sketchPresentation.ts', import.meta.url);
const { sketchDisplayFrame, screenPointToSketchPoint, panSketchViewport, zoomSketchViewport } =
  await tsImport('../../../src/web/viewport/SketchViewportGeometry.ts', import.meta.url);
const near = (actual, expected, message) => assert.ok(
  Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
  `${message}: ${actual} != ${expected}`,
);
const pointNear = (actual, expected, message) => {
  assert.ok(actual, `${message}: pointer was rejected`);
  near(actual[0], expected[0], `${message} x`);
  near(actual[1], expected[1], `${message} y`);
};

const sizes = [[2048, 948], [1600, 711], [1366, 579], [320, 48], [48, 320],
  [8, 5], [5120, 600], [600, 5120], [700, 700]];
const state = { center: [13, -7], span: 160 };
for (const [width, height] of sizes) {
  const rect = { left: 37, top: 118, width, height };
  const frame = sketchFrameForScreen(state, rect);
  const scale = Math.min(width, height) / state.span;
  near(width / frame.width, scale, 'X preserves existing short-edge scale');
  near(height / frame.height, scale, 'Y preserves existing short-edge scale');
  near(frame.width / frame.height, width / height, 'Frame fills the screen aspect ratio');
  near((frame.minX + frame.maxX) / 2, state.center[0], 'Centered X frame');
  near(-(frame.minY + frame.maxY) / 2, state.center[1], 'Centered Y frame');

  // All four screen corners are usable, including the former letterbox zones.
  for (const [fx, fy] of [[.01, .01], [.99, .01], [.01, .99], [.99, .99]]) {
    pointNear(screenPointToSketchPoint(frame, rect, rect.left + width * fx, rect.top + height * fy),
      [state.center[0] + width * (fx - .5) / scale, state.center[1] - height * (fy - .5) / scale],
      `Corner ${width}x${height} ${fx},${fy}`);
  }

  // Existing central drawing coordinates and a circle's two radii remain equal.
  for (const [dx, dy] of [[0, 0], [10, 10], [-10, -10]]) {
    const x = rect.left + width / 2 + dx * scale, y = rect.top + height / 2 - dy * scale;
    const previous = screenPointToSketchPoint(sketchDisplayFrame(state), rect, x, y);
    pointNear(screenPointToSketchPoint(frame, rect, x, y), previous, 'Old center coordinates');
  }
  near(12 * width / frame.width, 12 * height / frame.height, 'Circle radius stays isotropic');

  const pixel = [rect.left + width * .12, rect.top + height * .87];
  const anchor = screenPointToSketchPoint(frame, rect, ...pixel);
  assert.ok(anchor);
  const zoomed = zoomSketchViewport(state, .65, anchor);
  pointNear(screenPointToSketchPoint(sketchFrameForScreen(zoomed, rect), rect, ...pixel), anchor,
    'Wheel zoom preserves an anchor outside the old square');

  const delta = [Math.min(17, width * .2), -Math.min(29, height * .2)];
  const panned = panSketchViewport(state, rect, ...delta);
  pointNear(screenPointToSketchPoint(sketchFrameForScreen(panned, rect), rect,
    rect.left + width / 2 + delta[0], rect.top + height / 2 + delta[1]), state.center,
    'Existing pan moves content by the pointer delta');
}

const wide = { left: 0, top: 0, width: 2048, height: 948 };
assert.equal(screenPointToSketchPoint(sketchDisplayFrame(state), wide, 100, 400), null,
  'The regression fixture must be outside the previous square');
assert.ok(screenPointToSketchPoint(sketchFrameForScreen(state, wide), wide, 100, 400));
for (const size of [{ width: 0, height: 600 }, { width: 800, height: 0 },
  { width: Number.NaN, height: 600 }, { width: 800, height: Number.POSITIVE_INFINITY }]) {
  assert.deepEqual(sketchFrameForScreen(state, size), sketchDisplayFrame(state),
    'A hidden or unmeasured stage keeps the valid product frame');
}
assert.deepEqual(state, { center: [13, -7], span: 160 }, 'Presentation never mutates camera intent');

// Grid density follows actual CSS scale, while the labels remain real model coordinates.
for (const [width, height] of sizes) {
  for (const span of [0.001, 100, 160, 100000]) {
    const step = sketchGridStep(span, Math.min(width, height));
    const pitch = step * Math.min(width, height) / span;
    assert.ok(pitch >= 18.8 && pitch <= 37.8, 'Adaptive minor grid stays near the native 26.7 px density');
    const ticks = sketchGridTicks(-span, span, step);
    assert.ok(ticks.length < 600, 'Grid density is bounded even on tall or wide screens');
    for (let index = 1; index < ticks.length; index += 1) near(ticks[index].value - ticks[index - 1].value, step, 'Uniform grid ticks');
    const major = ticks.filter(tick => tick.major);
    for (let index = 1; index < major.length; index += 1) near(major[index].value - major[index - 1].value, step * 5, 'One major line per five minor intervals');
  }
}
const nativeScale = 133.6 / 25;
near(sketchGridStep(946 / nativeScale, 946), 5, 'Native reference scale produces truthful 5-unit minor ticks');
near(sketchGridStep(100, 946), 2.5, 'Existing span 100 retains the honest, distinct starting zoom');
assert.deepEqual(sketchGridTicks(-.3, .3, .1).map(tick => tick.value), [-.3, -.2, -.1, 0, .1, .2, .3],
  'Fractional boundary ticks do not disappear through floating-point drift');

// Display filtering keeps the single solver's objects; hidden construction cannot be selected or snapped.
const source = Object.freeze({ sketchId: 'sketch_field', source: 'solver-preview', solveStatus: 'solved',
  constraintState: 'under-constrained', degreesOfFreedom: 7, diagnostics: Object.freeze([]), entities: Object.freeze([
    Object.freeze({ id: 'entity_visible', type: 'line', data: Object.freeze({ from: [10, 12], to: [16, 18] }) }),
    Object.freeze({ id: 'entity_construction', type: 'line', data: Object.freeze({ from: [3.2, 4.3], to: [7.2, 8.3], construction: true }) }),
    Object.freeze({ id: 'entity_circle', type: 'circle', data: Object.freeze({ center: [20, 20], diameter: 10 }) }),
  ]) });
const original = JSON.stringify(source);
assert.equal(sketchDisplayOverlay(source, true), source, 'Showing construction returns the existing overlay');
const visible = sketchDisplayOverlay(source, false);
assert.deepEqual(visible.entities.map(entity => entity.id), ['entity_visible', 'entity_circle']);
assert.equal(visible.entities[0], source.entities[0], 'Visible geometry keeps solver entity identity');
assert.equal(visible.entities[1], source.entities[2], 'Circles keep solver entity identity');
assert.equal(visible.diagnostics, source.diagnostics, 'Solver diagnostics remain the same object');
assert.equal(visible.degreesOfFreedom, source.degreesOfFreedom, 'Display filtering never changes solve state');
assert.ok(sketchPointMarks(visible.entities).every(mark => mark.entityId !== 'entity_construction'));
assert.equal(resolveSketchSnap([3.2, 4.3], source.entities, 5, .1, true)?.entityId, 'entity_construction');
assert.equal(resolveSketchSnap([3.2, 4.3], visible.entities, 5, .1, true), null, 'Hidden construction is absent from the same snap input');
assert.equal(JSON.stringify(source), original, 'Filtering never mutates the source overlay');
assert.equal(sketchDisplayOverlay(visible, false), visible, 'A redundant filter retains its existing view');
assert.equal(sketchDisplayOverlay(null, false), null);
console.log(JSON.stringify({ status: 'PASS', scope: 'Sketch frame and shared pointer geometry',
  screenSizes: sizes.length, fullArea: true, isotropic: true, centralCoordinatesPreserved: true,
  wheelAnchorPreserved: true, panPreserved: true, adaptiveGrid: true, truthfulMajorTicks: true,
  constructionDisplayPreservesSolver: true, nativeVisualParity: 'NOT_ASSERTED' }));
