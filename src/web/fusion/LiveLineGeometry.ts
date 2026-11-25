import type { CadApplication } from '../../contracts/application';
import type { CadDocument, CadPoint2, CadSketchLineEntity } from '../../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import type { LiveLineEndpointReference, LiveLinePointerContext, LiveLineSnapshot, LiveLineSnap } from './LiveLineInteraction';

export const MIN_LINE_LENGTH = 1e-6;
export const POINT_TOLERANCE = 1e-7;

export function withGeometry(current: LiveLineSnapshot, raw: CadPoint2): LiveLineSnapshot {
  if (!current.from) return current;
  const lengthValue = parseNumeric(current.lengthText);
  const angleValue = parseNumeric(current.angleText);
  const controlLength = current.lengthEdited || current.lengthLocked;
  const controlAngle = current.angleEdited || current.angleLocked;
  const lengthValid = !controlLength || (lengthValue !== null && lengthValue > MIN_LINE_LENGTH);
  const angleValid = !controlAngle || validAngleInput(angleValue, current.angleMode);
  if (!lengthValid || !angleValid) {
    return { ...current, pointerPoint: copyPoint(raw), lengthValid, angleValid, numericTextValid: false };
  }
  const rawLength = distance(current.from, raw);
  const reversePrevious = current.angleMode === 'chain-interior' && current.previousSegmentFrom
    ? Math.atan2(current.previousSegmentFrom[1] - current.from[1], current.previousSegmentFrom[0] - current.from[0])
    : null;
  const rawAngle = rawLength > MIN_LINE_LENGTH
    ? Math.atan2(raw[1] - current.from[1], raw[0] - current.from[0])
    : current.to && distance(current.from, current.to) > MIN_LINE_LENGTH
      ? Math.atan2(current.to[1] - current.from[1], current.to[0] - current.from[0])
      : reversePrevious === null ? 0 : reversePrevious + Math.PI;
  const length = controlLength ? lengthValue! : rawLength;
  const angle = !controlAngle ? rawAngle : reversePrevious === null
    ? normalizeDegrees(angleValue!) * Math.PI / 180
    : nearestAngleBranch(reversePrevious, angleValue! * Math.PI / 180, rawAngle);
  const to: CadPoint2 = controlLength || controlAngle
    ? [current.from[0] + length * Math.cos(angle), current.from[1] + length * Math.sin(angle)]
    : copyPoint(raw);
  const angleDegrees = reversePrevious === null
    ? normalizeDegrees(angle * 180 / Math.PI)
    : angleDistance(angle, reversePrevious) * 180 / Math.PI;
  return {
    ...current, to, pointerPoint: copyPoint(raw), length, angleDegrees, lengthValid, angleValid, numericTextValid: true,
    lengthText: controlLength ? current.lengthText : formatNumber(length),
    angleText: controlAngle ? current.angleText : formatNumber(angleDegrees),
  };
}

export function parseNumeric(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
export function numericError(snapshot: LiveLineSnapshot): string | null {
  if (!snapshot.lengthValid) return 'Введите положительную длину';
  if (!snapshot.angleValid) return angleInputError(snapshot.angleMode);
  return null;
}
export function validAngleInput(value: number | null, mode: LiveLineSnapshot['angleMode']): boolean {
  return value !== null && (mode === 'absolute' || (value >= 0 && value <= 180));
}
export function angleInputError(mode: LiveLineSnapshot['angleMode']): string {
  return mode === 'chain-interior' ? 'Введите внутренний угол от 0 до 180 градусов' : 'Введите конечное значение угла';
}
export function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function nearestAngleBranch(reference: number, interior: number, raw: number): number {
  const positive = reference + interior, negative = reference - interior;
  return angleDistance(positive, raw) < angleDistance(negative, raw) ? positive : negative;
}
export function normalizeDegrees(value: number): number { return ((value % 360) + 360) % 360; }
export function formatNumber(value: number): string { return String(Number(value.toFixed(6))); }
export function copyPoint(value: CadPoint2): CadPoint2 { return [value[0], value[1]]; }
export function finitePoint(value: CadPoint2): boolean { return Number.isFinite(value[0]) && Number.isFinite(value[1]); }
export function distance(a: CadPoint2, b: CadPoint2): number { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

export function matchingSnap(context: LiveLinePointerContext | null, raw: CadPoint2, resolved: CadPoint2): LiveLineSnap | null {
  if (!context?.snap || distance(context.point, raw) > POINT_TOLERANCE
    || distance(context.snap.point, resolved) > POINT_TOLERANCE) return null;
  return context.snap;
}
export function endpointReference(snap: LiveLineSnap | null): LiveLineEndpointReference | null {
  return snap && (snap.kind === 'endpoint' || snap.kind === 'chain-start') && snap.ref ? { ...snap.ref } : null;
}
export function findLine(app: CadApplication, sketchId: CadSketchId, entityId: CadSketchEntityId): CadSketchLineEntity | null {
  const document = app.getDocument();
  if (document.kind !== 'part') return null;
  return document.sketches.find(item => item.id === sketchId)?.entities.find(
    (entity): entity is CadSketchLineEntity => entity.id === entityId && entity.type === 'line',
  ) ?? null;
}
export function sketchFingerprint(document: Readonly<CadDocument>, sketchId: CadSketchId | null): string {
  if (document.kind !== 'part' || !sketchId) return '';
  const sketch = document.sketches.find(item => item.id === sketchId);
  if (!sketch) return '';
  const constraintIds = new Set(sketch.constraintIds);
  const dimensionIds = new Set(sketch.dimensionIds);
  return JSON.stringify([
    sketch.entities,
    document.constraints.filter(item => constraintIds.has(item.id)),
    document.dimensions.filter(item => dimensionIds.has(item.id)),
  ]);
}
