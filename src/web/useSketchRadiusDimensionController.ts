import { useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { dimensionLabel } from './SketchDimensionPresentation';

export type RadiusDimensionTargetKind = 'circle' | 'arc';

export interface SketchRadiusDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchRadiusDimensionController(options: SketchRadiusDimensionControllerOptions) {
  const {
    app, activeCommand, activeSketchId, sketch, selectedEntityId,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<CadSketchEntityId | null>(null);
  const [targetKind, setTargetKind] = useState<RadiusDimensionTargetKind | null>(null);
  const [draftValue, setDraftValue] = useState(0);

  const selectedEntity = sketch?.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const eligibleTarget = selectedEntity?.type === 'circle' || selectedEntity?.type === 'arc'
    ? selectedEntity
    : null;
  const canApplyRadiusDimension = Boolean(activeSketchId && eligibleTarget);
  const radiusDimensionActive = Boolean(targetSketchId && targetEntityId && targetKind);
  const canCommitRadiusDimension = Boolean(
    radiusDimensionActive && Number.isFinite(draftValue) && draftValue > 0,
  );

  useEffect(() => {
    if (!radiusDimensionActive || activeCommand === 'dimension.radius') return;
    reset();
  }, [activeCommand, radiusDimensionActive]);

  function beginRadiusDimension(): boolean {
    if (!activeSketchId || !selectedEntityId || !eligibleTarget) {
      setNotice('Выберите окружность или дугу эскиза');
      return false;
    }
    const nextKind = eligibleTarget.type;
    const initialValue = nextKind === 'circle'
      ? eligibleTarget.data.diameter / 2
      : eligibleTarget.data.radius;
    setTargetSketchId(activeSketchId);
    setTargetEntityId(selectedEntityId);
    setTargetKind(nextKind);
    setDraftValue(initialValue);
    setActiveCommand('dimension.radius');
    setPanel('parameters');
    setNotice(dimensionLabel(undefined, 'radius'));
    return true;
  }

  async function commitRadiusDimension(): Promise<boolean> {
    if (!targetSketchId || !targetEntityId || !targetKind || !Number.isFinite(draftValue) || draftValue <= 0) {
      setNotice('Введите положительное значение размера');
      return false;
    }
    const result = await app.execute({
      id: 'dimension.radius',
      payload: { sketchId: targetSketchId, entityId: targetEntityId, value: draftValue },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать размер');
      return false;
    }
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Радиальный размер создан: ${draftValue} мм`);
    return true;
  }

  function reset(): void {
    setTargetSketchId(null);
    setTargetEntityId(null);
    setTargetKind(null);
    setDraftValue(0);
  }

  function cancelRadiusDimension(): void {
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    radiusDimensionActive,
    radiusDimensionEntityId: targetEntityId,
    radiusDimensionTargetKind: targetKind,
    radiusDimensionValue: draftValue,
    setRadiusDimensionValue: setDraftValue,
    canApplyRadiusDimension,
    canCommitRadiusDimension,
    beginRadiusDimension,
    commitRadiusDimension,
    cancelRadiusDimension,
  };
}
