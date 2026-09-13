import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadDimensionId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { dimensionLabel, partDocument } from './PartSketchWorkspaceModel';

export interface SketchDimensionControllerOptions {
  app: CadApplication;
  setActiveCommand: Dispatch<SetStateAction<string | null>>;
  setActiveWorkspace: Dispatch<SetStateAction<string>>;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
  activateSketch(sketchId: CadSketchId): void;
  clearTransientSelection(): void;
  setRectangleWidth(value: number): void;
  setRectangleHeight(value: number): void;
  setCircleDiameter(value: number): void;
}

export function useSketchDimensionController(options: SketchDimensionControllerOptions) {
  const {
    app,
    setActiveCommand,
    setActiveWorkspace,
    setPanel,
    setNotice,
    activateSketch,
    clearTransientSelection,
    setRectangleWidth,
    setRectangleHeight,
    setCircleDiameter,
  } = options;
  const [editingDimensionId, setEditingDimensionId] = useState<CadDimensionId | null>(null);
  const [dimensionEditValue, setDimensionEditValue] = useState(0);

  function beginDimensionEdit(id: CadDimensionId) {
    const currentPart = partDocument(app.getDocument());
    const dimension = currentPart?.dimensions.find((item) => item.id === id);
    if (!dimension || !dimension.driving) return;
    const ownerSketch = currentPart?.sketches.find((item) => item.dimensionIds.includes(id));
    if (ownerSketch) activateSketch(ownerSketch.id);
    setEditingDimensionId(id);
    setDimensionEditValue(dimension.value);
    setActiveCommand('dimension.edit');
    setPanel('parameters');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(`Изменение размера «${dimensionLabel(dimension.name, dimension.type)}»`);
  }

  async function commitDimensionEdit() {
    if (!editingDimensionId || !(dimensionEditValue > 0)) {
      setNotice('Введите положительное значение размера');
      return;
    }
    const before = partDocument(app.getDocument())?.dimensions.find((item) => item.id === editingDimensionId);
    const result = await app.execute({
      id: 'part.dimension.setValue',
      payload: { dimensionId: editingDimensionId, value: dimensionEditValue },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось изменить размер');
      return;
    }

    setNotice('Перестроение истории после изменения размера…');
    const rebuildResult = await app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuildResult.ok) {
      setNotice(rebuildResult.error?.message ?? 'Ошибка перестроения после изменения размера');
      return;
    }

    if (before?.name === 'width') setRectangleWidth(dimensionEditValue);
    if (before?.name === 'height') setRectangleHeight(dimensionEditValue);
    if (before?.name === 'diameter') setCircleDiameter(dimensionEditValue);
    const label = dimensionLabel(before?.name, before?.type ?? 'Размер');
    setEditingDimensionId(null);
    setActiveCommand(null);
    setPanel('tree');
    clearTransientSelection();
    setNotice(`${label} изменен на ${dimensionEditValue} мм; модель перестроена`);
  }

  const clearDimensionEdit = useCallback(() => {
    setEditingDimensionId(null);
  }, []);

  return {
    dimensionEditValue,
    setDimensionEditValue,
    beginDimensionEdit,
    commitDimensionEdit,
    clearDimensionEdit,
  };
}
