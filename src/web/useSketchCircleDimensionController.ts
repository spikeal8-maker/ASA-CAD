import { useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';

export interface SketchCircleDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchCircleDimensionController(options: SketchCircleDimensionControllerOptions) {
  const {
    app, activeCommand, activeSketchId, sketch, selectedEntityId,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<CadSketchEntityId | null>(null);
  const [draftValue, setDraftValue] = useState(0);
  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const canApplyDiameterDimension = Boolean(activeSketchId && selectedEntity?.type === 'circle');
  const diameterDimensionActive = targetSketchId !== null && targetEntityId !== null;
  const canCommitDiameterDimension = Boolean(
    diameterDimensionActive && Number.isFinite(draftValue) && draftValue > 0,
  );

  useEffect(() => {
    if (!diameterDimensionActive || activeCommand === 'dimension.diameter') return;
    reset();
  }, [activeCommand, diameterDimensionActive]);

  function beginDiameterDimension(): boolean {
    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'circle') {
      setNotice('Выберите окружность эскиза');
      return false;
    }
    setTargetSketchId(activeSketchId);
    setTargetEntityId(selectedEntityId);
    setDraftValue(selectedEntity.data.diameter);
    setActiveCommand('dimension.diameter');
    setPanel('parameters');
    setNotice('Диаметральный размер');
    return true;
  }

  async function commitDiameterDimension(): Promise<boolean> {
    if (!targetSketchId || !targetEntityId || !Number.isFinite(draftValue) || draftValue <= 0) {
      setNotice('Введите положительное значение размера');
      return false;
    }
    const result = await app.execute({
      id: 'dimension.diameter',
      payload: { sketchId: targetSketchId, entityId: targetEntityId, value: draftValue },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать размер');
      return false;
    }
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Диаметральный размер создан: ${draftValue} мм`);
    return true;
  }

  function reset(): void {
    setTargetSketchId(null);
    setTargetEntityId(null);
    setDraftValue(0);
  }

  function cancelDiameterDimension(): void {
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    diameterDimensionActive,
    diameterDimensionEntityId: targetEntityId,
    diameterDimensionValue: draftValue,
    setDiameterDimensionValue: setDraftValue,
    canApplyDiameterDimension,
    canCommitDiameterDimension,
    beginDiameterDimension,
    commitDiameterDimension,
    cancelDiameterDimension,
  };
}
