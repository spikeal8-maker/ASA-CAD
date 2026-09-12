import type { CadPoint2 } from '../../contracts/document';

export interface SketchArcGeometry {
  center: CadPoint2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

const TWO_PI = Math.PI * 2;
const MIN_RADIUS = 1e-6;
const MIN_SWEEP = 1e-9;

/** Canonical positive-CCW Arc geometry from the M3 center -> start -> end construction. */
export function sketchArcGeometryFromPoints(
  center: CadPoint2,
  start: CadPoint2,
  end: CadPoint2,
): SketchArcGeometry | null {
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  if (!(radius > MIN_RADIUS)) return null;

  const startAngle = normalizeAngle(Math.atan2(start[1] - center[1], start[0] - center[0]));
  const rawEndAngle = normalizeAngle(Math.atan2(end[1] - center[1], end[0] - center[0]));
  let sweep = rawEndAngle - startAngle;
  if (sweep <= 0) sweep += TWO_PI;
  if (!(sweep > MIN_SWEEP) || !(sweep < TWO_PI - MIN_SWEEP)) return null;

  return {
    center,
    radius,
    startAngle,
    endAngle: startAngle + sweep,
  };
}

/** SVG polyline path for persisted/solver Arc data in Sketch coordinates (Y inverted for SVG). */
export function sketchArcSvgPath(geometry: SketchArcGeometry): string {
  const sweep = geometry.endAngle - geometry.startAngle;
  if (!(geometry.radius > 0) || !(sweep > 0) || !(sweep < TWO_PI)) return '';

  const segments = Math.max(8, Math.ceil(48 * sweep / TWO_PI));
  const points: string[] = [];
  for (let index = 0; index <= segments; index++) {
    const angle = geometry.startAngle + sweep * index / segments;
    const x = geometry.center[0] + geometry.radius * Math.cos(angle);
    const y = geometry.center[1] + geometry.radius * Math.sin(angle);
    points.push(`${index === 0 ? 'M' : 'L'} ${format(x)} ${format(-y)}`);
  }
  return points.join(' ');
}

function normalizeAngle(value: number): number {
  const normalized = ((value % TWO_PI) + TWO_PI) % TWO_PI;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function format(value: number): string {
  return Number(value.toFixed(6)).toString();
}
