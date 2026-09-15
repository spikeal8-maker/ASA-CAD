import { useEffect, useMemo } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import { BrowserSketchSolverAdapter } from '../browser/BrowserSketchSolverAdapter';

type OrientationConstraint = 'horizontal' | 'vertical';

export interface SketchConstraintControllerOptions {
  app: CadApplication;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setNotice(message: string): void;
}

/** Focused ASA-owned UI owner for Sketch constraint commands. */
export function useSketchConstraintController(options: SketchConstraintControllerOptions) {
  const { app, activeSketchId, sketch, selectedEntityId, setNotice } = options;
  const freezeSolver = useMemo(() => new BrowserSketchSolverAdapter(), []);
  useEffect(() => () => freezeSolver.dispose(), [freezeSolver]);

  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const canApplyOrientationConstraint = selectedEntity?.type === 'line';
  const canApplyFixedConstraint = selectedEntity?.type === 'line' && !hasFixedConstraint(app.getDocument(), activeSketchId, selectedEntityId);

  async function applyOrientationConstraint(type: OrientationConstraint): Promise<boolean> {
    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'line') {
      setNotice('Выберите отрезок эскиза');
      return false;
    }

    const result = await app.execute({
      id: type === 'horizontal' ? 'constraint.horizontal' : 'constraint.vertical',
      payload: { sketchId: activeSketchId, entityId: selectedEntityId },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось применить ограничение');
      return false;
    }

    setNotice(type === 'horizontal' ? 'Горизонтальность применена' : 'Вертикальность применена');
    return true;
  }

  async function applyFixedConstraint(): Promise<boolean> {
    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'line') {
      setNotice('Выберите отрезок эскиза');
      return false;
    }

    const document = app.getDocument();
    if (document.kind !== 'part') {
      setNotice('Фиксация доступна только в детали');
      return false;
    }

    try {
      await freezeSolver.init();
      const solved = freezeSolver.solve(document, activeSketchId);
      if (!solved.ok || !solved.converged) {
        setNotice(solved.diagnostics[0]?.message ?? 'Эскиз не удалось решить перед фиксацией');
        return false;
      }

      const solvedEntity = solved.entities.find((entity) => entity.id === selectedEntityId);
      if (!solvedEntity || solvedEntity.type !== 'line') {
        setNotice('Решённая геометрия выбранного отрезка недоступна');
        return false;
      }

      const result = await app.execute({
        id: 'constraint.fixed',
        payload: {
          sketchId: activeSketchId,
          entityId: selectedEntityId,
          frozenGeometry: {
            type: 'line',
            from: solvedEntity.data.from,
            to: solvedEntity.data.to,
          },
        },
      });
      if (!result.ok) {
        setNotice(result.error?.message ?? 'Не удалось зафиксировать отрезок');
        return false;
      }

      setNotice('Отрезок зафиксирован');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  return {
    canApplyOrientationConstraint,
    canApplyFixedConstraint,
    applyHorizontalConstraint: () => applyOrientationConstraint('horizontal'),
    applyVerticalConstraint: () => applyOrientationConstraint('vertical'),
    applyFixedConstraint,
  };
}

function hasFixedConstraint(
  document: ReturnType<CadApplication['getDocument']>,
  sketchId: CadSketchId | null,
  entityId: CadSketchEntityId | null,
): boolean {
  if (!sketchId || !entityId || document.kind !== 'part') return false;
  const part: Readonly<CadPartDocument> = document;
  const sketch = part.sketches.find((item) => item.id === sketchId);
  if (!sketch) return false;
  const ids = new Set(sketch.constraintIds);
  return part.constraints.some((constraint) => (
    ids.has(constraint.id)
    && constraint.type === 'fixed'
    && constraint.entityIds[0] === entityId
  ));
}
