import type { CadPoint2 } from '../contracts/document';

export type SketchArcField = 'x' | 'y' | 'radius';
export type SketchArcPhase = 'awaiting-center' | 'awaiting-start' | 'awaiting-end';

export interface SketchArcConstruction {
  center: CadPoint2;
  start: CadPoint2;
  end: CadPoint2;
}

export interface SketchArcDraft {
  center: CadPoint2 | null;
  /** The user's first endpoint, independent of the canonical CCW start. */
  start: CadPoint2 | null;
  end: CadPoint2 | null;
  hover: CadPoint2 | null;
  canonical: SketchArcConstruction | null;
}

export interface SketchArcNumericState {
  center: CadPoint2 | null;
  start: CadPoint2 | null;
  pointer: CadPoint2;
  edited: Partial<Record<SketchArcField, string>>;
  sweep: number;
  lastAngle: number | null;
}

export interface SketchArcFieldValue {
  text: string;
  invalid: boolean;
  edited: boolean;
}

export interface SketchArcNumericInput {
  phase: SketchArcPhase;
  fields: Record<SketchArcField, SketchArcFieldValue>;
  radiusLocked: boolean;
  sweepText: string;
  canCommit: boolean;
  committing: boolean;
  error: string | null;
  focusRevision: number;
  change(field: SketchArcField, text: string): void;
  unlockRadius(): void;
  beginEntry(text: string): void;
  enter(field?: SketchArcField): Promise<boolean>;
  cancelDraft(): boolean;
}

export const MIN_ARC_RADIUS = 1e-6;
// UI-only #170 limits; stored arcs and the public command retain their contract.
export const MIN_ARC_UI_SWEEP = 1e-3;
export const MAX_ARC_UI_SWEEP = 2 * Math.PI - 0.01;

export function emptyArcInput(pointer: CadPoint2 = [0, 0]): SketchArcNumericState {
  return { center: null, start: null, pointer, edited: {}, sweep: 0, lastAngle: null };
}

function arcNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function arcDistance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function pointAngle(center: CadPoint2, point: CadPoint2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function nextSweep(state: SketchArcNumericState, point: CadPoint2): number {
  if (!state.center || !state.start || arcDistance(state.center, point) <= MIN_ARC_RADIUS) return state.sweep;
  let delta = pointAngle(state.center, point) - (state.lastAngle ?? pointAngle(state.center, state.start));
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  return Math.max(-MAX_ARC_UI_SWEEP, Math.min(MAX_ARC_UI_SWEEP, state.sweep + delta));
}

export function moveArcInput(state: SketchArcNumericState, pointer: CadPoint2): SketchArcNumericState {
  const { x: _x, y: _y, ...edited } = state.edited;
  const validDirection = state.center && arcDistance(state.center, pointer) > MIN_ARC_RADIUS;
  return {
    ...state, pointer, edited, sweep: nextSweep(state, pointer),
    lastAngle: state.start && validDirection ? pointAngle(state.center!, pointer) : state.lastAngle,
  };
}

function radialPoint(center: CadPoint2, radius: number, angle: number): CadPoint2 {
  return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
}

/** One transient projection feeds both the ghost and the existing sketch.arc payload. */
export function arcInputView(state: SketchArcNumericState) {
  const values = Object.fromEntries(Object.entries(state.edited)
    .map(([field, text]) => [field, arcNumber(text)])) as Partial<Record<SketchArcField, number | null>>;
  const invalid = (field: SketchArcField) => state.edited[field] !== undefined
    && (values[field] == null || (field === 'radius' && values[field]! <= MIN_ARC_RADIUS));
  const error = (['x', 'y', 'radius'] as const).some(invalid)
    ? 'Введите допустимые координаты и положительный радиус' : null;
  const point: CadPoint2 = [values.x ?? state.pointer[0], values.y ?? state.pointer[1]];
  const phase: SketchArcPhase = !state.center ? 'awaiting-center' : !state.start ? 'awaiting-start' : 'awaiting-end';
  const pointerRadius = state.center ? arcDistance(state.center, point) : 0;
  const radius = state.center && state.start ? arcDistance(state.center, state.start) : values.radius ?? pointerRadius;
  const validRadius = Number.isFinite(radius) && radius > MIN_ARC_RADIUS;
  const validDirection = Number.isFinite(pointerRadius) && pointerRadius > MIN_ARC_RADIUS;
  const candidate = state.center && validRadius && validDirection && !error
    ? radialPoint(state.center, radius, pointAngle(state.center, point)) : null;
  const radiusPoint = candidate?.every(Number.isFinite) ? candidate : null;
  // Typed coordinates contribute one provisional delta; partial edits never
  // accumulate a pointer trajectory. Accepting that point applies it once.
  const sweep = nextSweep(state, point);
  const firstAngle = state.center && state.start ? pointAngle(state.center, state.start) : 0;
  const first = state.center && state.start && validRadius ? radialPoint(state.center, radius, firstAngle) : null;
  const end = state.center && first && validDirection && !error
    ? radialPoint(state.center, radius, firstAngle + sweep) : null;
  const canonical: SketchArcConstruction | null = state.center && first && end && !error
    && Math.abs(sweep) >= MIN_ARC_UI_SWEEP && [...first, ...end].every(Number.isFinite)
    ? { center: state.center, start: sweep < 0 ? end : first, end: sweep < 0 ? first : end } : null;
  const display = { x: point[0], y: point[1], radius };
  const fieldValue = (field: SketchArcField): SketchArcFieldValue => ({
    text: state.edited[field] ?? formatArcNumber(display[field]),
    invalid: invalid(field), edited: state.edited[field] !== undefined,
  });
  return {
    point, radius, radiusPoint, sweep, phase, error, canonical,
    canCommit: canonical !== null,
    radiusLocked: state.edited.radius !== undefined && !invalid('radius'),
    sweepText: formatArcNumber(Math.abs(sweep) * 180 / Math.PI),
    fields: { x: fieldValue('x'), y: fieldValue('y'), radius: fieldValue('radius') },
    draft: {
      center: state.center, start: state.start, end,
      hover: state.start ? end : radiusPoint, canonical,
    } satisfies SketchArcDraft,
  };
}

function formatArcNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(4)).toString() : '';
}
