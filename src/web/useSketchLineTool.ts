import { useCallback, useEffect, useRef, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import {
  emptyLineInput, lineInputView, moveLineInput,
  type SketchLineField, type SketchLineNumericInput, type SketchLineNumericState,
} from './SketchLineNumericInput';
export type { SketchLineDraft } from './SketchLineNumericInput';

export interface UseSketchLineToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
}

/** One transient Line owner; every accepted object is one normal sketch.line. */
export function useSketchLineTool(options: UseSketchLineToolOptions) {
  const { app, sketchId, active } = options;
  const [state, setState] = useState(emptyLineInput);
  const [committing, setCommitting] = useState(false);
  const [focusRevision, setFocusRevision] = useState(0);
  const current = useRef(state);
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(false);
  const epoch = useRef(0);
  const flight = useRef(false);
  const document = app.getDocument();
  const observedDocument = useRef(document);

  const publish = useCallback((next: SketchLineNumericState) => {
    current.current = next;
    setState(next);
  }, []);
  const reset = useCallback(() => {
    epoch.current += 1;
    publish(emptyLineInput(current.current.pointer));
    setFocusRevision(0);
  }, [publish]);

  useEffect(() => {
    mounted.current = true;
    reset();
    return () => { mounted.current = false; epoch.current += 1; };
  }, [active, app, sketchId, reset]);
  useEffect(() => {
    if (observedDocument.current === document) return;
    observedDocument.current = document;
    reset();
  }, [document, reset]);

  const available = () => latest.current.active && !!latest.current.sketchId && !flight.current;

  const move = useCallback((pointer: CadPoint2) => {
    if (!latest.current.active || flight.current || !pointer.every(Number.isFinite)) return;
    publish(moveLineInput(current.current, pointer));
  }, [publish]);

  const commit = useCallback(async (input: SketchLineNumericState): Promise<boolean> => {
    const owner = latest.current;
    if (!mounted.current || !owner.active || !owner.sketchId || flight.current) return false;
    const view = lineInputView(input);
    if (!view.canCommit || !view.from || !view.to) {
      owner.setNotice(view.error ?? (input.anchor
        ? 'Конечная точка должна отличаться от начальной'
        : 'Укажите первую точку либо задайте длину и угол'));
      return false;
    }

    flight.current = true;
    setCommitting(true);
    const request = ++epoch.current;
    const ownsContext = () => mounted.current && epoch.current === request
      && latest.current.app === owner.app && latest.current.active
      && latest.current.sketchId === owner.sketchId;
    let submittedDocument = owner.app.getDocument();
    let submittedIntent = JSON.stringify(submittedDocument);
    const ownsResult = () => ownsContext() && owner.app.getDocument() === submittedDocument
      && JSON.stringify(submittedDocument) === submittedIntent;
    try {
      const pending = owner.app.execute({
        id: 'sketch.line',
        payload: { sketchId: owner.sketchId, from: view.from, to: view.to },
      });
      // The existing geometry command applies synchronously. Its error rollback
      // can replace the document with an equivalent clone: bind to that outcome.
      submittedDocument = owner.app.getDocument();
      submittedIntent = JSON.stringify(submittedDocument);
      observedDocument.current = submittedDocument;
      const result = await pending;
      if (!ownsResult()) {
        if (ownsContext()) reset();
        return false;
      }
      if (!result.ok) {
        owner.setNotice(result.error?.message ?? 'Не удалось создать отрезок');
        return false;
      }
      publish(emptyLineInput(input.pointer));
      setFocusRevision(0);
      owner.setNotice(`Отрезок создан: ${formatPoint(view.from)} → ${formatPoint(view.to)}. Укажите новую первую точку`);
      return true;
    } catch (error) {
      if (ownsResult()) owner.setNotice(error instanceof Error ? error.message : 'Не удалось создать отрезок');
      return false;
    } finally {
      flight.current = false;
      if (mounted.current) setCommitting(false);
    }
  }, [publish, reset]);

  const choosePoint = useCallback(async (pointer: CadPoint2): Promise<boolean> => {
    if (!latest.current.active || !latest.current.sketchId || flight.current
      || !pointer.every(Number.isFinite)) return false;
    const next = moveLineInput(current.current, pointer);
    const view = lineInputView(next);
    if (next.anchor || view.placementReady) return commit(next);
    publish({ ...next, anchor: pointer });
    latest.current.setNotice('Укажите конечную точку отрезка');
    return true;
  }, [commit, publish]);

  const point = useCallback(async (pointer: CadPoint2) => {
    await choosePoint(pointer);
  }, [choosePoint]);
  const commitPreview = useCallback(() => commit(current.current), [commit]);
  const change = useCallback((field: SketchLineField, text: string) => {
    if (!latest.current.active || flight.current) return;
    publish({ ...current.current, edited: { ...current.current.edited, [field]: text } });
  }, [publish]);
  const unlock = useCallback((field: 'length' | 'angle') => {
    if (!latest.current.active || flight.current) return;
    const edited = { ...current.current.edited };
    delete edited[field];
    publish({ ...current.current, edited });
  }, [publish]);
  const beginEntry = (text: string) => {
    if (!available()) return;
    change('length', text);
    setFocusRevision((value) => value + 1);
  };
  const enter = async (field?: SketchLineField): Promise<boolean> => {
    if (field === 'x' || field === 'y') {
      const view = lineInputView(current.current);
      if (view.fields.x.invalid || view.fields.y.invalid) return false;
      return choosePoint(view.point);
    }
    return commitPreview();
  };
  const cancelDraft = () => {
    if (!current.current.anchor) return false;
    reset();
    latest.current.setNotice('Укажите новую первую точку отрезка');
    return true;
  };
  const view = lineInputView(state);
  const input: SketchLineNumericInput = {
    anchored: !!state.anchor, fields: view.fields, canCommit: view.canCommit && !committing,
    committing, error: view.error, focusRevision, change, unlock, beginEntry, enter, cancelDraft,
  };

  return { draft: view.draft, input, committing, move, point, reset, commitPreview };
}

function formatPoint(point: CadPoint2): string {
  return `${point[0].toFixed(1)}, ${point[1].toFixed(1)}`;
}
