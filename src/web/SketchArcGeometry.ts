import type { CadPoint2 } from '../contracts/document';

export const SKETCH_FULL_TURN = Math.PI * 2;

export function sketchPointAngle(center: CadPoint2, point: CadPoint2): number {
  return normalizeSketchAngle(Math.atan2(point[1] - center[1], point[0] - center[0]));
}

export function normalizeSketchAngle(value: number): number {
  const normalized = ((value % SKETCH_FULL_TURN) + SKETCH_FULL_TURN) % SKETCH_FULL_TURN;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function positiveSketchArcSweep(startAngle: number, endAngle: number): number {
  let sweep = normalizeSketchAngle(endAngle) - normalizeSketchAngle(startAngle);
  if (sweep <= 0) sweep += SKETCH_FULL_TURN;
  return sweep;
}

export function sketchPointDistance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function sketchArcEndPoint(center: CadPoint2, radius: number, angle: number): CadPoint2 {
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}

/** Exact SVG circular-arc path for the canonical positive-CCW Sketch sweep. */
export function sketchArcSvgPath(
  center: CadPoint2,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  if (!(radius > 0)) return '';
  let sweep = endAngle - startAngle;
  if (!(sweep > 0) || !(sweep < SKETCH_FULL_TURN)) {
    sweep = positiveSketchArcSweep(startAngle, endAngle);
  }
  if (!(sweep > 0) || !(sweep < SKETCH_FULL_TURN)) return '';

  const start = sketchArcEndPoint(center, radius, startAngle);
  const end = sketchArcEndPoint(center, radius, startAngle + sweep);
  const largeArc = sweep > Math.PI ? 1 : 0;
  // Sketch Y is up while SVG Y is down. Reflection flips mathematical CCW to
  // the SVG positive sweep direction, so sweep-flag=1 preserves ASA semantics.
  return [
    'M', start[0], -start[1],
    'A', radius, radius, 0, largeArc, 1, end[0], -end[1],
  ].join(' ');
}
