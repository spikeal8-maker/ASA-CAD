import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

export interface SketchRectangleDraft {
  from: CadPoint2 | null;
  to: CadPoint2 | null;
}

export interface UseSketchRectangleToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(width: number, height: number): void;
}

const EMPTY_DRAFT: SketchRectangleDraft = { from: null, to: null };
const MIN_RECTANGLE_SIZE = 1e-6;

/**
 * Transient M3 Rectangle interaction owner.
 *
 * The first/opposite-corner draft never mutates CadDocument. The second
 * accepted point is normalized into canonical origin + positive width/height
 * and commits exactly one normal `sketch.rectangle` CadApplication command.
 * Driving dimensions remain a separate explicit path.
 */
export function useSketchRectangleTool(options: UseSketchRectangleToolOptions) {
  const { app, sketchId, active, setNotice, onCommitted } = options;
  const [draft, setDraft] = useState<SketchRectangleDraft>(EMPTY_DRAFT);
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
    const rectangle = normalizeRectangle(draft.from, to);
    if (!rectangle) {
      setNotice('Ширина и высота прямоугольника должны быть больше нуля');
      return false;
    }

    setCommitting(true);
    const result = await app.execute({
      id: 'sketch.rectangle',
      payload: {
        sketchId,
        origin: rectangle.origin,
        width: rectangle.width,
        height: rectangle.height,
      },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать прямоугольник');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice(`Прямоугольник ${formatLength(rectangle.width)}×${formatLength(rectangle.height)} мм создан`);
    onCommitted(rectangle.width, rectangle.height);
    return true;
  }, [active, app, committing, draft.from, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.from) {
      setDraft({ from: value, to: value });
      setNotice('Укажите противоположный угол прямоугольника');
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

export function normalizeRectangle(from: CadPoint2, to: CadPoint2): {
  origin: CadPoint2;
  width: number;
  height: number;
} | null {
  const minX = Math.min(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const width = Math.abs(to[0] - from[0]);
  const height = Math.abs(to[1] - from[1]);
  if (width <= MIN_RECTANGLE_SIZE || height <= MIN_RECTANGLE_SIZE) return null;
  return { origin: [minX, minY], width, height };
}

function formatLength(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
