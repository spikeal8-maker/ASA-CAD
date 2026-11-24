import { useCallback, useEffect, useRef, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import {
  circleDistance, circleInputView, emptyCircleInput, moveCircleInput,
  type SketchCircleDraft, type SketchCircleField, type SketchCircleNumericInput, type SketchCircleNumericState,
} from './SketchCircleNumericInput';
export type { SketchCircleDraft } from './SketchCircleNumericInput';

export interface UseSketchCircleToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  /** Last accepted diameter: shown while no center and no typed diameter exist. */
  defaultDiameter: number;
  setNotice(message: string): void;
  onCommitted?(diameter: number): void;
  /** Parametric origin fallback ([0,0] + driving diameter), owned by the controller. */
  onParametric?(diameter: number): Promise<boolean>;
}

/** Bounded validation token, not a second document or a resolved support frame. */
function circleContext(options: UseSketchCircleToolOptions) {
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
type CircleContext = ReturnType<typeof circleContext>;
function sameContext(a: CircleContext, b: CircleContext): boolean {
  return !!a && !!b && a.app === b.app && a.document === b.document
    && a.sketch === b.sketch && a.intent === b.intent;
}

/** One transient center/diameter owner; commit is one existing sketch.circle. */
export function useSketchCircleTool(options: UseSketchCircleToolOptions) {
  const { app, sketchId, active } = options;
  const [state, setState] = useState(emptyCircleInput);
  const [committing, setCommitting] = useState(false);
  const [focusRevision, setFocusRevision] = useState(0);
  const current = useRef(state);
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(false);
  const epoch = useRef(0);
  const flight = useRef<object | null>(null);
  const applying = useRef(false);
  const context = useRef<CircleContext>(null);

  const publish = useCallback((next: SketchCircleNumericState) => {
    current.current = next;
    setState(next);
  }, []);
  const reset = useCallback(() => {
    epoch.current += 1;
    context.current = circleContext(latest.current);
    publish(emptyCircleInput(current.current.pointer));
    setFocusRevision(0);
  }, [publish]);
  useEffect(() => {
    mounted.current = true;
    reset();
    const unsubscribe = app.subscribe(() => {
      if (!mounted.current || applying.current || !latest.current.active || latest.current.app !== app) return;
      if (!sameContext(context.current, circleContext(latest.current))) reset();
    });
    return () => { unsubscribe(); mounted.current = false; epoch.current += 1; };
  }, [active, app, sketchId, reset]);

  const available = () => mounted.current && latest.current.active && !flight.current
    && context.current?.app === latest.current.app
    && context.current.sketch.id === latest.current.sketchId
    && context.current.document === latest.current.app.getDocument();
  const validateContext = useCallback(() => {
    if (!mounted.current || !latest.current.active || flight.current) return false;
    if (sameContext(context.current, circleContext(latest.current))) return true;
    reset();
    return false;
  }, [reset]);
  const move = useCallback((pointer: CadPoint2) => {
    if (!available() || !pointer.every(Number.isFinite)) return;
    publish(moveCircleInput(current.current, pointer));
  }, [publish]);

  const commit = useCallback(async (input: SketchCircleNumericState): Promise<boolean> => {
    if (!validateContext()) return false;
    const owner = latest.current;
    const view = circleInputView(input, owner.defaultDiameter);
    if (!owner.sketchId) {
      owner.setNotice('Сначала создайте эскиз');
      return false;
    }
    if (!view.canonical) {
      owner.setNotice(view.error ?? (!input.center ? 'Укажите центр окружности'
        : circleDistance(input.center, view.point) <= 1e-6
          ? 'Точка окружности должна отличаться от центра'
          : 'Диаметр окружности должен быть больше нуля'));
      return false;
    }
    const request = {};
    flight.current = request;
    const requestEpoch = ++epoch.current;
    setCommitting(true);
    let submitted = context.current;
    const ownsContext = () => mounted.current && epoch.current === requestEpoch && flight.current === request
      && latest.current.app === owner.app && latest.current.active && latest.current.sketchId === owner.sketchId;
    const ownsResult = () => ownsContext() && sameContext(submitted, circleContext(latest.current));
    try {
      applying.current = true;
      let pending: ReturnType<CadApplication['execute']>;
      try {
        pending = owner.app.execute({
          id: 'sketch.circle',
          payload: { sketchId: owner.sketchId, center: view.canonical.center, diameter: view.canonical.radius * 2 },
        });
      } finally {
        applying.current = false;
        // Actual geometry commands apply synchronously; error rollback may
        // replace the document by an equivalent clone. Bind before awaiting.
        submitted = circleContext(latest.current);
        context.current = submitted;
      }
      const result = await pending;
      if (!ownsResult()) {
        if (ownsContext()) reset();
        return false;
      }
      if (!result.ok) {
        latest.current.setNotice(result.error?.message ?? 'Не удалось создать окружность');
        return false;
      }
      publish(emptyCircleInput(view.point));
      setFocusRevision(0);
      const diameter = view.canonical.radius * 2;
      latest.current.setNotice(`Окружность создана: Ø${Number(diameter.toFixed(4))} мм`);
      latest.current.onCommitted?.(diameter);
      return true;
    } catch (error) {
      if (ownsResult()) latest.current.setNotice(error instanceof Error ? error.message : 'Не удалось создать окружность');
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
    const next = moveCircleInput(current.current, pointer);
    const view = circleInputView(next, latest.current.defaultDiameter);
    if (view.error) { publish(next); latest.current.setNotice(view.error); return false; }
    if (!next.center) {
      publish({ ...next, center: pointer });
      latest.current.setNotice('Укажите точку на окружности или введите диаметр');
      return true;
    }
    publish(next);
    return commit(next);
  }, [commit, publish, validateContext]);
  const point = useCallback(async (pointer: CadPoint2) => { await choosePoint(pointer); }, [choosePoint]);
  const commitPreview = useCallback(() => commit(current.current), [commit]);
  const change = useCallback((field: SketchCircleField, text: string) => {
    if (!available()) return;
    publish({ ...current.current, edited: { ...current.current.edited, [field]: text } });
  }, [publish]);
  const unlockDiameter = () => {
    if (!available()) return;
    const { diameter: _diameter, ...edited } = current.current.edited;
    publish({ ...current.current, edited });
  };
  const beginEntry = (text: string) => {
    if (!available()) return;
    change('diameter', text);
    setFocusRevision((value) => value + 1);
  };
  const enter = async (field?: SketchCircleField): Promise<boolean> => {
    if (!available()) return false;
    const owner = latest.current;
    const view = circleInputView(current.current, owner.defaultDiameter);
    if (view.error) { owner.setNotice(view.error); return false; }
    if (field === 'x' || field === 'y') {
      return choosePoint(view.point);
    }
    if (!current.current.center) {
      return owner.onParametric ? owner.onParametric(view.diameter) : false;
    }
    return commitPreview();
  };
  const cancelDraft = () => {
    if (!mounted.current || !latest.current.active || !current.current.center) return false;
    reset();
    latest.current.setNotice('Укажите новый центр окружности');
    return true;
  };
  const view = circleInputView(state, options.defaultDiameter);
  const input: SketchCircleNumericInput = {
    phase: view.phase, fields: view.fields, diameterLocked: view.diameterLocked,
    canCommit: view.canCommit && !committing, committing, error: view.error, focusRevision,
    change, unlockDiameter, beginEntry, enter, cancelDraft,
  };
  return { draft: view.draft, input, committing, move, point, reset, commitPreview };
}
