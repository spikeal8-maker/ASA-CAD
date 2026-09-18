import { useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';

export type SketchDirectionalDimensionMode = 'horizontal' | 'vertical';

export interface SketchDirectionalDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchDirectionalDimensionController(
  options: SketchDirectionalDimensionControllerOptions,
) {
  const {
    app, activeCommand, activeSketchId, sketch, selectedEntityId,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [mode, setMode] = useState<SketchDirectionalDimensionMode | null>(null);
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<CadSketchEntityId | null>(null);
  const [draftValue, setDraftValue] = useState(0);

  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const canApplyDirectionalDimension = Boolean(activeSketchId && selectedEntity?.type === 'line');
  const canCommitDirectionalDimension = Boolean(
    mode && targetSketchId && targetEntityId && Number.isFinite(draftValue) && draftValue > 0,
  );

  useEffect(() => {
    if (!mode || activeCommand === `dimension.${mode}`) return;
    setMode(null);
    setTargetSketchId(null);
    setTargetEntityId(null);
    setDraftValue(0);
  }, [activeCommand, mode]);

  function beginDirectionalDimension(nextMode: SketchDirectionalDimensionMode): boolean {
    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'line') {
      setNotice('Выберите отрезок эскиза');
      return false;
    }
    const axis = nextMode === 'horizontal' ? 0 : 1;
    const initialValue = Math.abs(selectedEntity.data.to[axis] - selectedEntity.data.from[axis]);
    setMode(nextMode);
    setTargetSketchId(activeSketchId);
    setTargetEntityId(selectedEntityId);
    setDraftValue(initialValue);
    setActiveCommand(`dimension.${nextMode}`);
    setPanel('parameters');
    setNotice(nextMode === 'horizontal' ? 'Горизонтальный размер' : 'Вертикальный размер');
    return true;
  }

  async function commitDirectionalDimension(): Promise<boolean> {
    if (!mode || !targetSketchId || !targetEntityId || !Number.isFinite(draftValue) || draftValue <= 0) {
      setNotice('Введите положительное значение размера');
      return false;
    }
    const result = mode === 'horizontal'
      ? await app.execute({
          id: 'dimension.horizontal',
          payload: { sketchId: targetSketchId, entityId: targetEntityId, value: draftValue },
        })
      : await app.execute({
          id: 'dimension.vertical',
          payload: { sketchId: targetSketchId, entityId: targetEntityId, value: draftValue },
        });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать размер');
      return false;
    }
    const label = mode === 'horizontal' ? 'Горизонтальный' : 'Вертикальный';
    setMode(null);
    setTargetSketchId(null);
    setTargetEntityId(null);
    setDraftValue(0);
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`${label} размер создан: ${draftValue} мм`);
    return true;
  }

  function cancelDirectionalDimension(): void {
    setMode(null);
    setTargetSketchId(null);
    setTargetEntityId(null);
    setDraftValue(0);
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    directionalDimensionMode: mode,
    directionalDimensionEntityId: targetEntityId,
    directionalDimensionValue: draftValue,
    setDirectionalDimensionValue: setDraftValue,
    canApplyDirectionalDimension,
    canCommitDirectionalDimension,
    beginHorizontalDimension: () => beginDirectionalDimension('horizontal'),
    beginVerticalDimension: () => beginDirectionalDimension('vertical'),
    commitDirectionalDimension,
    cancelDirectionalDimension,
  };
}
