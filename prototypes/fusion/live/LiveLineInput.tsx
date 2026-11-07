import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { CadPoint2, CadSketchEntity } from '../../../src/contracts/document';
import type { SketchDisplayFrame } from '../../../src/web/viewport/SketchViewportGeometry';
import { liveLineInteraction } from './LiveLineInteraction';
import type { LiveLineNumericField, LiveLinePointerContext, LiveLineSnap } from './LiveLineInteraction';
import './lineInput.css';

const EPSILON = 1e-6;
const distance = (a: CadPoint2, b: CadPoint2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Picks existing solved geometry only. Origin/midpoint are coordinate snaps,
 * not persisted constraints; the common contract proposal tracks that gap. */
export function resolveLiveLinePointer(
  point: CadPoint2, entities: readonly CadSketchEntity[], unitPerPixel: number, enabled: boolean,
): LiveLinePointerContext {
  if (!enabled) return { point, snap: null };
  const state = liveLineInteraction.getSnapshot();
  const tolerance = unitPerPixel * 9;
  const candidates: LiveLineSnap[] = [];
  if (state.chainStart && state.chainSegmentIds.length > 1) {
    candidates.push({ kind: 'chain-start', point: state.chainStart, ref: state.chainStartReference ?? undefined });
  }
  for (const entity of entities) {
    if (entity.type !== 'line') continue;
    candidates.push(
      { kind: 'endpoint', point: entity.data.from, ref: { entityId: entity.id, point: 'a' } },
      { kind: 'endpoint', point: entity.data.to, ref: { entityId: entity.id, point: 'b' } },
    );
  }
  let snap: LiveLineSnap | null = null;
  let nearest = tolerance;
  for (const candidate of candidates) {
    if (state.from && distance(candidate.point, state.from) < EPSILON) continue;
    const delta = distance(point, candidate.point);
    if (delta < nearest || (delta === nearest && candidate.kind === 'chain-start')) {
      snap = candidate; nearest = delta;
    }
  }
  if (snap) return { point: snap.point, snap };
  if (distance(point, [0, 0]) <= tolerance) return { point: [0, 0], snap: { kind: 'origin', point: [0, 0] } };
  for (const entity of entities) {
    if (entity.type !== 'line') continue;
    const midpoint: CadPoint2 = [
      (entity.data.from[0] + entity.data.to[0]) / 2,
      (entity.data.from[1] + entity.data.to[1]) / 2,
    ];
    const delta = distance(point, midpoint);
    if (delta < nearest) {
      nearest = delta;
      snap = { kind: 'midpoint', point: midpoint, sourceEntityId: entity.id };
    }
  }
  if (snap) return { point: snap.point, snap };
  if (state.from && distance(state.from, point) > tolerance * 2) {
    const dx = Math.abs(point[0] - state.from[0]), dy = Math.abs(point[1] - state.from[1]);
    if (dy <= tolerance && dy < dx) {
      const at: CadPoint2 = [point[0], state.from[1]];
      return { point: at, snap: { kind: 'horizontal', point: at } };
    }
    if (dx <= tolerance && dx < dy) {
      const at: CadPoint2 = [state.from[0], point[1]];
      return { point: at, snap: { kind: 'vertical', point: at } };
    }
  }
  return { point, snap: null };
}

export function focusLineStage(): void {
  document.querySelector<HTMLElement>('.live-workarea [data-testid="part-model-stage"]')?.focus({ preventScroll: true });
}

/** Native Enter / Marking Menu OK commits the preview, then exits Line. */
export async function acceptLiveLine(): Promise<void> {
  const state = liveLineInteraction.getSnapshot();
  if (!state.active || state.committing) return;
  focusLineStage();
  if (!state.from || !state.to || distance(state.from, state.to) <= EPSILON) {
    if (state.numericTextValid && !state.lengthEdited && !state.angleEdited) liveLineInteraction.exitTool();
    return;
  }
  if (await liveLineInteraction.commitPreview()) liveLineInteraction.exitTool();
}

/** Capture before App's numeric-view shortcuts and unconditional Escape handler. */
export function handleLiveLineKey(event: React.KeyboardEvent<HTMLElement>): boolean {
  const state = liveLineInteraction.getSnapshot();
  if (!state.active) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[role="menu"]')) return false;
  const field = target?.getAttribute('data-line-numeric-field') as LiveLineNumericField | null;
  const unrelatedInput = target?.closest('input,textarea,select,[contenteditable="true"]') && !field;
  if (unrelatedInput || (target?.closest('button,[role="button"]') && event.key !== 'Escape')) return false;
  const consume = () => { event.preventDefault(); event.stopPropagation(); };
  if (event.key === 'Escape') {
    consume(); focusLineStage(); liveLineInteraction.exitTool(); return true;
  }
  if (event.key === 'Enter' && !event.altKey) {
    consume();
    if (!event.repeat) void acceptLiveLine().catch(error => window.dispatchEvent(new CustomEvent('asa-live-error', { detail: String(error) })));
    return true;
  }
  if (event.key === 'Tab' && state.from && !event.ctrlKey && !event.metaKey && !event.altKey) {
    consume();
    const current = field ?? state.focusedField ?? 'length';
    const edited = current === 'length' ? state.lengthEdited : state.angleEdited;
    if (edited && !liveLineInteraction.lockNumeric(current)) return true;
    liveLineInteraction.focusNumeric(current === 'length' ? 'angle' : 'length');
    return true;
  }
  if (!field && state.from && !state.committing && !event.ctrlKey && !event.metaKey && !event.altKey
      && /^[0-9.,+\-]$/.test(event.key)) {
    consume();
    // Respect Tab even before the zero-length preview has shown its inputs.
    const numericField = state.focusedField ?? 'length';
    const input = event.currentTarget.querySelector<HTMLInputElement>(`[data-line-numeric-field="${numericField}"]`);
    input?.focus({ preventScroll: true });
    liveLineInteraction.focusNumeric(numericField);
    liveLineInteraction.setNumeric(numericField, event.key);
    return true;
  }
  return false;
}

const snapNames: Record<LiveLineSnap['kind'], string> = {
  endpoint: 'Конечная точка', 'chain-start': 'Замкнуть цепочку',
  horizontal: 'Горизонтально', vertical: 'Вертикально',
  origin: 'Начало координат · координатная привязка',
  midpoint: 'Середина · координатная привязка',
};

interface Props {
  frame: SketchDisplayFrame;
  size: { width: number; height: number };
  focusStage(): void;
}

export function LiveLineInput({ frame, size, focusStage }: Props) {
  const state = useSyncExternalStore(liveLineInteraction.subscribe, liveLineInteraction.getSnapshot);
  const lengthRef = useRef<HTMLInputElement>(null), angleRef = useRef<HTMLInputElement>(null);
  const focusedInputs = useRef(new WeakSet<HTMLInputElement>());
  const stageFocus = useRef(focusStage);
  stageFocus.current = focusStage;
  useEffect(() => () => stageFocus.current(), []);
  const visible = state.active && !!state.from && !!state.to
    && (state.length > EPSILON || state.lengthEdited || state.angleEdited);
  useEffect(() => {
    if (!visible || state.committing || state.focusedField) return;
    liveLineInteraction.focusNumeric('length');
  }, [visible, state.committing, state.focusedField]);
  useLayoutEffect(() => {
    if (!visible || state.committing || !state.focusedField) return;
    const input = state.focusedField === 'length' ? lengthRef.current : angleRef.current;
    if (!input) return;
    const firstFocus = !focusedInputs.current.has(input);
    focusedInputs.current.add(input);
    if (document.activeElement === input) return;
    input.focus({ preventScroll: true });
    const edited = state.focusedField === 'length' ? state.lengthEdited : state.angleEdited;
    // The first key can create this input. Keep that key; later Tab visits
    // still select the complete measurement for replacement.
    if (firstFocus && edited) input.setSelectionRange(input.value.length, input.value.length);
    else input.select();
  }, [visible, state.committing, state.focusedField, state.lengthEdited, state.angleEdited]);
  if (!state.active) return null;
  const screen = (point: CadPoint2) => ({
    x: (point[0] - frame.minX) / frame.width * size.width,
    y: (-point[1] - frame.minY) / frame.height * size.height,
  });
  const start = screen(state.from ?? [0, 0]), end = screen(state.to ?? state.from ?? [0, 0]);
  const protectedPoints = [{ ...start, margin: 18 }, { ...end, margin: 18 }];
  if (state.pointerPoint) protectedPoints.push({ ...screen(state.pointerPoint), margin: 0 });
  const dx = end.x - start.x, dy = end.y - start.y, screenLength = Math.hypot(dx, dy) || 1;
  const nx = dy / screenLength, ny = -dx / screenLength;
  const lengthAt = { x: (start.x + end.x) / 2 + nx * 53, y: (start.y + end.y) / 2 + ny * 53 };
  const angleAt = { x: end.x + (dx >= 0 ? 110 : -110), y: (start.y + end.y) / 2 + 26 };
  const position = (at: { x: number; y: number }, width = 152) => ({
    left: Math.max(8, Math.min(size.width - width - 8, at.x - width / 2)),
    top: Math.max(8, Math.min(size.height - 38, at.y - 14)),
  });
  type InputBox = { left: number; top: number; width: number; height: number };
  const placeControl = (at: { x: number; y: number }, width: number, occupied: readonly InputBox[] = []): InputBox | null => {
    const height = width === 28 ? 28 : 26;
    if (size.width < width + 16 || size.height < height + 16) return null;
    const candidates = [at];
    for (const anchor of [end, start]) {
      for (const [x, y] of [[110, 48], [-110, 48], [110, -48], [-110, -48], [0, 72], [0, -72]]) {
        candidates.push({ x: anchor.x + x, y: anchor.y + y });
      }
    }
    for (const x of [8 + width / 2, size.width - width / 2 - 8]) {
      for (const y of [24, size.height - 24]) candidates.push({ x, y });
    }
    const boxes = candidates.map(point => ({ ...position(point, width), width, height }));
    // Numeric locks can put the endpoint away from the drawing pointer. Protect
    // construction points with a halo, but the last canvas pick only against the
    // actual hit area. A pointer can approach an existing input without chasing
    // it away; overlay interactions do not update that last canvas pick.
    // Clamping at the viewport edge must not reintroduce a hit trap.
    return boxes.find(box => !protectedPoints.some(point =>
      point.x >= box.left - point.margin && point.x <= box.left + box.width + point.margin
      && point.y >= box.top - point.margin && point.y <= box.top + box.height + point.margin)
      && !occupied.some(other => box.left < other.left + other.width + 4 && box.left + box.width + 4 > other.left
        && box.top < other.top + other.height + 4 && box.top + box.height + 4 > other.top)) ?? null;
  };
  const presentBox = (box: InputBox | null): box is InputBox => box !== null;
  const lengthBox = placeControl(lengthAt, 152);
  const angleBox = placeControl(angleAt, 152, [lengthBox].filter(presentBox));
  const finishBox = placeControl({ x: start.x + 28, y: start.y + 42 }, 28, [lengthBox, angleBox].filter(presentBox));
  const numericInput = (field: LiveLineNumericField, at: InputBox | null) => {
    if (!at) return null;
    const length = field === 'length';
    const locked = length ? state.lengthLocked : state.angleLocked;
    const valid = length ? state.lengthValid : state.angleValid;
    const title = length ? 'Длина отрезка, мм. Tab — перейти к углу.'
      : state.angleMode === 'chain-interior'
        ? 'Внутренний угол к предыдущему отрезку. Задаёт геометрию при создании; сохраняемый размер этого угла пока недоступен.'
        : 'Угол построения, градусы. Фиксирует направление при создании; параметрический размер к оси пока недоступен.';
    return <label className={'live-line-value' + (locked ? ' locked' : '')} style={at} title={title}>
      <input ref={length ? lengthRef : angleRef} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        aria-label={length ? 'Длина отрезка' : 'Угол построения'} aria-invalid={!valid}
        data-testid={length ? 'fusion-line-length-input' : 'fusion-line-angle-input'} data-line-numeric-field={field}
        value={length ? state.lengthText : state.angleText} disabled={state.committing}
        onFocus={() => liveLineInteraction.focusNumeric(field)}
        onChange={event => liveLineInteraction.setNumeric(field, event.target.value)} />
      <span aria-hidden="true">{length ? 'мм' : '°'}</span>
      <button type="button" className="live-line-lock" aria-pressed={locked}
        aria-label={(locked ? 'Освободить ' : 'Зафиксировать ') + (length ? 'длину' : 'направление при создании')}
        title={locked ? 'Снять фиксацию ввода' : title} disabled={state.committing}
        onPointerDown={event => event.preventDefault()}
        onClick={() => locked ? liveLineInteraction.unlockNumeric(field) : liveLineInteraction.lockNumeric(field)}>
        <svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true">
          <rect x="3" y="7" width="8" height="7" rx="1" fill={locked ? '#d5a400' : 'none'} stroke="currentColor" />
          <path d={locked ? 'M5 7V4a2 2 0 0 1 4 0v3' : 'M5 7V4a2 2 0 0 1 4 0'} fill="none" stroke="currentColor" />
        </svg>
      </button>
    </label>;
  };
  return <div className="live-line-input" data-testid="fusion-line-dynamic-input"
    data-line-phase={state.phase} data-line-committing={String(state.committing)}
    data-length-locked={String(state.lengthLocked)} data-angle-locked={String(state.angleLocked)}
    data-input-valid={String(state.numericTextValid)} data-angle-mode={state.angleMode} data-angle-driving="false">
    {visible && <>
      <svg className="live-line-measure" width={size.width} height={size.height} aria-hidden="true">
        <path d={`M ${start.x} ${start.y} L ${start.x + nx * 70} ${start.y + ny * 70}
          M ${end.x} ${end.y} L ${end.x + nx * 70} ${end.y + ny * 70}
          M ${start.x + nx * 53} ${start.y + ny * 53} L ${end.x + nx * 53} ${end.y + ny * 53}`} />
      </svg>
      {numericInput('length', lengthBox)}
      {numericInput('angle', angleBox)}
      {state.snap && <span className="live-line-snap" data-testid="fusion-line-snap" data-snap-kind={state.snap.kind}
        data-snap-entity-id={state.snap.ref?.entityId ?? state.snap.sourceEntityId ?? ''}
        style={position({ x: end.x + 72, y: end.y + 44 }, 180)}>{snapNames[state.snap.kind]}</span>}
    </>}
    {!!state.from && state.chainSegmentIds.length > 0 && finishBox && <button type="button" className="live-line-finish"
      data-testid="fusion-line-finish-chain" aria-label="Завершить цепочку" title="Завершить цепочку; продолжить новый отрезок"
      style={finishBox} disabled={state.committing}
      onClick={() => { liveLineInteraction.finishChain(); focusStage(); }}>
      <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true"><circle cx="12.5" cy="12.5" r="10" /><path d="m7 12 4 4 7-8" /></svg>
    </button>}
    {state.error && <span className="live-line-error" role="status" style={position({ x: end.x, y: end.y + 76 }, 290)}>{state.error}</span>}
  </div>;
}
