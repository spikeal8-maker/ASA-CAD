import type { CadPoint2 } from '../../contracts/document';

/**
 * Stable isolated Sketch workplane used by direct 2D tools.
 *
 * Entity-driven auto-fit is intentionally forbidden for authoring: changing the
 * geometry must not move the coordinate system underneath the pointer. Later
 * M3 slices may add explicit 2D pan/zoom while preserving the same transform
 * contract.
 */
export const DEFAULT_SKETCH_WORKPLANE = Object.freeze({
  minX: -100,
  minY: -75,
  width: 200,
  height: 150,
});

export function sketchWorkplaneViewBox(): string {
  const view = DEFAULT_SKETCH_WORKPLANE;
  return `${view.minX} ${view.minY} ${view.width} ${view.height}`;
}

export function sketchPointToSvg(point: CadPoint2): readonly [number, number] {
  return [point[0], -point[1]];
}

export function svgPointToSketch(point: readonly [number, number]): CadPoint2 {
  return [point[0], -point[1]];
}

/** Maps a browser pointer into the stable Sketch coordinate system. */
export function clientPointToSketch(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): CadPoint2 | null {
  const transform = svg.getScreenCTM();
  if (!transform) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(transform.inverse());
  return svgPointToSketch([local.x, local.y]);
}

export function sketchPointDistance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
