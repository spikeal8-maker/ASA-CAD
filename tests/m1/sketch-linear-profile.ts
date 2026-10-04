import assert from 'node:assert/strict';
import type {
  CadPoint2,
  CadSketch,
  CadSketchLineEntity,
} from '../../src/contracts/document';
import type {
  CadSketchEntityId,
  CadSketchId,
} from '../../src/contracts/ids';
import { buildClosedLinearProfile } from '../../src/application/SketchLinearProfile';

function line(id: string, from: CadPoint2, to: CadPoint2): CadSketchLineEntity {
  return {
    id: id as CadSketchEntityId,
    type: 'line',
    data: { from, to },
  };
}

function sketch(name: string, lines: CadSketchLineEntity[]): CadSketch {
  return {
    id: `sketch_${name}` as CadSketchId,
    name,
    support: 'XY',
    entities: lines,
    constraintIds: [],
    dimensionIds: [],
  };
}

const rectangle = buildClosedLinearProfile(sketch('rectangle', [
  line('r0', [0, 0], [60, 0]),
  line('r1', [60, 0], [60, 40]),
  line('r2', [60, 40], [0, 40]),
  line('r3', [0, 40], [0, 0]),
]));
assert.equal(rectangle.points.length, 4);
assert.equal(rectangle.area, 2400);

const lShape = buildClosedLinearProfile(sketch('l-shape', [
  line('l0', [0, 0], [60, 0]),
  line('l1', [60, 0], [60, 20]),
  line('l2', [60, 20], [20, 20]),
  line('l3', [20, 20], [20, 40]),
  line('l4', [20, 40], [0, 40]),
  line('l5', [0, 40], [0, 0]),
]));
assert.equal(lShape.points.length, 6);
assert.equal(lShape.area, 1600);

assert.throws(
  () => buildClosedLinearProfile(sketch('open', [
    line('o0', [0, 0], [40, 0]),
    line('o1', [40, 0], [40, 20]),
    line('o2', [40, 20], [0, 20]),
  ])),
  /connected closed contour|does not close/i,
);

assert.throws(
  () => buildClosedLinearProfile(sketch('self-intersection', [
    line('s0', [0, 0], [40, 40]),
    line('s1', [40, 40], [0, 40]),
    line('s2', [0, 40], [40, 0]),
    line('s3', [40, 0], [0, 0]),
  ])),
  /self-intersects/i,
);

console.log('ASA-CAD linear profile validation PASS (rectangle + concave L + invalid contours)');
