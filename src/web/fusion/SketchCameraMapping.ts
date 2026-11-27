// Pure Sketch workplane <-> CSS client mapping from one A03 CameraSnapshot (orthographic-only).
import type { CameraSnapshot } from './LiveCameraSnapshot';
import type { SketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';

export type SketchCameraMappingReason = 'missing-camera' | 'unresolved-plane' | 'unsupported-projection' | 'invalid-input' | 'degenerate-view' | 'clipped' | 'unavailable';
export type ClientPoint = { x: number; y: number };
export type PlaneToClientResult = { ok: true } & ClientPoint | { ok: false; reason: 'clipped' | 'invalid-input' | 'degenerate-view' };
export type ClientToPlaneResult = { ok: true } & ClientPoint | { ok: false; reason: 'unavailable' | 'clipped' | 'invalid-input' | 'degenerate-view' };
export interface SketchCameraMappingReady {
  ready: true;
  revision: number;
  basis: { origin: ClientPoint; u: ClientPoint; v: ClientPoint };
  planeToClient(x: number, y: number): PlaneToClientResult;
  clientToPlane(x: number, y: number): ClientToPlaneResult;
}
export type SketchCameraMappingResult = { ready: false; reason: SketchCameraMappingReason } | SketchCameraMappingReady;

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const fin3 = (p: readonly number[]) => p.length === 3 && fin(p[0]) && fin(p[1]) && fin(p[2]);
const m16 = (m: readonly number[]) => m.length === 16 && m.every(fin);
const mv = (m: readonly number[], v: readonly number[]) =>
  [0, 1, 2, 3].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
// M*invM and invM*M must both be identity within 1e-8 (never exact equality).
const ip = (a: readonly number[], b: readonly number[]) =>
  [0, 1, 2, 3].every(c => [0, 1, 2, 3].every(r => Math.abs([0, 1, 2, 3].reduce((s, k) => s + a[k * 4 + r] * b[c * 4 + k], 0) - (c === r ? 1 : 0)) <= 1e-8));

export function createSketchCameraMapping(snap: CameraSnapshot | null, wp: SketchWorkplaneProjection): SketchCameraMappingResult {
  const fail = (reason: SketchCameraMappingReason) => ({ ready: false as const, reason });
  if (!snap) return fail('missing-camera');
  if (wp.kind !== 'origin-plane') return fail('unresolved-plane');
  if (snap.actualProjection !== 'orthographic') return fail('unsupported-projection');
  const rc = snap.rect, dpr = snap.devicePixelRatio;
  if (!fin(rc.left) || !fin(rc.top) || !(rc.width > 0) || !(rc.height > 0) || !(dpr > 0)) return fail('invalid-input');
  const P = snap.projectionMatrix, Pi = snap.inverseProjectionMatrix;
  const V = snap.viewMatrix, Vi = snap.inverseViewMatrix;
  if (![P, Pi, V, Vi].every(m16)) return fail('invalid-input');
  if (!ip(P, Pi) || !ip(Pi, P) || !ip(V, Vi) || !ip(Vi, V)) return fail('invalid-input');
  const { origin: o, u, v, normal: n } = wp;
  if (![o, u, v, n].every(fin3)) return fail('invalid-input');
  const ul = Math.hypot(...u), vl = Math.hypot(...v), nl = Math.hypot(...n);
  if ([ul, vl, nl].some(x => x <= 0)) return fail('invalid-input');
  // Ortho near/far from the matrix: p10 = -2/(f-n) < 0, p14 = -(f+n)/(f-n).
  const p10 = P[10];
  if (!fin(p10) || p10 >= 0) return fail('invalid-input');
  const depth = -2 / p10, p14 = P[14];
  if (!fin(p14)) return fail('invalid-input');
  const near = (depth * (1 + p14)) / 2, far = (depth * (1 - p14)) / 2;
  if (![near, far].every(fin) || far <= near) return fail('invalid-input');
  const toNdc = (p: readonly number[]) => {
    const view = mv(V, [p[0], p[1], p[2], 1]), clip = mv(P, view), w = clip[3];
    if (!fin(w) || w === 0) return null;
    const nx = clip[0] / w, ny = clip[1] / w;
    return ![nx, ny].every(fin) ? null : [nx, ny, view[2]];
  };
  // One snapshot for the whole affine basis P0/Pu/Pv; no frustum clipping here (finite
  // values + valid division suffice), so a point outside the window does not make the rest
  // of a tilted plane unavailable. Clipping is per public result below.
  const c0 = toNdc(o), cu = toNdc([o[0] + u[0], o[1] + u[1], o[2] + u[2]]), cv = toNdc([o[0] + v[0], o[1] + v[1], o[2] + v[2]]);
  if (!c0 || !cu || !cv) return fail('degenerate-view');
  const css = (a: number, b: number) => ({ x: rc.left + ((a + 1) * rc.width) / 2, y: rc.top + ((1 - b) * rc.height) / 2 });
  const eps = 1e-9 * Math.max(1, Math.abs(near), Math.abs(far));
  const rej = <R extends string>(reason: R): { ok: false; reason: R } => ({ ok: false, reason });
  const ready: SketchCameraMappingReady = {
    ready: true,
    revision: snap.revision,
    basis: { origin: css(c0[0], c0[1]), u: css(cu[0], cu[1]), v: css(cv[0], cv[1]) },
    planeToClient(x, y) {
      if (![x, y].every(fin)) return rej('invalid-input');
      const c = toNdc([o[0] + u[0] * x + v[0] * y, o[1] + u[1] * x + v[1] * y, o[2] + u[2] * x + v[2] * y]);
      if (!c) return rej('degenerate-view');
      if (c[2] < -far - eps || c[2] > -near + eps || Math.abs(c[0]) > 1 + eps || Math.abs(c[1]) > 1 + eps)
        return rej('clipped');
      return { ok: true, ...css(c[0], c[1]) };
    },
    clientToPlane(cx, cy) {
      if (![cx, cy].every(fin)) return rej('invalid-input');
      const nx = (cx - rc.left) / (rc.width / 2) - 1, ny = 1 - (cy - rc.top) / (rc.height / 2);
      if (![nx, ny].every(fin)) return rej('invalid-input');
      const up = (zd: number) => mv(Vi, mv(Pi, [nx, ny, zd, 1])).slice(0, 3);
      const N = up(-1), F = up(1);
      const d = [0, 1, 2].map(i => F[i] - N[i]);
      const dl = Math.hypot(...d);
      if (dl <= 0 || !fin(dl)) return rej('degenerate-view');
      const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      if (Math.abs(dn) / (dl * nl) <= 1e-8) return rej('unavailable');
      const t = ((o[0] - N[0]) * n[0] + (o[1] - N[1]) * n[1] + (o[2] - N[2]) * n[2]) / dn;
      if (!fin(t) || t < 0 || t > 1) return rej('clipped');
      const h = [N[0] + t * d[0] - o[0], N[1] + t * d[1] - o[1], N[2] + t * d[2] - o[2]];
      const x = h[0] * u[0] + h[1] * u[1] + h[2] * u[2];
      const y = h[0] * v[0] + h[1] * v[1] + h[2] * v[2];
      if (![x, y].every(fin)) return rej('degenerate-view');
      return { ok: true, x, y };
    },
  };
  Object.freeze(ready.basis);
  Object.freeze(ready);
  return ready;
}
