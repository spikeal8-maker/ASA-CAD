import type { CadPlaneName } from '../../contracts/commands';
import type { CadRenderBounds } from '../../contracts/render';

export type ReferenceVec3 = readonly [number, number, number];

/** Display colors for origin planes; each axis uses the color of the plane it is normal to. */
export const REFERENCE_PLANE_COLORS: Readonly<Record<CadPlaneName, number>> = Object.freeze({
  XY: 0x2a77c9,
  XZ: 0x5fa61f,
  YZ: 0xd05a5a,
});
export const REFERENCE_HOVER_COLOR = 0x3a9ee6;
export const REFERENCE_SELECTION_COLOR = 0x00a3d6;

/** Origin plane half-size (mm) for a Part without B-Rep; with a body the planes frame the model. */
export const REFERENCE_EMPTY_HALF_SIZE = 50;

export interface ViewportReferencePlane {
  id: CadPlaneName;
  /** Square outline in world space, counter-clockwise in the plane's (u, v) basis. */
  corners: readonly [ReferenceVec3, ReferenceVec3, ReferenceVec3, ReferenceVec3];
  normal: ReferenceVec3;
  color: number;
}

export interface ViewportReferenceAxis {
  id: 'X' | 'Y' | 'Z';
  end: ReferenceVec3;
  color: number;
}

export interface ViewportReferenceScene {
  halfSize: number;
  planes: ViewportReferencePlane[];
  axes: ViewportReferenceAxis[];
  /** Camera/fit bounds when no B-Rep is present. */
  bounds: CadRenderBounds;
}

const PLANE_BASIS: Readonly<Record<CadPlaneName, { u: ReferenceVec3; v: ReferenceVec3; normal: ReferenceVec3 }>> = {
  XY: { u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  XZ: { u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
  YZ: { u: [0, 1, 0], v: [0, 0, 1], normal: [1, 0, 0] },
};

/**
 * Builds the Part origin (axes + base planes) from the document's own plane
 * list. Pure data: no Three.js objects, no persistence, no subshape indices.
 */
export function partReferenceScene(
  planeIds: readonly CadPlaneName[],
  modelBounds: CadRenderBounds | null,
): ViewportReferenceScene {
  const extent = modelBounds
    ? Math.max(
      Math.abs(modelBounds.minX), Math.abs(modelBounds.maxX),
      Math.abs(modelBounds.minY), Math.abs(modelBounds.maxY),
      Math.abs(modelBounds.minZ), Math.abs(modelBounds.maxZ),
    )
    : 0;
  const halfSize = modelBounds ? Math.max(10, Math.ceil(extent * 1.25)) : REFERENCE_EMPTY_HALF_SIZE;
  const planes = planeIds.map((id): ViewportReferencePlane => {
    const { u, v, normal } = PLANE_BASIS[id];
    const at = (su: number, sv: number): ReferenceVec3 => [
      (u[0] * su + v[0] * sv) * halfSize,
      (u[1] * su + v[1] * sv) * halfSize,
      (u[2] * su + v[2] * sv) * halfSize,
    ];
    return { id, corners: [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)], normal, color: REFERENCE_PLANE_COLORS[id] };
  });
  const axisLength = halfSize * 0.3;
  const axes: ViewportReferenceAxis[] = [
    { id: 'X', end: [axisLength, 0, 0], color: REFERENCE_PLANE_COLORS.YZ },
    { id: 'Y', end: [0, axisLength, 0], color: REFERENCE_PLANE_COLORS.XZ },
    { id: 'Z', end: [0, 0, axisLength], color: REFERENCE_PLANE_COLORS.XY },
  ];
  return {
    halfSize,
    planes,
    axes,
    bounds: {
      minX: -halfSize, minY: -halfSize, minZ: -halfSize,
      maxX: halfSize, maxY: halfSize, maxZ: halfSize,
    },
  };
}
