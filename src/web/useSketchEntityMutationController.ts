import type { CadSketchDelta } from '../application/SketchEntityTransform';
import type { CadApplication } from '../contracts/application';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

export interface SketchEntityMutationControllerOptions {
  app: CadApplication;
  activeSketchId: CadSketchId | null;
  selectedEntityId: CadSketchEntityId | null;
  setNotice(message: string): void;
  clearEntitySelection(): void;
}

/** Durable stable-ID Sketch entity edits. Transient pointer/solver state lives elsewhere. */
export function useSketchEntityMutationController(options: SketchEntityMutationControllerOptions) {
  const { app, activeSketchId, selectedEntityId, setNotice, clearEntitySelection } = options;

  async function deleteSelectedSketchEntity() {
    if (!activeSketchId || !selectedEntityId) {
      setNotice('Выберите элемент эскиза');
      return false;
    }
    const result = await app.execute({
      id: 'sketch.entity.delete',
      payload: { sketchId: activeSketchId, entityId: selectedEntityId },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось удалить элемент эскиза');
      return false;
    }
    clearEntitySelection();
    setNotice('Элемент эскиза и его зависимости удалены');
    return true;
  }

  async function translateSketchEntity(entityId: CadSketchEntityId, delta: CadSketchDelta) {
    if (!activeSketchId) return false;
    const result = await app.execute({
      id: 'sketch.entity.translate',
      payload: { sketchId: activeSketchId, entityId, delta },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось переместить элемент эскиза');
      return false;
    }
    if (result.changed) setNotice('Элемент эскиза перемещён');
    return result.changed;
  }

  return { deleteSelectedSketchEntity, translateSketchEntity };
}
