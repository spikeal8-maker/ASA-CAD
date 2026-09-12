import assert from 'node:assert/strict';
import {
  DEFAULT_SKETCH_WORKPLANE,
  sketchPointDistance,
  sketchPointToSvg,
  sketchWorkplaneViewBox,
  svgPointToSketch,
} from '../../src/web/viewport/SketchWorkplane';

assert.deepEqual(DEFAULT_SKETCH_WORKPLANE, {
  minX: -100,
  minY: -75,
  width: 200,
  height: 150,
});
assert.equal(sketchWorkplaneViewBox(), '-100 -75 200 150');

const point = [23.5, -14.25] as const;
const svg = sketchPointToSvg(point);
assert.deepEqual(svg, [23.5, 14.25]);
assert.deepEqual(svgPointToSketch(svg), point, 'Sketch/SVG coordinate transform must round-trip');
assert.equal(sketchPointDistance([0, 0], [3, 4]), 5);

console.log('M3.2 Line workplane PASS (stable authoring transform + coordinate round-trip)');
