import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

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
  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const canApplyOrientationConstraint = selectedEntity?.type === 'line';

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

  return {
    canApplyOrientationConstraint,
    applyHorizontalConstraint: () => applyOrientationConstraint('horizontal'),
    applyVerticalConstraint: () => applyOrientationConstraint('vertical'),
  };
}
