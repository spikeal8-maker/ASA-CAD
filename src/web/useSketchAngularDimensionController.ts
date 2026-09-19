import { useEffect, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch, CadSketchEntity } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { dimensionLabel } from './SketchDimensionPresentation';

export interface SketchAngularDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchAngularDimensionController(options: SketchAngularDimensionControllerOptions) {
  const {
    app, activeCommand, activeSketchId, sketch,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [aEntityId, setAEntityId] = useState<CadSketchEntityId | null>(null);
  const [bEntityId, setBEntityId] = useState<CadSketchEntityId | null>(null);
  const [draftValue, setDraftValue] = useState(0);

  const lineCount = sketch?.entities.filter((entity) => entity.type === 'line').length ?? 0;
  const canApplyAngularDimension = Boolean(activeSketchId && lineCount >= 2);
  const angularDimensionActive = targetSketchId !== null;
  const canCommitAngularDimension = Boolean(
    targetSketchId
      && aEntityId
      && bEntityId
      && Number.isFinite(draftValue)
      && draftValue > 0
      && draftValue < 180,
  );

  useEffect(() => {
    if (!angularDimensionActive || activeCommand === 'dimension.angular') return;
    reset();
  }, [activeCommand, angularDimensionActive]);

  function beginAngularDimension(): boolean {
    if (!activeSketchId || lineCount < 2) {
      setNotice('Для углового размера нужны два отрезка эскиза');
      return false;
    }
    setTargetSketchId(activeSketchId);
    setAEntityId(null);
    setBEntityId(null);
    setDraftValue(0);
    setActiveCommand('dimension.angular');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  async function selectAngularDimensionLines(
    nextAEntityId: CadSketchEntityId,
    nextBEntityId: CadSketchEntityId,
  ): Promise<boolean> {
    if (!targetSketchId || !sketch || sketch.id !== targetSketchId) {
      setNotice('Сначала запустите угловой размер в активном эскизе');
      return false;
    }
    if (nextAEntityId === nextBEntityId) {
      setNotice('Выберите два разных отрезка');
      return false;
    }
    const a = lineEntity(sketch, nextAEntityId);
    const b = lineEntity(sketch, nextBEntityId);
    if (!a || !b) {
      setNotice('Угловой размер требует два отрезка');
      return false;
    }

    const initialValue = lineAngleDegrees(a, b);
    setAEntityId(nextAEntityId);
    setBEntityId(nextBEntityId);
    setDraftValue(initialValue);
    setPanel('parameters');
    setNotice(dimensionLabel(undefined, 'angular'));
    return true;
  }

  async function commitAngularDimension(): Promise<boolean> {
    if (
      !targetSketchId
      || !aEntityId
      || !bEntityId
      || !Number.isFinite(draftValue)
      || draftValue <= 0
      || draftValue >= 180
    ) {
      setNotice('Введите угол больше 0 и меньше 180 градусов');
      return false;
    }
    const result = await app.execute({
      id: 'dimension.angular',
      payload: {
        sketchId: targetSketchId,
        aEntityId,
        bEntityId,
        value: draftValue,
      },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать угловой размер');
      return false;
    }
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Угловой размер создан: ${draftValue}°`);
    return true;
  }

  function reset(): void {
    setTargetSketchId(null);
    setAEntityId(null);
    setBEntityId(null);
    setDraftValue(0);
  }

  function cancelAngularDimension(): void {
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    angularDimensionActive,
    angularDimensionAEntityId: aEntityId,
    angularDimensionBEntityId: bEntityId,
    angularDimensionValue: draftValue,
    setAngularDimensionValue: setDraftValue,
    canApplyAngularDimension,
    canCommitAngularDimension,
    beginAngularDimension,
    selectAngularDimensionLines,
    commitAngularDimension,
    cancelAngularDimension,
  };
}

type LineEntity = Extract<CadSketchEntity, { type: 'line' }>;

function lineEntity(sketch: Readonly<CadSketch>, entityId: CadSketchEntityId): LineEntity | null {
  const entity = sketch.entities.find((item) => item.id === entityId);
  return entity?.type === 'line' ? entity : null;
}

function lineAngleDegrees(a: LineEntity, b: LineEntity): number {
  const ax = a.data.to[0] - a.data.from[0];
  const ay = a.data.to[1] - a.data.from[1];
  const bx = b.data.to[0] - b.data.from[0];
  const by = b.data.to[1] - b.data.from[1];
  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}
