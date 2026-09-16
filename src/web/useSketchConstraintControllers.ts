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

/** Composes unary constraints with focused transient binary Sketch constraints. */
export function useSketchConstraintControllers(options: SketchConstraintControllersOptions) {
  const { app, activeSketchId, sketch, setActiveCommand, setPanel, setNotice } = options;
  const unary = useSketchConstraintController(options);
  const lineCount = sketch?.entities.filter((entity) => entity.type === 'line').length ?? 0;
  const circleCount = sketch?.entities.filter((entity) => entity.type === 'circle').length ?? 0;
  const canApplyCoincidentConstraint = lineCount >= 2;
  const canApplyParallelConstraint = canApplyCoincidentConstraint;
  const canApplyPerpendicularConstraint = canApplyCoincidentConstraint;
  const canApplyTangentConstraint = lineCount >= 1 && circleCount >= 1;
  const canApplyConcentricConstraint = circleCount >= 2;

  function canBeginLinePairConstraint(): boolean {
    if (activeSketchId && canApplyCoincidentConstraint) return true;
    setNotice('Для ограничения нужны два отрезка эскиза');
    return false;
  }

  function beginCoincidentConstraint(): boolean {
    if (!canBeginLinePairConstraint()) return false;
    setActiveCommand('constraint.coincident');
    setPanel('closed');
    setNotice('Выберите конец первого отрезка');
    return true;
  }

  function beginParallelConstraint(): boolean {
    if (!canBeginLinePairConstraint()) return false;
    setActiveCommand('constraint.parallel');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  function beginPerpendicularConstraint(): boolean {
    if (!canBeginLinePairConstraint()) return false;
    setActiveCommand('constraint.perpendicular');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  function beginTangentConstraint(): boolean {
    if (!activeSketchId || !canApplyTangentConstraint) {
      setNotice('Для касательности нужны отрезок и окружность эскиза');
      return false;
    }
    setActiveCommand('constraint.tangent');
    setPanel('closed');
    setNotice('Выберите отрезок или окружность');
    return true;
  }

  function beginConcentricConstraint(): boolean {
    if (!activeSketchId || !canApplyConcentricConstraint) {
      setNotice('Для концентричности нужны две окружности эскиза');
      return false;
    }
    setActiveCommand('constraint.concentric');
    setPanel('closed');
    setNotice('Выберите первую окружность');
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

  async function applyTangentConstraint(aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    return finishBinaryConstraint(
      await app.execute({ id: 'constraint.tangent', payload: { sketchId: activeSketchId, aEntityId, bEntityId } }),
      'Касательность применена',
    );
  }

  async function applyConcentricConstraint(aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    return finishBinaryConstraint(await app.execute({ id: 'constraint.concentric', payload: { sketchId: activeSketchId, aEntityId, bEntityId } }), 'Концентричность применена');
  }

  return {
    ...unary,
    canApplyCoincidentConstraint,
    canApplyParallelConstraint,
    canApplyPerpendicularConstraint,
    canApplyTangentConstraint,
    canApplyConcentricConstraint,
    beginCoincidentConstraint,
    beginParallelConstraint,
    beginPerpendicularConstraint,
    beginTangentConstraint,
    beginConcentricConstraint,
    applyCoincidentConstraint,
    applyParallelConstraint,
    applyPerpendicularConstraint,
    applyTangentConstraint,
    applyConcentricConstraint,
  };
}
