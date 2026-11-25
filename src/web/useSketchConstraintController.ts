import { useEffect, useMemo, useRef } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import { createSharedBrowserSketchSolverClient } from '../browser/SharedBrowserSketchSolver';

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
  const freezeSolver = useMemo(createSharedBrowserSketchSolverClient, []);
  const session = useRef({ options, active: true, epoch: 0, request: 0 });
  const previous = session.current.options;
  if (previous.app !== app || previous.activeSketchId !== activeSketchId
      || previous.selectedEntityId !== selectedEntityId || previous.sketch?.id !== sketch?.id) {
    session.current.epoch++;
  }
  session.current.options = options;
  const epoch = session.current.epoch;
  useEffect(() => {
    session.current.active = true;
    return () => {
      session.current.active = false;
      session.current.request++;
      freezeSolver.dispose(); // Non-owning client; the shared coordinator remains alive.
    };
  }, [freezeSolver]);

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
    const ownsContext = () => session.current.active && session.current.epoch === epoch;
    if (!ownsContext()) return false;
    const request = ++session.current.request;
    const ownsRequest = () => ownsContext() && session.current.request === request;
    const notice = (message: string) => session.current.options.setNotice(message);
    let isCurrent = ownsRequest;

    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'line') {
      notice('Выберите отрезок эскиза');
      return false;
    }

    const document = app.getDocument();
    if (document.kind !== 'part') {
      notice('Фиксация доступна только в детали');
      return false;
    }
    const entity = document.sketches.find((item) => item.id === activeSketchId)
      ?.entities.find((item) => item.id === selectedEntityId);
    if (entity?.type !== 'line') {
      notice('Выберите отрезок эскиза');
      return false;
    }

    try {
      // Solve only the captured intent, never a live document held across initialization.
      const snapshot = structuredClone(document);
      const intent = JSON.stringify(snapshot);
      const selection = JSON.stringify(app.getState().selection);
      isCurrent = () => ownsRequest() && app.getCommandAvailability('constraint.fixed').enabled
        && app.getDocument() === document && JSON.stringify(app.getDocument()) === intent
        && JSON.stringify(app.getState().selection) === selection;
      if (!isCurrent()) return false;
      await freezeSolver.init();
      if (!isCurrent()) return false;

      const solved = freezeSolver.solve(snapshot, activeSketchId);
      if (!isCurrent()) return false;
      if (!solved.ok || !solved.converged) {
        notice(solved.diagnostics[0]?.message ?? 'Эскиз не удалось решить перед фиксацией');
        return false;
      }

      const solvedEntity = solved.entities.find((item) => item.id === selectedEntityId);
      if (!solvedEntity || solvedEntity.type !== 'line') {
        notice('Решённая геометрия выбранного отрезка недоступна');
        return false;
      }
      if (!isCurrent()) return false;
      const completion = app.execute({
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
      // Fixed applies synchronously before execute returns its promise. A rejected handler
      // may restore a clone; bind notices to that post-submit state, without replaying it.
      const submitted = app.getDocument();
      const submittedIntent = JSON.stringify(submitted);
      const submittedSelection = JSON.stringify(app.getState().selection);
      isCurrent = () => ownsRequest() && app.getCommandAvailability('constraint.fixed').enabled
        && app.getDocument() === submitted && JSON.stringify(app.getDocument()) === submittedIntent
        && JSON.stringify(app.getState().selection) === submittedSelection;
      const result = await completion;
      if (!isCurrent()) return false;
      if (!result.ok) {
        notice(result.error?.message ?? 'Не удалось зафиксировать отрезок');
        return false;
      }

      notice('Отрезок зафиксирован');
      return true;
    } catch (error) {
      if (isCurrent()) notice(error instanceof Error ? error.message : String(error));
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
