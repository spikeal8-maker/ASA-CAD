import { useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { dimensionLabel } from './SketchDimensionPresentation';

export type SketchLineDimensionMode = 'linear' | 'horizontal' | 'vertical';

export interface SketchLineDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchLineDimensionController(options: SketchLineDimensionControllerOptions) {
  const {
    app, activeCommand, activeSketchId, sketch, selectedEntityId,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [mode, setMode] = useState<SketchLineDimensionMode | null>(null);
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<CadSketchEntityId | null>(null);
  const [draftValue, setDraftValue] = useState(0);

  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const canApplyLineDimension = Boolean(activeSketchId && selectedEntity?.type === 'line');
  const canCommitLineDimension = Boolean(
    mode && targetSketchId && targetEntityId && Number.isFinite(draftValue) && draftValue > 0,
  );

  useEffect(() => {
    if (!mode || activeCommand === `dimension.${mode}`) return;
    reset();
  }, [activeCommand, mode]);

  function beginLineDimension(nextMode: SketchLineDimensionMode): boolean {
    if (!activeSketchId || !selectedEntityId || selectedEntity?.type !== 'line') {
      setNotice('Выберите отрезок эскиза');
      return false;
    }
    const dx = selectedEntity.data.to[0] - selectedEntity.data.from[0];
    const dy = selectedEntity.data.to[1] - selectedEntity.data.from[1];
    const initialValue = nextMode === 'linear'
      ? Math.hypot(dx, dy)
      : Math.abs(nextMode === 'horizontal' ? dx : dy);
    setMode(nextMode);
    setTargetSketchId(activeSketchId);
    setTargetEntityId(selectedEntityId);
    setDraftValue(initialValue);
    setActiveCommand(`dimension.${nextMode}`);
    setPanel('parameters');
    setNotice(dimensionLabel(undefined, nextMode));
    return true;
  }

  async function commitLineDimension(): Promise<boolean> {
    if (!mode || !targetSketchId || !targetEntityId || !Number.isFinite(draftValue) || draftValue <= 0) {
      setNotice('Введите положительное значение размера');
      return false;
    }
    const result = mode === 'linear'
      ? await app.execute({
          id: 'dimension.linear',
          payload: { sketchId: targetSketchId, entityIds: [targetEntityId], value: draftValue },
        })
      : mode === 'horizontal'
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
    const label = dimensionLabel(undefined, mode);
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`${label} создан: ${draftValue} мм`);
    return true;
  }

  function reset(): void {
    setMode(null);
    setTargetSketchId(null);
    setTargetEntityId(null);
    setDraftValue(0);
  }

  function cancelLineDimension(): void {
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    lineDimensionMode: mode,
    lineDimensionEntityId: targetEntityId,
    lineDimensionValue: draftValue,
    setLineDimensionValue: setDraftValue,
    canApplyLineDimension,
    canCommitLineDimension,
    beginLinearDimension: () => beginLineDimension('linear'),
    beginHorizontalDimension: () => beginLineDimension('horizontal'),
    beginVerticalDimension: () => beginLineDimension('vertical'),
    commitLineDimension,
    cancelLineDimension,
  };
}
