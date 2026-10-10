import type { CadPoint2, CadSketchSupport } from '../../contracts/document';
import type { CadPlaneName } from '../../contracts/commands';
import type { CadStableReferenceId } from '../../contracts/ids';
import { originPlaneFrame } from '../../contracts/sketchWorkplane';

export type { CadPoint3 } from '../../contracts/sketchWorkplane';
import type { CadPoint3 } from '../../contracts/sketchWorkplane';

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
  if (support === 'XY' || support === 'XZ' || support === 'YZ') {
    // One frame definition shared with the B-Rep runtime (contracts/sketchWorkplane).
    const plane = support as CadPlaneName;
    return { kind: 'origin-plane', support: plane, ...originPlaneFrame(plane), modelContextReady: true };
  }
  return {
    kind: 'stable-reference',
    support: support as CadStableReferenceId,
    modelContextReady: false,
  };
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
