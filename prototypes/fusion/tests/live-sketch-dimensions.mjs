import assert from 'node:assert/strict';
import { tsImport } from '../../../vendor/toubkal/node_modules/tsx/dist/esm/api/index.mjs';

const { sketchLineDimensionLayout } = await tsImport('../live/sketchDimensionLayout.ts', import.meta.url);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${label}: ${actual} != ${expected}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const line = (from, to) => ({ id: 'line_a', type: 'line', data: { from, to } });
const dimension = type => ({ id: 'dimension_a', type, entityIds: ['line_a'], value: 60, driving: true });
const horizontal = line([0, 0], [60, 0]);

for (const unit of [.05, .2, 1, 100]) {
  const result = sketchLineDimensionLayout(dimension('linear'), horizontal, unit);
  assert.ok(result);
  near(distance(...result.arrowHeads.map(points => points[0])), 60,
    'Arrow tips measure the actual solved line at every zoom');
  near(result.arrowHeads[0][0][1] / unit, 54, 'Reference automatic line offset stays 54 CSS pixels');
  near(distance(result.extensionLines[0].from, result.measuredFrom) / unit, 8,
    'Witness gap stays eight CSS pixels');
  near(distance(result.extensionLines[0].to, result.arrowHeads[0][0]) / unit, 8,
    'Witness overhang stays eight CSS pixels');
  for (const points of result.arrowHeads) {
    near(distance(points[1], points[2]) / unit, 5, 'Arrow width stays five CSS pixels');
    const base = [(points[1][0] + points[2][0]) / 2, (points[1][1] + points[2][1]) / 2];
    near(distance(points[0], base) / unit, 9, 'Arrow length stays nine CSS pixels');
  }
  near(result.label.angle, 0, 'Horizontal text is upright');
  assert.deepEqual(result, sketchLineDimensionLayout(dimension('linear'), line([60, 0], [0, 0]), unit),
    'Reversing stored endpoints does not flip or move the dimension');
}

// A tilted line gives three genuinely different measurements: length 5, X 3, Y 4.
// Deliberately unrelated driving value 60 must never invent new geometry here.
const tilted = line([2, 3], [5, 7]);
for (const [kind, expectedLength] of [['linear', 5], ['horizontal', 3], ['vertical', 4]]) {
  const result = sketchLineDimensionLayout(dimension(kind), tilted, .1);
  assert.ok(result);
  near(distance(...result.arrowHeads.map(points => points[0])), expectedLength,
    `${kind} uses solved endpoints, not the unsolved target value`);
  assert.deepEqual(result, sketchLineDimensionLayout(dimension(kind), line([5, 7], [2, 3]), .1),
    `${kind} is independent of endpoint order`);
  if (kind === 'horizontal') {
    near(result.dimensionLine.from[1], result.dimensionLine.to[1], 'X projection is horizontal');
    for (let index = 0; index < 2; index++) {
      near(result.extensionLines[index].from[0], result.extensionLines[index].to[0],
        'Horizontal witnesses stay parallel to Y');
    }
  }
  if (kind === 'vertical') {
    near(result.dimensionLine.from[0], result.dimensionLine.to[0], 'Y projection is vertical');
    near(result.label.angle, -90, 'Vertical number reads from bottom to top');
    for (let index = 0; index < 2; index++) {
      near(result.extensionLines[index].from[1], result.extensionLines[index].to[1],
        'Vertical witnesses stay parallel to X');
    }
  }
}

const vertical = sketchLineDimensionLayout(dimension('linear'), line([-20, -10], [-20, 30]), .2);
near(vertical.label.angle, -90, 'An aligned vertical length is also readable');
assert.ok(vertical.dimensionLine.from[0] > -20, 'Default vertical placement lies outside to the right');
near(distance(...vertical.arrowHeads.map(points => points[0])), 40, 'Vertical aligned length is forty');
const short = sketchLineDimensionLayout(dimension('linear'), line([0, 0], [1, 0]), 1);
assert.equal(short.arrowsOutside, true);
assert.ok(short.arrowHeads[0][1][0] < short.arrowHeads[0][0][0]);
assert.ok(short.arrowHeads[1][1][0] > short.arrowHeads[1][0][0]);
near(distance(...short.arrowHeads.map(points => points[0])), 1,
  'Outside arrows retain exact witness tips for a very short line');

for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.equal(sketchLineDimensionLayout(dimension('linear'), horizontal, invalid), null);
}
for (const entity of [line([0, 0], [0, 0]), line([Number.NaN, 0], [1, 1]),
  { id: 'line_a', type: 'circle', data: { center: [0, 0], diameter: 12 } }]) {
  assert.equal(sketchLineDimensionLayout(dimension('linear'), entity, .1), null,
    'Unsupported or degenerate geometry uses the descriptive fallback');
}
for (const input of [dimension('radius'), dimension('angular'),
  { ...dimension('linear'), entityIds: ['line_a', 'line_b'] },
  { ...dimension('linear'), entityIds: ['other_line'] }]) {
  assert.equal(sketchLineDimensionLayout(input, horizontal, .1), null,
    'An annotation must not assume unsupported entity-reference semantics');
}
assert.equal(sketchLineDimensionLayout(dimension('vertical'), horizontal, .1), null,
  'Zero directional projection never manufactures a dimension line');

const frozenEntity = Object.freeze({ ...tilted, data: Object.freeze({ from: Object.freeze([2, 3]), to: Object.freeze([5, 7]) }) });
const frozenDimension = Object.freeze({ ...dimension('linear'), entityIds: Object.freeze(['line_a']) });
const before = JSON.stringify([frozenEntity, frozenDimension]);
sketchLineDimensionLayout(frozenDimension, frozenEntity, .25);
assert.equal(JSON.stringify([frozenEntity, frozenDimension]), before, 'Annotation layout never mutates CAD intent');
console.log(JSON.stringify({ status: 'PASS', scope: 'Solved line dimension presentation',
  alignedAndDirectionalProjection: true, reversedEndpointOrder: true, screenSizedAnnotation: true,
  outsideArrowsPreserveMeasurement: true, unsupportedReferencesUseFallback: true,
  documentUnchanged: true, nativeVisualParity: 'NOT_ASSERTED' }));
