import assert from 'node:assert/strict';
import { createCadId, type CadSketch, type CadSketchEntity, type CadSketchEntityId, type CadSketchId } from '../../src';
import { analyzeSketchProfile, buildSketchProfile } from '../../src/application/SketchProfile';

type P = readonly [number, number];
const id = () => createCadId<CadSketchEntityId>('entity');
const line = (from: P, to: P, construction = false): CadSketchEntity => ({ id: id(), type: 'line', data: { from, to, ...(construction ? { construction } : {}) } });
const arc = (center: P, radius: number, startAngle: number, endAngle: number): CadSketchEntity => ({ id: id(), type: 'arc', data: { center, radius, startAngle, endAngle } });
const circle = (center: P, diameter: number): CadSketchEntity => ({ id: id(), type: 'circle', data: { center, diameter } });
const polygon = (points: P[]) => points.map((p, i) => line(p, points[(i + 1) % points.length]));
const sketch = (entities: CadSketchEntity[]): CadSketch => ({
  id: createCadId<CadSketchId>('sketch'), name: 'Эскиз', support: 'XY', entities, constraintIds: [], dimensionIds: [],
});
const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
const reason = (entities: CadSketchEntity[]) => {
  const result = analyzeSketchProfile(sketch(entities));
  assert.equal(result.ok, false, 'invalid profile was accepted');
  return result.ok ? '' : result.reason;
};

// Rectangle (shuffled, mixed directions) and L-shape.
const rect = polygon([[-30, -20], [30, -20], [30, 20], [-30, 20]]);
near(buildSketchProfile(sketch([rect[2], rect[0], line([-30, 20], [-30, -20]), rect[1]])).area, 2400, 1e-9, 'rectangle area');
const lShape = buildSketchProfile(sketch(polygon([[0, 0], [40, 0], [40, 10], [10, 10], [10, 30], [0, 30]])));
near(lShape.area, 40 * 10 + 10 * 20, 1e-9, 'L area');
assert.equal(lShape.outer.segments.length, 6);
assert.equal(lShape.holes.length, 0);

// Construction lines are ignored.
near(buildSketchProfile(sketch([...rect, line([-30, -20], [30, 20], true)])).area, 2400, 1e-9, 'construction ignored');

// Slot: two lines + two arcs (true area 20*10 + π*5²).
const slot = buildSketchProfile(sketch([
  line([0, -5], [20, -5]),
  arc([20, 0], 5, -Math.PI / 2, Math.PI / 2),
  line([20, 5], [0, 5]),
  arc([0, 0], 5, Math.PI / 2, (3 * Math.PI) / 2),
]));
near(slot.area, 200 + Math.PI * 25, 0.2, 'slot area (outline approximation)');
assert.deepEqual(slot.outer.segments.map((segment) => segment.kind).sort(), ['arc', 'arc', 'line', 'line']);

// Circle and rectangle with a circular hole.
near(buildSketchProfile(sketch([circle([5, 5], 12)])).area, Math.PI * 36, 1e-9, 'circle area');
const plate = buildSketchProfile(sketch([...rect, circle([0, 0], 12)]));
assert.equal(plate.holes.length, 1);
assert.ok(plate.outer.circle === undefined, 'outer contour must be the rectangle');
near(plate.area, 2400 - Math.PI * 36, 1e-9, 'plate with hole area');

// Fail-closed reasons shown to the user.
assert.match(reason([]), /эскиз пуст/);
assert.match(reason(rect.slice(0, 3)), /не замкнут/);
assert.match(reason(polygon([[0, 0], [20, 20], [20, 0], [0, 20]])), /пересекает сам себя/);
assert.match(reason([...rect, ...polygon([[100, 0], [110, 0], [110, 10]])]), /один внешний контур, найдено 2/);
assert.match(reason([...rect, circle([30, 0], 10)]), /пересекаются/);
assert.match(reason([...rect, circle([0, 0], 30), circle([0, 0], 10)]), /вложенные острова/);
assert.match(reason([...rect, line([30, 20], [40, 30])]), /свободный конец|ветвится/);

console.log('ASA-CAD sketch profile PASS (lines/arcs/circles, holes, fail-closed reasons)');
