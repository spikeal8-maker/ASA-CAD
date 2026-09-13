import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { canonicalSketchRectangle } from './viewport/SketchRectangleGeometry';

export interface SketchRectangleDraft {
  first: CadPoint2 | null;
  opposite: CadPoint2 | null;
  hover: CadPoint2 | null;
}

export interface UseSketchRectangleToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(width: number, height: number): void;
}

const EMPTY_DRAFT: SketchRectangleDraft = {
  first: null,
  opposite: null,
  hover: null,
};

/**
 * Transient M3 direct Rectangle owner.
 *
 * Direct interaction is first corner -> opposite corner. The draft/ghost never
 * mutates CadDocument. The second accepted point canonicalizes arbitrary drag
 * direction into origin + positive width/height and commits exactly one
 * `sketch.rectangle` CadApplication history mutation.
 *
 * Numeric Width/Height Rectangle remains a separate presentation of the same
 * typed command through the existing ParameterPanel workflow.
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
    if (!active || !draft.first || committing) return;
    setDraft((current) => current.first
      ? { ...current, opposite: point, hover: point }
      : current);
  }, [active, committing, draft.first]);

  const commit = useCallback(async (opposite: CadPoint2) => {
    if (!active || !sketchId || !draft.first || committing) return false;
    const geometry = canonicalSketchRectangle(draft.first, opposite);
    if (!geometry) {
      setNotice('Ширина и высота прямоугольника должны быть больше нуля');
      return false;
    }

    setCommitting(true);
    const result = await app.execute({
      id: 'sketch.rectangle',
      payload: {
        sketchId,
        origin: geometry.origin,
        width: geometry.width,
        height: geometry.height,
      },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать прямоугольник');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice(`Прямоугольник ${formatLength(geometry.width)}×${formatLength(geometry.height)} мм создан`);
    onCommitted(geometry.width, geometry.height);
    return true;
  }, [active, app, committing, draft.first, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.first) {
      setDraft({ first: value, opposite: null, hover: value });
      setNotice('Укажите противоположный угол прямоугольника');
      return;
    }
    await commit(value);
  }, [active, commit, committing, draft.first, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.opposite) return false;
    return commit(draft.opposite);
  }, [commit, draft.opposite]);

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
