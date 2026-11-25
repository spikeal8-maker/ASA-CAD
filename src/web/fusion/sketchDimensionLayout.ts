import type { CadDimension, CadSketchEntity } from '../../contracts/document';

/** SVG viewBox coordinates: X right, Y down. This is annotation layout, never CAD intent. */
type Point = [number, number];
export interface SketchDimensionSegment { from: Point; to: Point }
export interface SketchLineDimensionLayout {
  kind: 'linear' | 'horizontal' | 'vertical';
  measuredFrom: Point;
  measuredTo: Point;
  dimensionLine: SketchDimensionSegment;
  extensionLines: [SketchDimensionSegment, SketchDimensionSegment];
  arrowHeads: [Point[], Point[]];
  label: { point: Point; angle: number };
  arrowsOutside: boolean;
}

const moved = (point: Point, direction: Point, distance: number): Point =>
  [point[0] + direction[0] * distance, point[1] + direction[1] * distance];

/**
 * Draw a single-line dimension from the existing solved endpoints. Directional
 * dimensions use the appropriate endpoint projection; an aligned dimension
 * uses the actual line direction. Placement is a transient presentation default:
 * the shared dimension contract does not persist an annotation position.
 */
export function sketchLineDimensionLayout(
  dimension: CadDimension, entity: CadSketchEntity, unitPerPixel: number,
): SketchLineDimensionLayout | null {
  if (entity.type !== 'line' || dimension.entityIds.length !== 1
    || dimension.entityIds[0] !== entity.id
    || !['linear', 'horizontal', 'vertical'].includes(dimension.type)
    || !(unitPerPixel > 0) || !Number.isFinite(unitPerPixel)) return null;
  let from: Point = [entity.data.from[0], -entity.data.from[1]];
  let to: Point = [entity.data.to[0], -entity.data.to[1]];
  if (![...from, ...to].every(Number.isFinite)) return null;
  const kind = dimension.type as SketchLineDimensionLayout['kind'];
  // Stable ordering keeps the annotation on the same side when a line's stored
  // endpoint order is reversed. Vertical text reads from bottom to top.
  if (kind === 'vertical' ? from[1] < to[1]
    : from[0] > to[0] || (from[0] === to[0] && from[1] < to[1])) [from, to] = [to, from];
  const offset = 54 * unitPerPixel;
  let a: Point, b: Point;
  if (kind === 'horizontal') {
    const y = Math.max(from[1], to[1]) + offset;
    a = [from[0], y]; b = [to[0], y];
  } else if (kind === 'vertical') {
    const x = Math.max(from[0], to[0]) + offset;
    a = [x, from[1]]; b = [x, to[1]];
  } else {
    const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
    if (length <= 1e-10) return null;
    const normal: Point = [-dy / length, dx / length];
    a = moved(from, normal, offset); b = moved(to, normal, offset);
  }
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  if (length <= 1e-10) return null;
  const axis: Point = [dx / length, dy / length], normal: Point = [-axis[1], axis[0]];
  const extension = (point: Point, tip: Point): SketchDimensionSegment => {
    const distance = Math.hypot(tip[0] - point[0], tip[1] - point[1]);
    const direction: Point = [(tip[0] - point[0]) / distance, (tip[1] - point[1]) / distance];
    return { from: moved(point, direction, 8 * unitPerPixel), to: moved(tip, direction, 8 * unitPerPixel) };
  };
  const arrowsOutside = length < 24 * unitPerPixel;
  const arrow = (tip: Point, sign: number): Point[] => {
    const base = moved(tip, axis, sign * 9 * unitPerPixel);
    return [tip, moved(base, normal, 2.5 * unitPerPixel), moved(base, normal, -2.5 * unitPerPixel)];
  };
  return {
    kind, measuredFrom: from, measuredTo: to,
    dimensionLine: { from: moved(a, axis, arrowsOutside ? -12 * unitPerPixel : 0),
      to: moved(b, axis, arrowsOutside ? 12 * unitPerPixel : 0) },
    extensionLines: [extension(from, a), extension(to, b)],
    arrowHeads: [arrow(a, arrowsOutside ? -1 : 1), arrow(b, arrowsOutside ? 1 : -1)],
    label: { point: moved([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], normal, -7 * unitPerPixel),
      angle: Math.atan2(axis[1], axis[0]) * 180 / Math.PI },
    arrowsOutside,
  };
}
