import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CadApplication } from '../../../src/contracts/application';
import type { CadCommand, CadCommandId } from '../../../src/contracts/commands';
import type { CadDocument, CadPoint2, CadSketchLineEntity } from '../../../src/contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../../src/contracts/ids';
import {
  bindLiveLineInteraction, createLiveLineSnapshot, publishLiveLineInteraction, resolveLiveLineCommit,
  type LiveLineCommit, type LiveLineEndpointReference, type LiveLineNumericField,
  type LiveLinePhase, type LiveLinePointerContext, type LiveLineSnapshot, type LiveLineSnap,
} from './LiveLineInteraction';

export interface SketchLineDraft { from: CadPoint2 | null; to: CadPoint2 | null; }
export interface UseSketchLineToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}

const MIN_LINE_LENGTH = 1e-6;
const POINT_TOLERANCE = 1e-7;
interface Flight { epoch: number; app: CadApplication; document: Readonly<CadDocument>; }

/**
 * Prototype-only replacement for the existing hook. Transient gestures never
 * write CadDocument. All geometry, constraints and dimensions use real commands.
 * Each changed execute has a separate Undo frame; no transaction is fabricated.
 */
export function useSketchLineTool(options: UseSketchLineToolOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const token = useRef(Symbol('live-line-owner'));
  const mounted = useRef(false);
  const epoch = useRef(0);
  const flight = useRef<Flight | null>(null);
  const pointerContext = useRef<LiveLinePointerContext | null>(null);
  const rawPointer = useRef<CadPoint2 | null>(null);
  const state = useRef(createLiveLineSnapshot(options.active, options.sketchId));
  const [view, setView] = useState(state.current);

  const publish = useCallback((next: LiveLineSnapshot) => {
    state.current = next;
    if (mounted.current) setView(next);
    publishLiveLineInteraction(token.current, next);
  }, []);

  const clear = useCallback((phase: LiveLinePhase, active: boolean) => {
    epoch.current += 1;
    pointerContext.current = null;
    rawPointer.current = null;
    publish({
      ...createLiveLineSnapshot(active, optionsRef.current.sketchId),
      phase, committing: flight.current !== null, lastCommit: state.current.lastCommit,
    });
  }, [publish]);

  const reset = useCallback(() => {
    const active = optionsRef.current.active;
    // The shared controller calls reset before every Line toolbar invocation.
    // Native reselecting an already active Line preserves its pending chain.
    // Cancellation, Undo/Open and option changes have their own clear path.
    if (active && state.current.active) return;
    clear(active ? 'AWAITING_START' : 'IDLE', active);
  }, [clear]);

  const finishChain = useCallback(() => {
    const active = state.current.active && optionsRef.current.active;
    clear(active ? 'AWAITING_START' : 'IDLE', active);
    if (active) optionsRef.current.setNotice('Укажите начальную точку отрезка');
  }, [clear]);

  const cancelPreview = useCallback(() => {
    clear('CANCELLED', state.current.active && optionsRef.current.active);
  }, [clear]);

  const exitTool = useCallback(() => {
    if (!state.current.active) return;
    clear('CANCELLED', false);
    optionsRef.current.onCommitted();
  }, [clear]);

  const setPointerContext = useCallback((context: LiveLinePointerContext) => {
    if (!finitePoint(context.point)) return;
    pointerContext.current = {
      point: copyPoint(context.point),
      snap: context.snap ? {
        ...context.snap, point: copyPoint(context.snap.point),
        ref: context.snap.ref ? { ...context.snap.ref } : undefined,
      } : null,
    };
    if (context.snap === null && state.current.snap !== null) {
      publish({ ...state.current, snap: null });
    }
  }, [publish]);

  const move = useCallback((point: CadPoint2) => {
    const current = state.current;
    if (!optionsRef.current.active || !current.active || !current.from || flight.current || !finitePoint(point)) return;
    rawPointer.current = copyPoint(point);
    const next = withGeometry({
      ...current, phase: current.focusedField ? 'NUMERIC_INPUT' : 'PREVIEW_SEGMENT',
    }, point);
    publish({ ...next, snap: matchingSnap(pointerContext.current, point, next.to!) });
  }, [publish]);

  const focusNumeric = useCallback((field: LiveLineNumericField | null) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    publish({ ...current, focusedField: field, phase: field ? 'NUMERIC_INPUT' : 'PREVIEW_SEGMENT' });
  }, [publish]);

  const setNumeric = useCallback((field: LiveLineNumericField, text: string) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    const edited = field === 'length'
      ? { ...current, lengthText: text, lengthEdited: true }
      : { ...current, angleText: text, angleEdited: true };
    const next = withGeometry({
      ...edited, focusedField: field, phase: 'NUMERIC_INPUT', error: null,
    }, rawPointer.current ?? current.to ?? current.from);
    publish({ ...next, snap: null, error: numericError(next) });
  }, [publish]);

  const lockNumeric = useCallback((field: LiveLineNumericField): boolean => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return false;
    const value = parseNumeric(field === 'length' ? current.lengthText : current.angleText);
    if (field === 'length' ? value === null || value <= MIN_LINE_LENGTH : !validAngleInput(value, current.angleMode)) {
      const error = field === 'length' ? 'Введите положительную длину' : angleInputError(current.angleMode);
      const invalid = field === 'length'
        ? { ...current, lengthEdited: true, lengthValid: false }
        : { ...current, angleEdited: true, angleValid: false };
      publish({ ...invalid, numericTextValid: false, error, focusedField: field, phase: 'NUMERIC_INPUT' });
      optionsRef.current.setNotice(error);
      return false;
    }
    const locked = field === 'length'
      ? { ...current, lengthLocked: true, lengthEdited: true }
      : { ...current, angleLocked: true, angleEdited: true };
    const raw = rawPointer.current ?? current.to ?? current.from;
    const next = withGeometry({ ...locked, phase: 'NUMERIC_INPUT', error: null }, raw);
    publish({ ...next, snap: matchingSnap(pointerContext.current, raw, next.to!) });
    return true;
  }, [publish]);

  const unlockNumeric = useCallback((field: LiveLineNumericField) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    const unlocked = field === 'length'
      ? { ...current, lengthLocked: false, lengthEdited: false }
      : { ...current, angleLocked: false, angleEdited: false };
    const next = withGeometry({ ...unlocked, error: null }, rawPointer.current ?? current.to ?? current.from);
    publish({ ...next, snap: null, error: numericError(next) });
  }, [publish]);

  const commitFromDraft = useCallback(async (requested: CadPoint2): Promise<boolean> => {
    const current = state.current;
    const currentOptions = optionsRef.current;
    const { app, sketchId } = currentOptions;
    if (!currentOptions.active || !current.active || !sketchId || !current.from || flight.current || !finitePoint(requested)) return false;
    const prepared = withGeometry(current, requested);
    const validationError = numericError(prepared);
    if (validationError || !prepared.to || !finitePoint(prepared.to) || !Number.isFinite(prepared.length)
      || distance(current.from, prepared.to) <= MIN_LINE_LENGTH) {
      const error = validationError ?? (!prepared.to || !finitePoint(prepared.to) || !Number.isFinite(prepared.length)
        ? 'Координаты и длина должны быть конечными числами' : 'Конечная точка должна отличаться от начальной');
      publish({ ...prepared, error });
      currentOptions.setNotice(error);
      return false;
    }
    const document = app.getDocument();
    const sketch = document.kind === 'part' ? document.sketches.find(item => item.id === sketchId) : null;
    if (!sketch || (current.fromReference && !findLine(app, sketchId, current.fromReference.entityId))) {
      clear('AWAITING_START', true);
      currentOptions.setNotice('Начальная геометрия изменена. Укажите начальную точку заново');
      return false;
    }
    const from = copyPoint(current.from);
    const to = copyPoint(prepared.to);
    const snap = matchingSnap(pointerContext.current, requested, to);
    const closed = current.chainSegmentIds.length >= 2 && current.chainStart !== null
      && distance(to, current.chainStart) <= POINT_TOLERANCE;
    const endReference = closed ? current.chainStartReference : endpointReference(snap);
    if (endReference && !findLine(app, sketchId, endReference.entityId)) {
      const error = 'Точка привязки больше не существует';
      publish({ ...prepared, error, snap: null });
      currentOptions.setNotice(error);
      return false;
    }
    // Synchronous ref ownership prevents two clicks/Enter events before rerender.
    const pending: Flight = { epoch: epoch.current, app, document };
    flight.current = pending;
    publish({ ...prepared, snap, committing: true, phase: closed ? 'CLOSING_CHAIN' : 'COMMITTING_SEGMENT', error: null });
    const commands: CadCommandId[] = [];
    const createdIds: string[] = [];
    const coincidentIds: string[] = [];
    let undoFrames = 0;
    let entityId: CadSketchEntityId | null = null;
    let orientationConstraintId: string | null = null;
    let lengthDimensionId: string | null = null;
    let resolvedFrom = from;
    let resolvedTo = to;
    const inputAngleDegrees = current.angleEdited || current.angleLocked
      ? parseNumeric(current.angleText) : null;
    const coordinateAngleDegrees = inputAngleDegrees === null ? null
      : normalizeDegrees(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI);
    const sameSession = () => mounted.current && epoch.current === pending.epoch
      && optionsRef.current.app === app && optionsRef.current.sketchId === sketchId
      && optionsRef.current.active && state.current.active;
    const describeCommit = (completed: boolean, error: string | null): LiveLineCommit => ({
      entityId, from: resolvedFrom, to: resolvedTo, closed, completed, createdIds: [...createdIds],
      commands: [...commands], undoFrames, coincidentIds: [...coincidentIds],
      orientationConstraintId, lengthDimensionId, inputAngleDegrees,
      angleMode: current.angleMode, coordinateAngleDegrees, angleDriving: false, error,
    });
    const execute = async (command: CadCommand) => {
      // Undo/Open replace the actual document object. Never attach queued refs
      // to a replacement document. Exit/reset alone does not abort accepted intent.
      if (app.getDocument() !== document) throw new Error('Документ изменён; оставшиеся команды сегмента не выполнены');
      commands.push(command.id);
      const result = await app.execute(command);
      if (result.changed) undoFrames += 1;
      if (result.createdIds) createdIds.push(...result.createdIds);
      if (!result.ok) throw new Error(result.error?.message ?? 'Команда ' + command.id + ' не выполнена');
      if (app.getDocument() !== document) throw new Error('Документ изменён во время команды; сегмент не подтверждён');
      return result;
    };
    try {
      const lineResult = await execute({ id: 'sketch.line', payload: { sketchId, from, to } });
      const lineIds = new Set<string>(lineResult.createdIds ?? []);
      const created = sketch.entities.find((item): item is CadSketchLineEntity => item.type === 'line' && lineIds.has(item.id));
      if (!created) throw new Error('Команда линии не вернула идентификатор созданного отрезка');
      entityId = created.id;
      if (current.fromReference) {
        const result = await execute({
          id: 'constraint.coincident',
          payload: { sketchId, a: current.fromReference, b: { entityId, point: 'a' } },
        });
        coincidentIds.push(...(result.createdIds ?? []));
      }
      if (endReference) {
        const result = await execute({
          id: 'constraint.coincident',
          payload: { sketchId, a: { entityId, point: 'b' }, b: endReference },
        });
        coincidentIds.push(...(result.createdIds ?? []));
      }
      // A current endpoint/closure snap can also imply an exact axis alignment.
      // Null context (including Snap off) never creates an inferred H/V constraint.
      if (snap && Math.abs(to[1] - from[1]) <= POINT_TOLERANCE) {
        const result = await execute({ id: 'constraint.horizontal', payload: { sketchId, entityId } });
        orientationConstraintId = result.createdIds?.[0] ?? null;
      } else if (snap && Math.abs(to[0] - from[0]) <= POINT_TOLERANCE) {
        const result = await execute({ id: 'constraint.vertical', payload: { sketchId, entityId } });
        orientationConstraintId = result.createdIds?.[0] ?? null;
      }
      if (current.lengthEdited || current.lengthLocked) {
        const result = await execute({
          id: 'dimension.linear',
          payload: { sketchId, entityIds: [entityId], value: parseNumeric(current.lengthText)! },
        });
        lengthDimensionId = result.createdIds?.[0] ?? null;
      }
      if (app.getDocument() !== document) throw new Error('Документ изменён; завершение сегмента отменено');
      const expectedGeometry = sketchFingerprint(document, sketchId);
      const solved = await resolveLiveLineCommit(sketchId);
      if (app.getDocument() !== document || sketchFingerprint(app.getDocument(), sketchId) !== expectedGeometry) {
        throw new Error('Эскиз изменён во время решения; продолжение цепочки отменено');
      }
      if (solved.status !== 'solved' || solved.converged !== true || solved.sketchId !== sketchId) {
        const diagnostic = solved.diagnostics.find(item => item.severity === 'error')?.message;
        throw new Error('Решение эскиза не завершено' + (diagnostic ? ': ' + diagnostic : ''));
      }
      const solvedLine = solved.previewEntities.find(
        (item): item is CadSketchLineEntity => item.id === entityId && item.type === 'line',
      );
      const firstId = current.chainSegmentIds[0] ?? entityId;
      const solvedFirst = solved.previewEntities.find(
        (item): item is CadSketchLineEntity => item.id === firstId && item.type === 'line',
      );
      if (!solvedLine || !solvedFirst || !finitePoint(solvedLine.data.from)
        || !finitePoint(solvedLine.data.to) || !finitePoint(solvedFirst.data.from)
        || distance(solvedLine.data.from, solvedLine.data.to) <= MIN_LINE_LENGTH) {
        throw new Error('Решение не содержит корректные конечные точки созданной цепочки');
      }
      resolvedFrom = copyPoint(solvedLine.data.from);
      resolvedTo = copyPoint(solvedLine.data.to);
      const lastCommit = describeCommit(true, null);
      const canContinue = sameSession();
      if (canContinue) {
        pointerContext.current = null;
        rawPointer.current = closed ? null : copyPoint(requested);
        const next = createLiveLineSnapshot(true, sketchId);
        publish(closed ? { ...next, committing: true, lastCommit } : {
          ...next, phase: 'CONTINUING_CHAIN', committing: true,
          from: copyPoint(resolvedTo), to: copyPoint(resolvedTo), pointerPoint: copyPoint(requested),
          fromReference: { entityId, point: 'b' },
          chainStart: copyPoint(solvedFirst.data.from),
          chainStartReference: current.chainStartReference ?? { entityId, point: 'a' },
          chainSegmentIds: [...current.chainSegmentIds, entityId],
          previousSegmentFrom: copyPoint(resolvedFrom), angleMode: 'chain-interior',
          angleDegrees: 180, lengthText: '0', angleText: '180', lastCommit,
        });
        currentOptions.setNotice(closed
          ? 'Контур замкнут. Укажите начальную точку новой цепочки'
          : coordinateAngleDegrees === null
            ? 'Отрезок создан. Укажите следующую точку'
            : current.angleMode === 'chain-interior'
              ? 'Отрезок создан. Внутренний угол задан координатами; угловой размер не создан'
              : 'Отрезок создан. Угол задан координатами; абсолютный угловой размер недоступен');
      } else if (optionsRef.current.app === app && optionsRef.current.sketchId === sketchId) {
        publish({ ...state.current, lastCommit });
      }
      return canContinue;
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const error = entityId && app.getDocument() === document
        ? 'Отрезок создан, но часть ограничений не выполнена: ' + detail : detail;
      const lastCommit = describeCommit(false, error);
      if (sameSession()) {
        if (entityId) {
          // Never leave a failed partial commit as a retryable duplicate preview.
          epoch.current += 1;
          pointerContext.current = null;
          rawPointer.current = null;
          publish({ ...createLiveLineSnapshot(true, sketchId), committing: true, error, lastCommit });
        } else {
          publish({ ...prepared, committing: true, phase: 'PREVIEW_SEGMENT', error, lastCommit });
        }
      } else if (optionsRef.current.app === app && optionsRef.current.sketchId === sketchId) {
        publish({ ...state.current, error, lastCommit });
      }
      if (optionsRef.current.app === app) optionsRef.current.setNotice(error);
      return false;
    } finally {
      if (flight.current === pending) {
        flight.current = null;
        publish({ ...state.current, committing: false });
      }
    }
  }, [clear, publish]);

  const point = useCallback(async (value: CadPoint2) => {
    const current = state.current;
    if (!optionsRef.current.active || !current.active || flight.current || !finitePoint(value)) return;
    rawPointer.current = copyPoint(value);
    if (!current.from) {
      const snap = matchingSnap(pointerContext.current, value, value);
      const reference = endpointReference(snap);
      const validReference = reference && optionsRef.current.sketchId
        && findLine(optionsRef.current.app, optionsRef.current.sketchId, reference.entityId) ? reference : null;
      publish({
        ...createLiveLineSnapshot(true, optionsRef.current.sketchId),
        phase: 'PREVIEW_SEGMENT', from: copyPoint(value), to: copyPoint(value), pointerPoint: copyPoint(value),
        fromReference: validReference, chainStart: copyPoint(value),
        lengthText: '0', angleText: '0', snap, lastCommit: current.lastCommit,
      });
      optionsRef.current.setNotice('Укажите конечную точку отрезка');
      return;
    }
    await commitFromDraft(value);
  }, [commitFromDraft, publish]);

  const commitPreview = useCallback(async () => {
    const current = state.current;
    if (!current.from || !current.to) return false;
    return commitFromDraft(rawPointer.current ?? current.to);
  }, [commitFromDraft]);

  useLayoutEffect(() => {
    mounted.current = true;
    const unbind = bindLiveLineInteraction(token.current, {
      setPointerContext, focusNumeric, setNumeric, lockNumeric, unlockNumeric,
      commitPreview, finishChain, cancelPreview, exitTool,
    }, state.current);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      unbind();
    };
  }, [cancelPreview, commitPreview, exitTool, finishChain, focusNumeric, lockNumeric, setNumeric, setPointerContext, unlockNumeric]);

  useLayoutEffect(() => {
    const previous = state.current;
    clear(options.active ? 'AWAITING_START' : 'IDLE', options.active);
    if (previous.sketchId !== options.sketchId) publish({ ...state.current, lastCommit: null });
    let observedDocument = options.app.getDocument();
    let observedGeometry = sketchFingerprint(observedDocument, options.sketchId);
    return options.app.subscribe(() => {
      const document = options.app.getDocument();
      const geometry = sketchFingerprint(document, options.sketchId);
      const replaced = document !== observedDocument;
      const changed = geometry !== observedGeometry;
      observedDocument = document;
      observedGeometry = geometry;
      if (replaced || (changed && !flight.current && state.current.from)) {
        clear(optionsRef.current.active ? 'AWAITING_START' : 'IDLE', optionsRef.current.active);
      }
    });
  }, [options.active, options.app, options.sketchId, clear, publish]);

  return {
    draft: { from: view.from, to: view.to } as SketchLineDraft,
    committing: view.committing, move, point, reset, commitPreview,
  };
}

function withGeometry(current: LiveLineSnapshot, raw: CadPoint2): LiveLineSnapshot {
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

function parseNumeric(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
function numericError(snapshot: LiveLineSnapshot): string | null {
  if (!snapshot.lengthValid) return 'Введите положительную длину';
  if (!snapshot.angleValid) return angleInputError(snapshot.angleMode);
  return null;
}
function validAngleInput(value: number | null, mode: LiveLineSnapshot['angleMode']): boolean {
  return value !== null && (mode === 'absolute' || (value >= 0 && value <= 180));
}
function angleInputError(mode: LiveLineSnapshot['angleMode']): string {
  return mode === 'chain-interior' ? 'Введите внутренний угол от 0 до 180 градусов' : 'Введите конечное значение угла';
}
function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
function nearestAngleBranch(reference: number, interior: number, raw: number): number {
  const positive = reference + interior, negative = reference - interior;
  return angleDistance(positive, raw) < angleDistance(negative, raw) ? positive : negative;
}
function normalizeDegrees(value: number): number { return ((value % 360) + 360) % 360; }
function formatNumber(value: number): string { return String(Number(value.toFixed(6))); }
function copyPoint(value: CadPoint2): CadPoint2 { return [value[0], value[1]]; }
function finitePoint(value: CadPoint2): boolean { return Number.isFinite(value[0]) && Number.isFinite(value[1]); }
function distance(a: CadPoint2, b: CadPoint2): number { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

function matchingSnap(context: LiveLinePointerContext | null, raw: CadPoint2, resolved: CadPoint2): LiveLineSnap | null {
  if (!context?.snap || distance(context.point, raw) > POINT_TOLERANCE
    || distance(context.snap.point, resolved) > POINT_TOLERANCE) return null;
  return context.snap;
}
function endpointReference(snap: LiveLineSnap | null): LiveLineEndpointReference | null {
  return snap && (snap.kind === 'endpoint' || snap.kind === 'chain-start') && snap.ref ? { ...snap.ref } : null;
}
function findLine(app: CadApplication, sketchId: CadSketchId, entityId: CadSketchEntityId): CadSketchLineEntity | null {
  const document = app.getDocument();
  if (document.kind !== 'part') return null;
  return document.sketches.find(item => item.id === sketchId)?.entities.find(
    (entity): entity is CadSketchLineEntity => entity.id === entityId && entity.type === 'line',
  ) ?? null;
}
function sketchFingerprint(document: Readonly<CadDocument>, sketchId: CadSketchId | null): string {
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
