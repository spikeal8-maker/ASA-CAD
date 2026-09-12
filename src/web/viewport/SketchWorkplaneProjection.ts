import type { CadPoint2, CadSketchSupport } from '../../contracts/document';
import type { CadPlaneName } from '../../contracts/commands';
import type { CadStableReferenceId } from '../../contracts/ids';

export type CadPoint3 = readonly [number, number, number];

export interface ResolvedOriginWorkplaneProjection {
  kind: 'origin-plane';
  support: CadPlaneName;
  origin: CadPoint3;
  u: CadPoint3;
  v: CadPoint3;
  normal: CadPoint3;
  modelContextReady: true;
}

export interface UnresolvedStableReferenceWorkplaneProjection {
  kind: 'stable-reference';
  support: CadStableReferenceId;
  modelContextReady: false;
}

export type SketchWorkplaneProjection =
  | ResolvedOriginWorkplaneProjection
  | UnresolvedStableReferenceWorkplaneProjection;

/**
 * Defines how local Sketch x/y maps to model space.
 *
 * StableRef-backed face planes intentionally remain unresolved until a runtime
 * plane-frame resolver is introduced. M3.2 therefore keeps active Sketches in
 * the isolated 2D workplane instead of drawing a visually false B-Rep context.
 */
export function resolveSketchWorkplaneProjection(
  support: CadSketchSupport,
): SketchWorkplaneProjection {
  switch (support) {
    case 'XY':
      return {
        kind: 'origin-plane',
        support,
        origin: [0, 0, 0],
        u: [1, 0, 0],
        v: [0, 1, 0],
        normal: [0, 0, 1],
        modelContextReady: true,
      };
    case 'XZ':
      return {
        kind: 'origin-plane',
        support,
        origin: [0, 0, 0],
        u: [1, 0, 0],
        v: [0, 0, 1],
        normal: [0, -1, 0],
        modelContextReady: true,
      };
    case 'YZ':
      return {
        kind: 'origin-plane',
        support,
        origin: [0, 0, 0],
        u: [0, 1, 0],
        v: [0, 0, 1],
        normal: [1, 0, 0],
        modelContextReady: true,
      };
    default:
      return {
        kind: 'stable-reference',
        support,
        modelContextReady: false,
      };
  }
}

export function sketchPointToModelPoint(
  projection: SketchWorkplaneProjection,
  point: CadPoint2,
): CadPoint3 | null {
  if (projection.kind !== 'origin-plane') return null;
  const [x, y] = point;
  return [
    projection.origin[0] + projection.u[0] * x + projection.v[0] * y,
    projection.origin[1] + projection.u[1] * x + projection.v[1] * y,
    projection.origin[2] + projection.u[2] * x + projection.v[2] * y,
  ];
}
