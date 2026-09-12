import assert from 'node:assert/strict';
import type { CadSketchEntity, CadStableReferenceId } from '../../src/contracts/document';
import {
  screenPointToSketchPoint,
  sketchDisplayFrame,
} from '../../src/web/viewport/SketchViewportGeometry';
import {
  resolveSketchWorkplaneProjection,
  sketchPointToModelPoint,
} from '../../src/web/viewport/SketchWorkplaneProjection';

const empty = sketchDisplayFrame([]);
assert.equal(empty.viewBox, '-11.6 -11.6 23.2 23.2');
assert.deepEqual(
  screenPointToSketchPoint(empty, { left: 0, top: 0, width: 232, height: 232 }, 116, 116),
  [0, 0],
);

const line: CadSketchEntity = {
  id: 'entity_line' as never,
  type: 'line',
  data: { from: [-8, -4], to: [10, 6] },
};
const lineFrame = sketchDisplayFrame([line]);
assert.ok(lineFrame.width > 18);
assert.ok(lineFrame.height > 10);

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

console.log('ASA-CAD M3.2 direct Line foundation PASS');
