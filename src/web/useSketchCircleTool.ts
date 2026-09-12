import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

export interface SketchCircleDraft {
  center: CadPoint2 | null;
  edge: CadPoint2 | null;
}

export interface UseSketchCircleToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(diameter: number): void;
}

const EMPTY_DRAFT: SketchCircleDraft = { center: null, edge: null };
const MIN_RADIUS = 1e-6;

/**
 * Transient M3 Circle interaction owner.
 *
 * Center/radius preview never mutates CadDocument. The second accepted point
 * commits exactly one normal `sketch.circle` command; driving diameter remains
 * the existing separate `dimension.diameter` path.
 */
export function useSketchCircleTool(options: UseSketchCircleToolOptions) {
  const { app, sketchId, active, setNotice, onCommitted } = options;
  const [draft, setDraft] = useState<SketchCircleDraft>(EMPTY_DRAFT);
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
    setDraft((current) => current.center ? { center: current.center, edge: point } : current);
  }, [active, committing, draft.center]);

  const commitFromDraft = useCallback(async (edge: CadPoint2) => {
    if (!active || !sketchId || !draft.center || committing) return false;
    const radius = distance(draft.center, edge);
    if (radius <= MIN_RADIUS) {
      setNotice('Радиус окружности должен быть больше нуля');
      return false;
    }

    const center = draft.center;
    const diameter = radius * 2;
    setCommitting(true);
    const result = await app.execute({
      id: 'sketch.circle',
      payload: { sketchId, center, diameter },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать окружность');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice(`Окружность создана: Ø${formatLength(diameter)} мм`);
    onCommitted(diameter);
    return true;
  }, [active, app, committing, draft.center, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.center) {
      setDraft({ center: value, edge: value });
      setNotice('Укажите точку окружности');
      return;
    }
    await commitFromDraft(value);
  }, [active, commitFromDraft, committing, draft.center, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.edge) return false;
    return commitFromDraft(draft.edge);
  }, [commitFromDraft, draft.edge]);

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

function formatLength(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
