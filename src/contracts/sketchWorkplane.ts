import type { CadPlaneName } from './commands';
import type { CadPoint2 } from './sketch';

export type CadPoint3 = readonly [number, number, number];

/**
 * Sketch workplane frame: local Sketch x/y map to `origin + u*x + v*y`, and
 * `normal = u × v` is the material direction of an Extrude without reverse.
 */
export interface CadSketchPlaneFrame {
  origin: CadPoint3;
  u: CadPoint3;
  v: CadPoint3;
  normal: CadPoint3;
}

const EPS = 1e-9;

/**
 * One frame rule for every planar Sketch support, shared by Sketch
 * presentation and the B-Rep runtime:
 * - `u` is world X projected onto the plane (world Y when X is the normal);
 * - `v = normal × u`;
 * - `origin` is the point of the plane closest to the world origin.
 * For the document origin planes this yields XY(u=X, v=Y), XZ(u=X, v=Z,
 * normal=-Y) and YZ(u=Y, v=Z, normal=X).
 */
export function sketchPlaneFrame(normal: CadPoint3, pointOnPlane: CadPoint3 = [0, 0, 0]): CadSketchPlaneFrame {
  const n = normalize(normal);
  const projectedX = subtract([1, 0, 0], scale(n, n[0]));
  const u = length(projectedX) > 1e-6
    ? normalize(projectedX)
    : normalize(subtract([0, 1, 0], scale(n, n[1])));
  const v = normalize(cross(n, u));
  const offset = dot(n, pointOnPlane);
  return { origin: clean(scale(n, offset)), u: clean(u), v: clean(v), normal: clean(n) };
}

const ORIGIN_PLANE_NORMALS: Readonly<Record<CadPlaneName, CadPoint3>> = {
  XY: [0, 0, 1],
  XZ: [0, -1, 0],
  YZ: [1, 0, 0],
};

export function originPlaneFrame(plane: CadPlaneName): CadSketchPlaneFrame {
  return sketchPlaneFrame(ORIGIN_PLANE_NORMALS[plane]);
}

export function planeFramePoint(frame: CadSketchPlaneFrame, point: CadPoint2): CadPoint3 {
  const [x, y] = point;
  return [
    frame.origin[0] + frame.u[0] * x + frame.v[0] * y,
    frame.origin[1] + frame.u[1] * x + frame.v[1] * y,
    frame.origin[2] + frame.u[2] * x + frame.v[2] * y,
  ];
}

function normalize(value: CadPoint3): CadPoint3 {
  const size = length(value);
  if (!(size > EPS)) throw new Error('Sketch plane normal must be a non-zero vector');
  return [value[0] / size, value[1] / size, value[2] / size];
}

function length(value: CadPoint3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function dot(a: CadPoint3, b: CadPoint3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: CadPoint3, b: CadPoint3): CadPoint3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function subtract(a: CadPoint3, b: CadPoint3): CadPoint3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: CadPoint3, factor: number): CadPoint3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

/** Removes -0 and float dust so origin-plane frames are exact unit axes. */
function clean(value: CadPoint3): CadPoint3 {
  return value.map((item) => (Math.abs(item) < 1e-12 ? 0 : Math.round(item * 1e12) / 1e12)) as unknown as CadPoint3;
}
