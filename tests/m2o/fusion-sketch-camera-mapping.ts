import assert from 'node:assert/strict';
import { createSketchCameraMapping } from '../../src/web/fusion/SketchCameraMapping';
import { resolveSketchWorkplaneProjection, type SketchWorkplaneProjection } from '../../src/web/viewport/SketchWorkplaneProjection';
import type { CameraSnapshot } from '../../src/web/fusion/LiveCameraSnapshot';

type V3 = readonly [number, number, number];
const norm = (a: V3): V3 => a.map(c => c / Math.hypot(...a)) as V3;
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Exact ortho fixtures: rigid view, hand-derived inverse.
const RECT = { left: 80, top: 40, width: 800, height: 600 };
function ortho(eye: V3, up: V3, h = 37.5, a = 4 / 3, n = 1, f = 100, rect = RECT): CameraSnapshot {
  const d = f - n;
  const z = norm(eye), x = norm(cross(up, z)), y = cross(z, x);
  const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  const invView = [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, eye[0], eye[1], eye[2], 1];
  const proj = [1 / (a * h), 0, 0, 0, 0, 1 / h, 0, 0, 0, 0, -2 / d, 0, 0, 0, -(f + n) / d, 1];
  const invProj = [a * h, 0, 0, 0, 0, h, 0, 0, 0, 0, -d / 2, 0, 0, 0, -(f + n) / 2, 1];
  return { actualProjection: 'orthographic', viewMatrix: view, inverseViewMatrix: invView, projectionMatrix: proj, inverseProjectionMatrix: invProj, rect, devicePixelRatio: 1, revision: 1 };
}

type M = ReturnType<typeof createSketchCameraMapping>;
const ready = (r: M): M & { ready: true } => { if (!r.ready) throw new Error('ready?'); return r; };
const ok = <T extends { ok: boolean }>(r: T): T & { ok: true } => { if (!r.ok) throw new Error('ok'); return r; };
const frame = (plane: 'XY' | 'XZ' | 'YZ') => { const wp = resolveSketchWorkplaneProjection(plane); if (wp.kind !== 'origin-plane') throw new Error(plane); return wp; };
const reason = (r: M): string => (r.ready ? 'ready' : r.reason);

// Contract oracle for all three planes.
const EXP = [[0, 0, 480, 340], [20, 10, 640, 260], [-15, 25, 360, 140]] as const;
for (const plane of ['XY', 'XZ', 'YZ'] as const) {
  const wp = frame(plane);
  const m = ready(createSketchCameraMapping(ortho([wp.normal[0] * 10, wp.normal[1] * 10, wp.normal[2] * 10], wp.v), wp));
  for (const [px, py, ex, ey] of EXP) {
    const r = ok(m.planeToClient(px, py));
    assert.ok(Math.abs(r.x - ex) <= 0.5 && Math.abs(r.y - ey) <= 0.5, `${plane} fwd (${px},${py})`);
    const b = ok(m.clientToPlane(r.x, r.y));
    assert.ok(Math.abs(b.x - px) <= 1e-6 && Math.abs(b.y - py) <= 1e-6, `${plane} inv (${px},${py})`);
  }
}

const wpXY = frame('XY');
const tilt = ortho([30, -25, 20], [0, 1, 0], 40, 16 / 9, 1, 20, { left: 10, top: 20, width: 480, height: 270 });
const tm = ready(createSketchCameraMapping(tilt, wpXY));
const tr = ok(tm.planeToClient(30, -19));
const tb = ok(tm.clientToPlane(tr.x, tr.y));
assert.ok(Math.abs(tb.x - 30) <= 1e-6 && Math.abs(tb.y + 19) <= 1e-6, 'tilted round-trip');
const tr2 = ok(tm.planeToClient(tb.x, tb.y));
assert.ok(Math.abs(tr2.x - tr.x) <= 0.5 && Math.abs(tr2.y - tr.y) <= 0.5, 'forward stability');
const P0 = tm.basis.origin, Pu = tm.basis.u, Pv = tm.basis.v;
const ax = P0.x + 30 * (Pu.x - P0.x) - 19 * (Pv.x - P0.x), ay = P0.y + 30 * (Pu.y - P0.y) - 19 * (Pv.y - P0.y);
assert.ok(Math.abs(tr.x - ax) <= 1e-6 && Math.abs(tr.y - ay) <= 1e-6, 'affine = matrix forward');
const assertClipped = (r: { ok: boolean; reason?: string }, msg: string) => {
  assert.equal(r.ok, false, msg);
  if (!r.ok) assert.equal(r.reason, 'clipped');
};
assertClipped(tm.planeToClient(70, 0), 'near/far clipping');
assertClipped(tm.clientToPlane(250, 155), 'plane hit outside camera range');
const vc = ready(createSketchCameraMapping(ortho([0, 0, 10], [0, 1, 0]), wpXY));
assertClipped(vc.planeToClient(60, 0), 'viewport clipping');
assertClipped(vc.planeToClient(52.5, 0), 'outside-rect forward clipped');
assertClipped(vc.clientToPlane(900, 340), 'outside-rect inverse clipped');

const baseSnap = ortho([0, 0, 10], [0, 1, 0]);
const m1 = ready(createSketchCameraMapping(baseSnap, wpXY));
const m2 = ready(createSketchCameraMapping({ ...baseSnap, devicePixelRatio: 2 }, wpXY));
const r1 = ok(m1.planeToClient(7, -4)), r2 = ok(m2.planeToClient(7, -4));
assert.ok(Math.abs(r1.x - r2.x) <= 1e-12 && Math.abs(r1.y - r2.y) <= 1e-12, 'DPR CSS invariant');
const b1 = ok(m1.clientToPlane(500, 300)), b2 = ok(m2.clientToPlane(500, 300));
assert.ok(Math.abs(b1.x - b2.x) <= 1e-9 && Math.abs(b1.y - b2.y) <= 1e-9, 'DPR plane invariant');

const snap = ortho([0, 0, 10], [0, 1, 0]);
const mk = (p: Partial<CameraSnapshot>) => ({ ...snap, ...p });
assert.equal(reason(createSketchCameraMapping(null, wpXY)), 'missing-camera');
const wpRef = { kind: 'stable-reference', support: 'face-1' as never, modelContextReady: false } as const;
assert.equal(reason(createSketchCameraMapping(snap, wpRef)), 'unresolved-plane');
assert.equal(reason(createSketchCameraMapping(mk({ actualProjection: 'perspective' }), wpXY)), 'unsupported-projection');
assert.equal(reason(createSketchCameraMapping(mk({ rect: { ...RECT, width: 0 } }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ rect: { ...RECT, left: NaN } }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ rect: { ...RECT, width: Infinity, height: Infinity } }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ devicePixelRatio: 0 }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ devicePixelRatio: Infinity }), wpXY)), 'invalid-input');
const badView = [...snap.viewMatrix]; badView[0] = NaN;
assert.equal(reason(createSketchCameraMapping(mk({ viewMatrix: badView }), wpXY)), 'invalid-input');
const badInv = [...snap.inverseProjectionMatrix]; badInv[0] = 2;
assert.equal(reason(createSketchCameraMapping(mk({ inverseProjectionMatrix: badInv }), wpXY)), 'invalid-input');

// Edge-on YZ: normalized parallel ray.
const em = ready(createSketchCameraMapping(ortho([0, 0, 10], [0, 1, 0]), frame('YZ')));
const eo = em.clientToPlane(480, 340);
assert.equal(eo.ok, false, 'edge-on parallel');
if (!eo.ok) assert.equal(eo.reason, 'unavailable');
assert.equal(em.planeToClient(5, 0).ok, true, 'edge-on forward ok');

// w = 0 homogeneous division at the basis points.
const weird = [...snap.projectionMatrix];
weird[11] = 0.1;
const weirdInv = [50, 0, 0, 0, 0, 37.5, 0, 0, 0, 0, 110 / 9, -11 / 9, 0, 0, 1010 / 81, -20 / 81];
assert.equal(reason(createSketchCameraMapping(mk({ projectionMatrix: weird, inverseProjectionMatrix: weirdInv }), wpXY)), 'degenerate-view', 'w=0');

// Near-plane regression: point between near plane and camera is clipped both ways.
const wpN: SketchWorkplaneProjection = { kind: 'origin-plane', support: 'XY', origin: [0, 0, 9.5], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1], modelContextReady: true };
assertClipped(ready(createSketchCameraMapping(snap, wpN)).planeToClient(0, 0), 'near-plane point clipped');
assertClipped(ready(createSketchCameraMapping(snap, wpN)).clientToPlane(480, 340), 'near-plane inverse clipped');

const mf = ready(createSketchCameraMapping(snap, wpXY));
const nf = mf.planeToClient(NaN, 5), ci = mf.clientToPlane(Infinity, 3);
assert.equal(nf.ok, false, 'non-finite input');
if (!nf.ok) assert.equal(nf.reason, 'invalid-input');
assert.equal(ci.ok, false, 'non-finite input');
if (!ci.ok) assert.equal(ci.reason, 'invalid-input');

const beforeRect = { ...snap.rect }, beforeView = [...snap.viewMatrix];
const rev = ready(createSketchCameraMapping({ ...snap, revision: 7 }, wpXY));
assert.equal(rev.revision, 7);
assert.equal(mf.revision, 1, 'old revision kept');
const rb = ok(mf.planeToClient(3, 2)), rr = ok(rev.planeToClient(3, 2));
assert.ok(Math.abs(rb.x - rr.x) <= 1e-12, 'old result preserved');
assert.ok(Object.isFrozen(mf) && Object.isFrozen(mf.basis), 'immutable');
assert.deepEqual(snap.rect, beforeRect, 'rect untouched');
assert.deepEqual(snap.viewMatrix, beforeView, 'view untouched');
console.log('M2O O8 sketch camera mapping PASS');
