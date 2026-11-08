import { useCallback, useEffect, useRef, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import {
  arcDistance, arcInputView, emptyArcInput, moveArcInput, MIN_ARC_RADIUS,
  type SketchArcField, type SketchArcNumericInput, type SketchArcNumericState,
} from './SketchArcNumericInput';
export type { SketchArcDraft } from './SketchArcNumericInput';

export interface UseSketchArcToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted?(): void;
}

/** Bounded validation token, not a second document or a resolved support frame. */
function arcContext(options: UseSketchArcToolOptions) {
  const document = options.app.getDocument();
  if (!options.active || !options.sketchId || document.kind !== 'part') return null;
  const sketch = document.sketches.find((item) => item.id === options.sketchId);
  if (!sketch) return null;
  return {
    app: options.app, document, sketch,
    intent: JSON.stringify([
      document.kind, document.documentId, document.units, sketch,
      sketch.constraintIds.map((id) => document.constraints.find((item) => item.id === id)),
      sketch.dimensionIds.map((id) => document.dimensions.find((item) => item.id === id)),
      document.stableReferences.find((item) => item.id === sketch.support),
    ]),
  };
}
type ArcContext = ReturnType<typeof arcContext>;
function sameContext(a: ArcContext, b: ArcContext): boolean {
  return !!a && !!b && a.app === b.app && a.document === b.document
    && a.sketch === b.sketch && a.intent === b.intent;
}

/** One transient center/start/sweep owner; commit is one existing sketch.arc. */
export function useSketchArcTool(options: UseSketchArcToolOptions) {
  const { app, sketchId, active } = options;
  const [state, setState] = useState(emptyArcInput);
  const [committing, setCommitting] = useState(false);
  const [focusRevision, setFocusRevision] = useState(0);
  const current = useRef(state);
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(false);
  const epoch = useRef(0);
  const flight = useRef<object | null>(null);
  const applying = useRef(false);
  const context = useRef<ArcContext>(null);

  const publish = useCallback((next: SketchArcNumericState) => {
    current.current = next;
    setState(next);
  }, []);
  const reset = useCallback(() => {
    epoch.current += 1;
    context.current = arcContext(latest.current);
    publish(emptyArcInput(current.current.pointer));
    setFocusRevision(0);
  }, [publish]);
  useEffect(() => {
    mounted.current = true;
    reset();
    const unsubscribe = app.subscribe(() => {
      if (!mounted.current || applying.current || !latest.current.active || latest.current.app !== app) return;
      if (!sameContext(context.current, arcContext(latest.current))) reset();
    });
    return () => { unsubscribe(); mounted.current = false; epoch.current += 1; };
  }, [active, app, sketchId, reset]);

  const available = () => mounted.current && latest.current.active && !flight.current
    && context.current?.app === latest.current.app
    && context.current.sketch.id === latest.current.sketchId
    && context.current.document === latest.current.app.getDocument();
  const validateContext = useCallback(() => {
    if (!mounted.current || !latest.current.active || flight.current) return false;
    if (sameContext(context.current, arcContext(latest.current))) return true;
    reset();
    return false;
  }, [reset]);
  const move = useCallback((pointer: CadPoint2) => {
    if (!available() || !pointer.every(Number.isFinite)) return;
    publish(moveArcInput(current.current, pointer));
  }, [publish]);

  const commit = useCallback(async (input: SketchArcNumericState): Promise<boolean> => {
    if (!validateContext()) return false;
    const owner = latest.current;
    const view = arcInputView(input);
    if (!view.canonical || !owner.sketchId) {
      owner.setNotice(view.error ?? (!input.center ? 'Укажите центр дуги' : !input.start
        ? 'Укажите начальную точку дуги'
        : arcDistance(input.center, view.point) <= MIN_ARC_RADIUS
          ? 'Конечная точка должна отличаться от центра дуги'
          : 'Конечная точка должна задавать ненулевую дугу'));
      return false;
    }
    const request = {};
    flight.current = request;
    const requestEpoch = ++epoch.current;
    setCommitting(true);
    let submitted = context.current;
    const ownsContext = () => mounted.current && epoch.current === requestEpoch && flight.current === request
      && latest.current.app === owner.app && latest.current.active && latest.current.sketchId === owner.sketchId;
    const ownsResult = () => ownsContext() && sameContext(submitted, arcContext(latest.current));
    try {
      applying.current = true;
      let pending: ReturnType<CadApplication['execute']>;
      try {
        pending = owner.app.execute({ id: 'sketch.arc', payload: { sketchId: owner.sketchId, ...view.canonical } });
      } finally {
        applying.current = false;
        // Actual geometry commands apply synchronously; error rollback may
        // replace the document by an equivalent clone. Bind before awaiting.
        submitted = arcContext(latest.current);
        context.current = submitted;
      }
      const result = await pending;
      if (!ownsResult()) {
        if (ownsContext()) reset();
        return false;
      }
      if (!result.ok) {
        latest.current.setNotice(result.error?.message ?? 'Не удалось создать дугу');
        return false;
      }
      publish(emptyArcInput(view.point));
      setFocusRevision(0);
      latest.current.setNotice(`Дуга создана: R${Number(view.radius.toFixed(4))} мм. Укажите новый центр`);
      latest.current.onCommitted?.();
      return true;
    } catch (error) {
      if (ownsResult()) latest.current.setNotice(error instanceof Error ? error.message : 'Не удалось создать дугу');
      return false;
    } finally {
      if (flight.current === request) {
        flight.current = null;
        if (mounted.current) setCommitting(false);
      }
    }
  }, [publish, reset, validateContext]);

  const choosePoint = useCallback(async (pointer: CadPoint2): Promise<boolean> => {
    if (!pointer.every(Number.isFinite) || !validateContext()) return false;
    const next = moveArcInput(current.current, pointer);
    const view = arcInputView(next);
    if (view.error) { publish(next); latest.current.setNotice(view.error); return false; }
    if (!next.center) {
      publish({ ...next, center: pointer });
      latest.current.setNotice('Укажите начальную точку дуги');
      return true;
    }
    if (!next.start) {
      if (!view.radiusPoint) {
        latest.current.setNotice('Начальная точка должна отличаться от центра дуги; радиус должен быть положительным');
        return false;
      }
      publish({ ...next, start: view.radiusPoint, sweep: 0,
        lastAngle: Math.atan2(pointer[1] - next.center[1], pointer[0] - next.center[0]) });
      latest.current.setNotice('Укажите конечную точку дуги');
      return true;
    }
    publish(next);
    return commit(next);
  }, [commit, publish, validateContext]);
  const point = useCallback(async (pointer: CadPoint2) => { await choosePoint(pointer); }, [choosePoint]);
  const commitPreview = useCallback(() => commit(current.current), [commit]);
  const change = useCallback((field: SketchArcField, text: string) => {
    if (!available() || (field === 'radius' && (!current.current.center || current.current.start))) return;
    publish({ ...current.current, edited: { ...current.current.edited, [field]: text } });
  }, [publish]);
  const unlockRadius = () => {
    if (!available() || current.current.start) return;
    const { radius: _radius, ...edited } = current.current.edited;
    publish({ ...current.current, edited });
  };
  const beginEntry = (text: string) => {
    if (!available() || !current.current.center || current.current.start) return;
    change('radius', text);
    setFocusRevision((value) => value + 1);
  };
  const enter = async (field?: SketchArcField): Promise<boolean> => {
    if (!available()) return false;
    const view = arcInputView(current.current);
    if (field === 'x' || field === 'y') {
      if (view.error) { latest.current.setNotice(view.error); return false; }
      return choosePoint(view.point);
    }
    return commitPreview();
  };
  const cancelDraft = () => {
    if (!mounted.current || !latest.current.active || !current.current.center) return false;
    reset();
    latest.current.setNotice('Укажите новый центр дуги');
    return true;
  };
  const view = arcInputView(state);
  const input: SketchArcNumericInput = {
    phase: view.phase, fields: view.fields, radiusLocked: view.radiusLocked, sweepText: view.sweepText,
    canCommit: view.canCommit && !committing, committing, error: view.error, focusRevision,
    change, unlockRadius, beginEntry, enter, cancelDraft,
  };
  return { draft: view.draft, input, committing, move, point, reset, commitPreview };
}
