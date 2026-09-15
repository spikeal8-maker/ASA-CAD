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

/** Composes unary constraints with the focused two-endpoint Coincident lifecycle. */
export function useSketchConstraintControllers(options: SketchConstraintControllersOptions) {
  const { app, activeSketchId, sketch, setActiveCommand, setPanel, setNotice } = options;
  const unary = useSketchConstraintController(options);
  const canApplyCoincidentConstraint = (sketch?.entities.filter((entity) => entity.type === 'line').length ?? 0) >= 2;

  function beginCoincidentConstraint(): boolean {
    if (!activeSketchId || !canApplyCoincidentConstraint) {
      setNotice('Для совпадения нужны два отрезка эскиза');
      return false;
    }
    setActiveCommand('constraint.coincident');
    setPanel('closed');
    setNotice('Выберите конец первого отрезка');
    return true;
  }

  async function applyCoincidentConstraint(a: CadSketchCommandReference, b: CadSketchCommandReference): Promise<boolean> {
    if (!activeSketchId) { setNotice('Сначала откройте эскиз'); return false; }
    const result = await app.execute({ id: 'constraint.coincident', payload: { sketchId: activeSketchId, a, b } });
    if (!result.ok) { setNotice(result.error?.message ?? 'Не удалось применить совпадение'); return false; }
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Совпадение применено');
    return true;
  }

  return { ...unary, canApplyCoincidentConstraint, beginCoincidentConstraint, applyCoincidentConstraint };
}
