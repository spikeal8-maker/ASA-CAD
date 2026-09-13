import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

export interface SketchArcDraft {
  center: CadPoint2 | null;
  start: CadPoint2 | null;
  end: CadPoint2 | null;
  hover: CadPoint2 | null;
}

export interface UseSketchArcToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}

const EMPTY_DRAFT: SketchArcDraft = {
  center: null,
  start: null,
  end: null,
  hover: null,
};
const MIN_RADIUS = 1e-6;
const MIN_SWEEP = 1e-9;
const TWO_PI = Math.PI * 2;

/**
 * Transient M3 Arc interaction owner.
 *
 * Construction is intentionally one contract only: center -> start -> end.
 * Draft/ghost state never mutates CadDocument; the third accepted point commits
 * exactly one normal `sketch.arc` CadApplication command so Undo/Redo remains
 * atomic and PlaneGCS preview stays downstream of persisted geometry.
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
    if (!draft.start) {
      setDraft((current) => current.center
        ? { ...current, hover: point }
        : current);
      return;
    }
    setDraft((current) => current.center && current.start
      ? { ...current, end: point, hover: point }
      : current);
  }, [active, committing, draft.center, draft.start]);

  const commitFromDraft = useCallback(async (end: CadPoint2) => {
    if (!active || !sketchId || !draft.center || !draft.start || committing) return false;
    const radius = distance(draft.center, draft.start);
    if (radius <= MIN_RADIUS) {
      setNotice('Радиус дуги должен быть больше нуля');
      return false;
    }
    const sweep = positiveSweep(
      angle(draft.center, draft.start),
      angle(draft.center, end),
    );
    if (!(sweep > MIN_SWEEP) || !(sweep < TWO_PI - MIN_SWEEP)) {
      setNotice('Конечная точка должна задавать ненулевую дугу');
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
      setDraft({ center: value, start: null, end: null, hover: value });
      setNotice('Укажите начальную точку дуги');
      return;
    }
    if (!draft.start) {
      if (distance(draft.center, value) <= MIN_RADIUS) {
        setNotice('Начальная точка должна отличаться от центра дуги');
        return;
      }
      setDraft({ center: draft.center, start: value, end: value, hover: value });
      setNotice('Укажите конечную точку дуги');
      return;
    }
    await commitFromDraft(value);
  }, [active, commitFromDraft, committing, draft.center, draft.start, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.end) return false;
    return commitFromDraft(draft.end);
  }, [commitFromDraft, draft.end]);

  return {
    draft,
    committing,
    move,
    point,
    reset,
    commitPreview,
  };
}

function distance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function angle(center: CadPoint2, point: CadPoint2): number {
  return normalizeAngle(Math.atan2(point[1] - center[1], point[0] - center[0]));
}

function normalizeAngle(value: number): number {
  const normalized = value % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

function positiveSweep(start: number, end: number): number {
  const sweep = normalizeAngle(end) - normalizeAngle(start);
  return sweep > 0 ? sweep : sweep + TWO_PI;
}

function formatLength(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
