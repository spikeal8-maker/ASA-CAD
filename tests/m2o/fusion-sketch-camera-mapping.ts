import assert from 'node:assert/strict';
import { createSketchCameraMapping } from '../../src/web/fusion/SketchCameraMapping';
import { resolveSketchWorkplaneProjection, type SketchWorkplaneProjection } from '../../src/web/viewport/SketchWorkplaneProjection';
import type { CameraSnapshot } from '../../src/web/fusion/LiveCameraSnapshot';

type V3 = [number, number, number];
const norm = (a: V3): V3 => [a[0] / Math.hypot(...a), a[1] / Math.hypot(...a), a[2] / Math.hypot(...a)];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Exact ortho fixtures: rigid view (inverse = transpose + eye) and scaled ortho (hand-derived inverse).
function ortho(eye: V3, up: V3, o: { half?: number; aspect?: number; near?: number; far?: number; rect?: CameraSnapshot['rect']; } = {}): CameraSnapshot {
  const h = o.half ?? 37.5, a = o.aspect ?? 4 / 3, n = o.near ?? 1, f = o.far ?? 100, d = f - n;
  const z = norm(eye), x = norm(cross(up, z)), y = cross(z, x);
  const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  const invView = [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, eye[0], eye[1], eye[2], 1];
  const proj = [1 / (a * h), 0, 0, 0, 0, 1 / h, 0, 0, 0, 0, -2 / d, 0, 0, 0, -(f + n) / d, 1];
  const invProj = [a * h, 0, 0, 0, 0, h, 0, 0, 0, 0, -d / 2, 0, 0, 0, -(f + n) / 2, 1];
  const rect = o.rect ?? { left: 80, top: 40, width: 800, height: 600 };
  return { actualProjection: 'orthographic', viewMatrix: view, inverseViewMatrix: invView, projectionMatrix: proj, inverseProjectionMatrix: invProj, rect, devicePixelRatio: 1, revision: 1 };
}

type M = ReturnType<typeof createSketchCameraMapping>;
const ready = (r: M): M & { ready: true } => { if (!r.ready) throw new Error(`expected ready, got ${r.reason}`); return r; };
const ok = <T extends { ok: boolean }>(r: T): T & { ok: true } => { if (!r.ok) throw new Error('expected ok'); return r; };
const frame = (plane: 'XY' | 'XZ' | 'YZ') => { const wp = resolveSketchWorkplaneProjection(plane); if (wp.kind !== 'origin-plane') throw new Error(plane); return wp; };
const reason = (r: M): string => (r.ready ? 'ready' : r.reason);

const RECT = { left: 80, top: 40, width: 800, height: 600 };
// Contract oracle: ortho X+/-50, Y+/-37.5, camera from the normal side, up along v.
const EXP = [[0, 0, 480, 340], [20, 10, 640, 260], [-15, 25, 360, 140]] as const;
for (const plane of ['XY', 'XZ', 'YZ'] as const) {
  const wp = frame(plane);
  const m = ready(createSketchCameraMapping(ortho([wp.normal[0] * 10, wp.normal[1] * 10, wp.normal[2] * 10], [wp.v[0], wp.v[1], wp.v[2]], { rect: RECT }), wp));
  for (const [px, py, ex, ey] of EXP) {
    const r = ok(m.planeToClient(px, py));
    assert.ok(Math.abs(r.x - ex) <= 0.5 && Math.abs(r.y - ey) <= 0.5, `${plane} (${px},${py})->(${r.x},${r.y}) want (${ex},${ey})`);
    const b = ok(m.clientToPlane(r.x, r.y));
    assert.ok(Math.abs(b.x - px) <= 1e-6 && Math.abs(b.y - py) <= 1e-6, `${plane} round-trip (${px},${py})->(${b.x},${b.y})`);
  }
}

const wpXY = frame('XY');
// Tilted/panned ortho camera with offset rect.
const tilt = ortho([30, -25, 20], [0, 1, 0], { half: 40, aspect: 16 / 9, near: 1, far: 20, rect: { left: 10, top: 20, width: 480, height: 270 } });
const tm = ready(createSketchCameraMapping(tilt, wpXY));
const tr = ok(tm.planeToClient(30, -19));
const tb = ok(tm.clientToPlane(tr.x, tr.y));
assert.ok(Math.abs(tb.x - 30) <= 1e-6 && Math.abs(tb.y + 19) <= 1e-6, `tilted round-trip -> (${tb.x},${tb.y})`);
const tr2 = ok(tm.planeToClient(tb.x, tb.y));
assert.ok(Math.abs(tr2.x - tr.x) <= 0.5 && Math.abs(tr2.y - tr.y) <= 0.5, 'forward stability <= 0.5 CSS px');
const P0 = tm.basis.origin, Pu = tm.basis.u, Pv = tm.basis.v;
const ax = P0.x + 30 * (Pu.x - P0.x) - 19 * (Pv.x - P0.x), ay = P0.y + 30 * (Pu.y - P0.y) - 19 * (Pv.y - P0.y);
assert.ok(Math.abs(tr.x - ax) <= 1e-6 && Math.abs(tr.y - ay) <= 1e-6, 'affine basis equals matrix forward');
const assertClipped = (r: { ok: boolean; reason?: string }, msg: string) => {
  assert.equal(r.ok, false, msg);
  if (!r.ok) assert.equal(r.reason, 'clipped');
};
assertClipped(tm.planeToClient(70, 0), 'near/far clipping');
assertClipped(tm.clientToPlane(250, 155), 'plane hit outside camera range');
assertClipped(ready(createSketchCameraMapping(ortho([0, 0, 10], [0, 1, 0], { rect: RECT }), wpXY)).planeToClient(60, 0), 'viewport clipping');

// DPR must not scale CSS coordinates or the plane result.
const baseSnap = ortho([0, 0, 10], [0, 1, 0], { rect: RECT });
const m1 = ready(createSketchCameraMapping(baseSnap, wpXY));
const m2 = ready(createSketchCameraMapping({ ...baseSnap, devicePixelRatio: 2 }, wpXY));
const r1 = ok(m1.planeToClient(7, -4)), r2 = ok(m2.planeToClient(7, -4));
assert.ok(Math.abs(r1.x - r2.x) <= 1e-12 && Math.abs(r1.y - r2.y) <= 1e-12, 'DPR must not change CSS result');
const b1 = ok(m1.clientToPlane(500, 300)), b2 = ok(m2.clientToPlane(500, 300));
assert.ok(Math.abs(b1.x - b2.x) <= 1e-9 && Math.abs(b1.y - b2.y) <= 1e-9, 'DPR must not change plane result');

const snap = ortho([0, 0, 10], [0, 1, 0], { rect: RECT });
const mk = (p: Partial<CameraSnapshot>) => ({ ...snap, ...p });
assert.equal(reason(createSketchCameraMapping(null, wpXY)), 'missing-camera');
const wpRef: SketchWorkplaneProjection = { kind: 'stable-reference', support: 'face-1' as never, modelContextReady: false };
assert.equal(reason(createSketchCameraMapping(snap, wpRef)), 'unresolved-plane');
assert.equal(reason(createSketchCameraMapping(mk({ actualProjection: 'perspective' }), wpXY)), 'unsupported-projection');
assert.equal(reason(createSketchCameraMapping(mk({ rect: { ...RECT, width: 0 } }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ rect: { ...RECT, left: NaN } }), wpXY)), 'invalid-input');
assert.equal(reason(createSketchCameraMapping(mk({ devicePixelRatio: 0 }), wpXY)), 'invalid-input');
const badView = [...snap.viewMatrix]; badView[0] = NaN;
assert.equal(reason(createSketchCameraMapping(mk({ viewMatrix: badView }), wpXY)), 'invalid-input');
const badInv = [...snap.inverseProjectionMatrix]; badInv[0] = 2;
assert.equal(reason(createSketchCameraMapping(mk({ inverseProjectionMatrix: badInv }), wpXY)), 'invalid-input');

// Edge-on: YZ plane with a camera along its normal -> normalized parallel ray.
const em = ready(createSketchCameraMapping(ortho([0, 0, 10], [0, 1, 0], { rect: RECT }), frame('YZ')));
const eo = em.clientToPlane(480, 340);
assert.equal(eo.ok, false, 'edge-on normalized threshold');
if (!eo.ok) assert.equal(eo.reason, 'unavailable');
assert.equal(em.planeToClient(5, 0).ok, true, 'edge-on forward ok');

// Homogeneous division: w = 0.1*viewZ + 1 hits w = 0 exactly at the origin (viewZ = -10).
const weird = [...snap.projectionMatrix];
weird[11] = 0.1;
const weirdInv = [50, 0, 0, 0, 0, 37.5, 0, 0, 0, 0, 110 / 9, -11 / 9, 0, 0, 1010 / 81, -20 / 81];
assert.equal(reason(createSketchCameraMapping(mk({ projectionMatrix: weird, inverseProjectionMatrix: weirdInv }), wpXY)), 'degenerate-view', 'w = 0 must reject');

const mf = ready(createSketchCameraMapping(snap, wpXY));
const nf = mf.planeToClient(NaN, 5), ci = mf.clientToPlane(Infinity, 3);
assert.equal(nf.ok, false, 'non-finite input');
if (!nf.ok) assert.equal(nf.reason, 'invalid-input');
assert.equal(ci.ok, false, 'non-finite input');
if (!ci.ok) assert.equal(ci.reason, 'invalid-input');

// Revision and immutability.
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
