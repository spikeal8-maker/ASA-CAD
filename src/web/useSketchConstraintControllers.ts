import type { CadApplication } from '../contracts/application';
import type { CadSketchCommandReference } from '../contracts/commands';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { useSketchConstraintController } from './useSketchConstraintController';

export interface SketchConstraintControllersOptions {
  app: CadApplication;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

/** Composes unary constraints with focused transient binary Line constraints. */
export function useSketchConstraintControllers(options: SketchConstraintControllersOptions) {
  const { app, activeSketchId, sketch, setActiveCommand, setPanel, setNotice } = options;
  const unary = useSketchConstraintController(options);
  const canApplyCoincidentConstraint = (sketch?.entities.filter((entity) => entity.type === 'line').length ?? 0) >= 2;
  const canApplyParallelConstraint = canApplyCoincidentConstraint;
  const canApplyPerpendicularConstraint = canApplyCoincidentConstraint;

  function canBeginBinaryConstraint(): boolean {
    if (activeSketchId && canApplyCoincidentConstraint) return true;
    setNotice('Для ограничения нужны два отрезка эскиза');
    return false;
  }

  function beginCoincidentConstraint(): boolean {
    if (!canBeginBinaryConstraint()) return false;
    setActiveCommand('constraint.coincident');
    setPanel('closed');
    setNotice('Выберите конец первого отрезка');
    return true;
  }

  function beginParallelConstraint(): boolean {
    if (!canBeginBinaryConstraint()) return false;
    setActiveCommand('constraint.parallel');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  function beginPerpendicularConstraint(): boolean {
    if (!canBeginBinaryConstraint()) return false;
    setActiveCommand('constraint.perpendicular');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  async function finishBinaryConstraint(result: Awaited<ReturnType<CadApplication['execute']>>, success: string): Promise<boolean> {
    if (!result.ok) { setNotice(result.error?.message ?? 'Не удалось применить ограничение'); return false; }
    setActiveCommand(null);
    setPanel('tree');
    setNotice(success);
    return true;
  }

  async function applyCoincidentConstraint(a: CadSketchCommandReference, b: CadSketchCommandReference): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    return finishBinaryConstraint(
      await app.execute({ id: 'constraint.coincident', payload: { sketchId: activeSketchId, a, b } }),
      'Совпадение применено',
    );
  }

  async function applyParallelConstraint(aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    return finishBinaryConstraint(
      await app.execute({ id: 'constraint.parallel', payload: { sketchId: activeSketchId, aEntityId, bEntityId } }),
      'Параллельность применена',
    );
  }

  async function applyPerpendicularConstraint(aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    return finishBinaryConstraint(
      await app.execute({ id: 'constraint.perpendicular', payload: { sketchId: activeSketchId, aEntityId, bEntityId } }),
      'Перпендикулярность применена',
    );
  }

  return {
    ...unary,
    canApplyCoincidentConstraint,
    canApplyParallelConstraint,
    canApplyPerpendicularConstraint,
    beginCoincidentConstraint,
    beginParallelConstraint,
    beginPerpendicularConstraint,
    applyCoincidentConstraint,
    applyParallelConstraint,
    applyPerpendicularConstraint,
  };
}
