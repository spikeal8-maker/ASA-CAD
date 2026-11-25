import type { CadPoint2 } from '../contracts/document';

export type SketchLineField = 'x' | 'y' | 'length' | 'angle';

export interface SketchLineDraft {
  from: CadPoint2 | null;
  to: CadPoint2 | null;
  /** Whole-object placement before an anchor is accepted. */
  placementFrom?: CadPoint2 | null;
}

export interface SketchLineNumericState {
  anchor: CadPoint2 | null;
  pointer: CadPoint2;
  edited: Partial<Record<SketchLineField, string>>;
}

export interface SketchLineFieldValue {
  text: string;
  invalid: boolean;
  edited: boolean;
  locked: boolean;
}

export interface SketchLineNumericInput {
  anchored: boolean;
  fields: Record<SketchLineField, SketchLineFieldValue>;
  canCommit: boolean;
  committing: boolean;
  error: string | null;
  focusRevision: number;
  change(field: SketchLineField, text: string): void;
  unlock(field: 'length' | 'angle'): void;
  beginEntry(text: string): void;
  enter(field?: SketchLineField): Promise<boolean>;
  cancelDraft(): boolean;
}

export const MIN_LINE_LENGTH = 1e-6;

export function emptyLineInput(pointer: CadPoint2 = [0, 0]): SketchLineNumericState {
  return { anchor: null, pointer, edited: {} };
}

/** Decimal editing accepts a comma; a partial sign never becomes zero. */
export function lineNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function moveLineInput(state: SketchLineNumericState, pointer: CadPoint2): SketchLineNumericState {
  const { x: _x, y: _y, ...edited } = state.edited;
  return { ...state, pointer, edited };
}

/**
 * Geometry for a transient preview, never a solver result or persisted model.
 * Length/angle are temporary placement locks. The only durable operation is
 * the existing sketch.line command submitted by useSketchLineTool.
 */
export function lineInputView(state: SketchLineNumericState) {
  const values = Object.fromEntries(
    Object.entries(state.edited).map(([key, text]) => [key, lineNumber(text)]),
  ) as Partial<Record<SketchLineField, number | null>>;
  const invalid = (field: SketchLineField) => state.edited[field] !== undefined
    && (values[field] == null || (field === 'length' && values[field]! <= MIN_LINE_LENGTH));
  const point: CadPoint2 = [
    values.x ?? state.pointer[0], values.y ?? state.pointer[1],
  ];
  const dx = state.anchor ? point[0] - state.anchor[0] : 0;
  const dy = state.anchor ? point[1] - state.anchor[1] : 0;
  const pointerLength = Math.hypot(dx, dy);
  const pointerAngle = Math.atan2(dy, dx) * 180 / Math.PI;
  const length = values.length ?? pointerLength;
  const angle = values.angle ?? pointerAngle;
  const error = (['x', 'y', 'length', 'angle'] as const).some(invalid)
    ? 'Введите допустимые координаты, положительную длину и угол'
    : null;
  const placementReady = !state.anchor && !error
    && values.length != null && values.angle != null;
  const from = state.anchor ?? (placementReady ? point : null);
  const radians = angle * Math.PI / 180;
  const to: CadPoint2 | null = from && !error
    ? [from[0] + length * Math.cos(radians), from[1] + length * Math.sin(radians)]
    : null;
  const finite = to?.every(Number.isFinite) ?? false;
  const canCommit = !error && from !== null && finite && length > MIN_LINE_LENGTH;
  const display: Record<SketchLineField, number> = {
    x: point[0], y: point[1], length, angle,
  };
  const fieldValue = (field: SketchLineField): SketchLineFieldValue => ({
    text: state.edited[field] ?? formatLineNumber(display[field]),
    invalid: invalid(field),
    edited: state.edited[field] !== undefined,
    locked: (field === 'length' || field === 'angle')
      && state.edited[field] !== undefined && !invalid(field),
  });
  return {
    point, from, to, placementReady, canCommit, error,
    draft: {
      from: state.anchor,
      to: finite ? to : null,
      placementFrom: placementReady ? point : null,
    } satisfies SketchLineDraft,
    fields: {
      x: fieldValue('x'), y: fieldValue('y'),
      length: fieldValue('length'), angle: fieldValue('angle'),
    },
  };
}

function formatLineNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
