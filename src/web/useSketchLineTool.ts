import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

export interface SketchLineDraft {
  from: CadPoint2 | null;
  to: CadPoint2 | null;
}

export interface UseSketchLineToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}

const EMPTY_DRAFT: SketchLineDraft = { from: null, to: null };
const MIN_LINE_LENGTH = 1e-6;

/**
 * Transient M3 Line interaction owner.
 *
 * Pointer/ghost state never mutates CadDocument. The second accepted point
 * commits exactly one normal `sketch.line` CadApplication command, keeping
 * Undo/Redo atomic and solver preview downstream of the persisted mutation.
 */
export function useSketchLineTool(options: UseSketchLineToolOptions) {
  const { app, sketchId, active, setNotice, onCommitted } = options;
  const [draft, setDraft] = useState<SketchLineDraft>(EMPTY_DRAFT);
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
    if (!active || !draft.from || committing) return;
    setDraft((current) => current.from ? { from: current.from, to: point } : current);
  }, [active, committing, draft.from]);

  const commitFromDraft = useCallback(async (to: CadPoint2) => {
    if (!active || !sketchId || !draft.from || committing) return false;
    if (distance(draft.from, to) <= MIN_LINE_LENGTH) {
      setNotice('Конечная точка должна отличаться от начальной');
      return false;
    }

    setCommitting(true);
    const from = draft.from;
    const result = await app.execute({
      id: 'sketch.line',
      payload: { sketchId, from, to },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать отрезок');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice(`Отрезок создан: ${formatPoint(from)} → ${formatPoint(to)}`);
    onCommitted();
    return true;
  }, [active, app, committing, draft.from, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.from) {
      setDraft({ from: value, to: value });
      setNotice('Укажите конечную точку отрезка');
      return;
    }
    await commitFromDraft(value);
  }, [active, commitFromDraft, committing, draft.from, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.to) return false;
    return commitFromDraft(draft.to);
  }, [commitFromDraft, draft.to]);

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

function formatPoint(point: CadPoint2): string {
  return `${point[0].toFixed(1)}, ${point[1].toFixed(1)}`;
}
