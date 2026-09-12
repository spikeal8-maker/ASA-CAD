import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import {
  positiveSketchArcSweep,
  SKETCH_FULL_TURN,
  sketchPointAngle,
  sketchPointDistance,
} from './SketchArcGeometry';

export interface SketchArcDraft {
  center: CadPoint2 | null;
  start: CadPoint2 | null;
  cursor: CadPoint2 | null;
}

export interface UseSketchArcToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}

const EMPTY_DRAFT: SketchArcDraft = { center: null, start: null, cursor: null };
const MIN_RADIUS = 1e-6;
const MIN_SWEEP = 1e-6;

/**
 * Transient M3 Arc interaction owner for the accepted center -> start -> end mode.
 * Persisted state changes only through one typed `sketch.arc` application command.
 */
export function useSketchArcTool(options: UseSketchArcToolOptions) {
  const { app, sketchId, active, setNotice, onCommitted } = options;
  const [draft, setDraft] = useState<SketchArcDraft>(EMPTY_DRAFT);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (!active) {
      setDraft(EMPTY_DRAFT);
      setCommitting(false);
    }
  }, [active, sketchId]);

  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setCommitting(false);
  }, []);

  const move = useCallback((point: CadPoint2) => {
    if (!active || !draft.center || committing) return;
    setDraft((current) => current.center ? { ...current, cursor: point } : current);
  }, [active, committing, draft.center]);

  const commitFromDraft = useCallback(async (end: CadPoint2) => {
    if (!active || !sketchId || !draft.center || !draft.start || committing) return false;
    const radius = sketchPointDistance(draft.center, draft.start);
    if (!(radius > MIN_RADIUS)) {
      setNotice('Радиус дуги должен быть больше нуля');
      return false;
    }
    const startAngle = sketchPointAngle(draft.center, draft.start);
    const endAngle = sketchPointAngle(draft.center, end);
    const sweep = positiveSketchArcSweep(startAngle, endAngle);
    if (!(sweep > MIN_SWEEP) || !(sweep < SKETCH_FULL_TURN - MIN_SWEEP)) {
      setNotice('Угол дуги должен быть больше нуля и меньше полного оборота');
      return false;
    }

    const center = draft.center;
    const start = draft.start;
    setCommitting(true);
    const result = await app.execute({
      id: 'sketch.arc',
      payload: { sketchId, center, start, end },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать дугу');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice(`Дуга создана: R${formatLength(radius)} мм`);
    onCommitted();
    return true;
  }, [active, app, committing, draft.center, draft.start, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.center) {
      setDraft({ center: value, start: null, cursor: value });
      setNotice('Укажите начальную точку дуги');
      return;
    }
    if (!draft.start) {
      if (!(sketchPointDistance(draft.center, value) > MIN_RADIUS)) {
        setNotice('Начальная точка дуги должна отличаться от центра');
        return;
      }
      setDraft({ center: draft.center, start: value, cursor: value });
      setNotice('Укажите конечную точку дуги');
      return;
    }
    await commitFromDraft(value);
  }, [active, commitFromDraft, committing, draft.center, draft.start, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.cursor) return false;
    return commitFromDraft(draft.cursor);
  }, [commitFromDraft, draft.cursor]);

  return {
    draft,
    committing,
    move,
    point,
    reset,
    commitPreview,
  };
}

function formatLength(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
