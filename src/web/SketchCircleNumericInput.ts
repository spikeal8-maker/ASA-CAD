import type { CadPoint2 } from '../contracts/document';

export type SketchCircleField = 'x' | 'y' | 'diameter';
export type SketchCirclePhase = 'awaiting-center' | 'awaiting-point';

export interface SketchCircleConstruction {
  center: CadPoint2;
  radius: number;
}

export interface SketchCircleDraft {
  center: CadPoint2 | null;
  hover: CadPoint2 | null;
  canonical: SketchCircleConstruction | null;
}

export interface SketchCircleNumericState {
  center: CadPoint2 | null;
  pointer: CadPoint2;
  edited: Partial<Record<SketchCircleField, string>>;
}

export interface SketchCircleFieldValue {
  text: string;
  invalid: boolean;
  edited: boolean;
}

export interface SketchCircleNumericInput {
  phase: SketchCirclePhase;
  fields: Record<SketchCircleField, SketchCircleFieldValue>;
  diameterLocked: boolean;
  canCommit: boolean;
  committing: boolean;
  error: string | null;
  focusRevision: number;
  change(field: SketchCircleField, text: string): void;
  unlockDiameter(): void;
  beginEntry(text: string): void;
  enter(field?: SketchCircleField): Promise<boolean>;
  cancelDraft(): boolean;
}

export const MIN_CIRCLE_DIAMETER = 2e-6;

export function emptyCircleInput(pointer: CadPoint2 = [0, 0]): SketchCircleNumericState {
  return { center: null, pointer, edited: {} };
}

function circleNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function circleDistance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** A pointer move replaces provisional X/Y, like the Arc numeric owner; diameter survives. */
export function moveCircleInput(state: SketchCircleNumericState, pointer: CadPoint2): SketchCircleNumericState {
  const { x: _x, y: _y, ...edited } = state.edited;
  return { ...state, pointer, edited };
}

/** One transient projection feeds both the ghost and the existing sketch.circle payload. */
export function circleInputView(state: SketchCircleNumericState, defaultDiameter: number) {
  const values = Object.fromEntries(Object.entries(state.edited)
    .map(([field, text]) => [field, circleNumber(text)])) as Partial<Record<SketchCircleField, number | null>>;
  const invalid = (field: SketchCircleField) => state.edited[field] !== undefined
    && (values[field] == null || (field === 'diameter' && values[field]! <= MIN_CIRCLE_DIAMETER));
  const error = (['x', 'y', 'diameter'] as const).some(invalid)
    ? 'Введите допустимые координаты и положительный диаметр' : null;
  const point: CadPoint2 = [values.x ?? state.pointer[0], values.y ?? state.pointer[1]];
  const phase: SketchCirclePhase = state.center ? 'awaiting-point' : 'awaiting-center';
  const pointerRadius = state.center ? circleDistance(state.center, point) : 0;
  const diameterEntered = state.edited.diameter !== undefined
    && values.diameter != null && values.diameter > MIN_CIRCLE_DIAMETER;
  const diameter = state.center
    ? (values.diameter != null && values.diameter > MIN_CIRCLE_DIAMETER
      ? values.diameter : pointerRadius * 2)
    : (values.diameter ?? defaultDiameter);
  const validDiameter = Number.isFinite(diameter) && diameter > MIN_CIRCLE_DIAMETER;
  // Only the pointer defines the radius when no explicit diameter exists;
  // a typed diameter fixes the size and the pointer only keeps direction.
  const validPoint = state.center && !diameterEntered
    ? Number.isFinite(pointerRadius) && pointerRadius > MIN_CIRCLE_DIAMETER / 2
    : true;
  const canonical = state.center && validDiameter && validPoint && !error
    ? { center: state.center, radius: diameter / 2 } : null;
  const display = { x: point[0], y: point[1], diameter };
  const fieldValue = (field: SketchCircleField): SketchCircleFieldValue => ({
    text: state.edited[field] ?? formatCircleNumber(display[field]),
    invalid: invalid(field), edited: state.edited[field] !== undefined,
  });
  return {
    point, diameter, phase, error, canonical,
    canCommit: !error && (state.center ? canonical !== null : true),
    diameterLocked: state.edited.diameter !== undefined && !invalid('diameter'),
    fields: { x: fieldValue('x'), y: fieldValue('y'), diameter: fieldValue('diameter') },
    draft: {
      center: state.center, hover: point, canonical,
    } satisfies SketchCircleDraft,
  };
}

function formatCircleNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(4)).toString() : '';
}
