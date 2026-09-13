import { useCallback, useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPoint2 } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { sketchArcGeometryFromPoints } from './viewport/SketchArcGeometry';

export interface SketchArcDraft {
  center: CadPoint2 | null;
  start: CadPoint2 | null;
  preview: CadPoint2 | null;
}

export interface UseSketchArcToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}

const EMPTY_DRAFT: SketchArcDraft = { center: null, start: null, preview: null };
const MIN_RADIUS = 1e-6;

/** Transient M3 Arc tool. Persisted mutation happens only through one sketch.arc command. */
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
    setDraft((current) => current.center ? { ...current, preview: point } : current);
  }, [active, committing, draft.center]);

  const commitArc = useCallback(async (end: CadPoint2) => {
    if (!active || !sketchId || !draft.center || !draft.start || committing) return false;
    if (!sketchArcGeometryFromPoints(draft.center, draft.start, end)) {
      setNotice('Дуга должна иметь ненулевой радиус и sweep меньше полного оборота');
      return false;
    }

    setCommitting(true);
    const result = await app.execute({
      id: 'sketch.arc',
      payload: { sketchId, center: draft.center, start: draft.start, end },
    });
    setCommitting(false);

    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать дугу');
      return false;
    }

    setDraft(EMPTY_DRAFT);
    setNotice('Дуга создана');
    onCommitted();
    return true;
  }, [active, app, committing, draft.center, draft.start, onCommitted, setNotice, sketchId]);

  const point = useCallback(async (value: CadPoint2) => {
    if (!active || committing) return;
    if (!draft.center) {
      setDraft({ center: value, start: null, preview: value });
      setNotice('Укажите начальную точку дуги');
      return;
    }
    if (!draft.start) {
      if (Math.hypot(value[0] - draft.center[0], value[1] - draft.center[1]) <= MIN_RADIUS) {
        setNotice('Радиус дуги должен быть больше нуля');
        return;
      }
      setDraft({ center: draft.center, start: value, preview: value });
      setNotice('Укажите конечную точку дуги');
      return;
    }
    await commitArc(value);
  }, [active, commitArc, committing, draft.center, draft.start, setNotice]);

  const commitPreview = useCallback(async () => {
    if (!draft.preview || !draft.start) return false;
    return commitArc(draft.preview);
  }, [commitArc, draft.preview, draft.start]);

  return { draft, committing, move, point, reset, commitPreview };
}
