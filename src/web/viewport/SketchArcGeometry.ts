import type { CadPoint2 } from '../../contracts/document';

const TWO_PI = Math.PI * 2;
const MIN_RADIUS = 1e-6;
const MIN_SWEEP = 1e-9;

export interface SketchArcGeometry {
  center: CadPoint2;
  radius: number;
  startAngle: number;
  endAngle: number;
  sweep: number;
  path: string;
}

/** Builds canonical SVG path geometry for an already persisted Arc DTO. */
export function sketchArcGeometry(
  center: CadPoint2,
  radius: number,
  startAngle: number,
  endAngle: number,
): SketchArcGeometry | null {
  const sweep = endAngle - startAngle;
  if (!(radius > MIN_RADIUS) || !(sweep > MIN_SWEEP) || !(sweep < TWO_PI - MIN_SWEEP)) return null;
  return {
    center,
    radius,
    startAngle,
    endAngle,
    sweep,
    path: arcPath(center, radius, startAngle, endAngle),
  };
}

/** Builds transient center -> start -> end Arc geometry without touching CadDocument. */
export function sketchArcGeometryFromConstruction(
  center: CadPoint2,
  start: CadPoint2,
  end: CadPoint2,
): SketchArcGeometry | null {
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  if (!(radius > MIN_RADIUS)) return null;
  const startAngle = normalizeAngle(Math.atan2(start[1] - center[1], start[0] - center[0]));
  const rawEndAngle = normalizeAngle(Math.atan2(end[1] - center[1], end[0] - center[0]));
  const sweep = positiveSweep(startAngle, rawEndAngle);
  if (!(sweep > MIN_SWEEP) || !(sweep < TWO_PI - MIN_SWEEP)) return null;
  const endAngle = startAngle + sweep;
  return {
    center,
    radius,
    startAngle,
    endAngle,
    sweep,
    path: arcPath(center, radius, startAngle, endAngle),
  };
}

function arcPath(center: CadPoint2, radius: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  const startX = center[0] + radius * Math.cos(startAngle);
  const startY = -(center[1] + radius * Math.sin(startAngle));
  const endX = center[0] + radius * Math.cos(endAngle);
  const endY = -(center[1] + radius * Math.sin(endAngle));
  const largeArcFlag = sweep > Math.PI ? 1 : 0;
  // CAD coordinates are Y-up. Negating SVG Y mirrors the plane, so positive
  // CAD CCW must use SVG sweep-flag=0 to preserve the intended circle/curvature.
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endX} ${endY}`;
}

function normalizeAngle(value: number): number {
  const normalized = value % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

function positiveSweep(start: number, end: number): number {
  const sweep = normalizeAngle(end) - normalizeAngle(start);
  return sweep > 0 ? sweep : sweep + TWO_PI;
}
