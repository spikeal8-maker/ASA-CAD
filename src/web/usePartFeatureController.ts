import { useState, type Dispatch, type SetStateAction } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPlaneName } from '../contracts/commands';
import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId, CadStableReferenceId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import type { CadWorkspacePanel, PartSketchSelectionMode } from './PartSketchWorkspaceTypes';
import { findSketch, hasCircle, hasRectangle, partDocument } from './PartSketchWorkspaceModel';
import { useExtrudeOperationController } from './useExtrudeOperationController';

export interface PartFeatureControllerOptions {
  app: CadApplication;
  document: Readonly<CadDocument>;
  renderModelAvailable: boolean;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedPick: CadViewportPick | null;
  setActiveCommand: Dispatch<SetStateAction<string | null>>;
  setActiveWorkspace: Dispatch<SetStateAction<string>>;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
  activateSketch(sketchId: CadSketchId): void;
  beginPartSelection(mode: PartSketchSelectionMode): void;
  clearTransientSelection(): void;
}

export function usePartFeatureController(options: PartFeatureControllerOptions) {
  const {
    app,
    document,
    renderModelAvailable,
    activeSketchId,
    sketch,
    selectedPick,
    setActiveCommand,
    setActiveWorkspace,
    setPanel,
    setNotice,
    activateSketch,
    beginPartSelection,
    clearTransientSelection,
  } = options;

  const [sketchPlane, setSketchPlane] = useState<CadPlaneName>('XY');
  const [filletRadius, setFilletRadius] = useState(1);

  const part = partDocument(document);
  const rectangleReady = hasRectangle(sketch);
  const circleReady = hasCircle(sketch);
  const hasSolid = Boolean(part?.bodies.length);
  const lastFeature = part?.features.at(-1);
  const canCut = Boolean(sketch && circleReady && hasSolid && lastFeature?.type === 'extrude');
  const canFillet = Boolean(hasSolid && lastFeature?.type === 'cut-extrude');
  const extrude = useExtrudeOperationController({
    app, document, activeSketchId, sketch, setActiveCommand, setActiveWorkspace,
    setPanel, setNotice, clearTransientSelection,
  });

  function beginCreateSketch() {
    if (document.kind !== 'part') return;
    setActiveCommand('part.sketch.create');
    setPanel('parameters');
    if (hasSolid && renderModelAvailable) {
      beginPartSelection('face');
      setActiveWorkspace('solid');
      setNotice('Выберите плоскую грань в рабочей области');
    } else {
      beginPartSelection('none');
      setActiveWorkspace('sketch');
      setNotice('Выберите плоскость и создайте эскиз');
    }
  }

  async function commitCreateSketch() {
    let support: CadPlaneName | CadStableReferenceId = sketchPlane;
    const currentPart = partDocument(app.getDocument());

    if (currentPart?.bodies.length) {
      if (selectedPick?.kind !== 'face' || !selectedPick.sourceFeatureId) {
        setNotice('Выберите грань модели для нового эскиза');
        return;
      }
      try {
        support = await app.captureReference({
          kind: 'face',
          sourceFeatureId: selectedPick.sourceFeatureId,
          point: [...selectedPick.point] as [number, number, number],
          semanticRole: 'sketch-support-face',
        });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    const result = await app.execute({ id: 'sketch.create', payload: { support } });
    const createdSketchId = result.createdIds?.[0] as CadSketchId | undefined;
    if (!result.ok || !createdSketchId) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    activateSketch(createdSketchId);
    const supportText = currentPart?.bodies.length ? 'выбранной грани' : `плоскости ${sketchPlane}`;
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
    setNotice(`Создан эскиз на ${supportText}`);
  }

  function beginCut() {
    if (!canCut) return;
    setActiveCommand('part.cutExtrude');
    setPanel('parameters');
    clearTransientSelection();
    setNotice('Вырез будет выполнен сквозь всё тело');
  }

  async function commitCut() {
    const currentSketch = findSketch(partDocument(app.getDocument()), sketch?.id ?? null);
    if (!currentSketch || !hasCircle(currentSketch)) {
      setNotice('Для выреза нужен эскиз с окружностью');
      return;
    }
    const feature = await app.execute({
      id: 'feature.cutExtrude',
      payload: { sketchId: currentSketch.id, end: 'through-all' },
    });
    if (!feature.ok) {
      setNotice(feature.error?.message ?? 'Не удалось создать вырез');
      return;
    }
    setNotice('Перестроение сквозного выреза…');
    const rebuildResult = await app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuildResult.ok) {
      setNotice(rebuildResult.error?.message ?? 'Ошибка перестроения выреза');
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice('Сквозной вырез построен локально');
  }

  function beginFillet() {
    if (!canFillet || !renderModelAvailable) return;
    setActiveCommand('part.fillet');
    setPanel('parameters');
    beginPartSelection('edge');
    setNotice('Выберите ребро в рабочей области');
  }

  async function commitFillet() {
    if (selectedPick?.kind !== 'edge' || !selectedPick.sourceFeatureId) {
      setNotice('Выберите ребро модели для скругления');
      return;
    }
    if (!(filletRadius > 0)) {
      setNotice('Радиус скругления должен быть больше нуля');
      return;
    }

    let referenceId: CadStableReferenceId;
    try {
      referenceId = await app.captureReference({
        kind: 'edge',
        sourceFeatureId: selectedPick.sourceFeatureId,
        point: [...selectedPick.point] as [number, number, number],
        semanticRole: 'fillet-edge',
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return;
    }

    const feature = await app.execute({
      id: 'feature.fillet',
      payload: { references: [referenceId], radius: filletRadius },
    });
    if (!feature.ok) {
      setNotice(feature.error?.message ?? 'Не удалось создать скругление');
      return;
    }
    setNotice('Перестроение скругления…');
    const rebuildResult = await app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuildResult.ok) {
      setNotice(rebuildResult.error?.message ?? 'Ошибка перестроения скругления');
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(`Скругление R${filletRadius} построено локально`);
  }

  return {
    part,
    sketchPlane,
    setSketchPlane,
    filletRadius,
    setFilletRadius,
    rectangleReady,
    circleReady,
    hasSolid,
    canCut,
    canFillet,
    extrude,
    beginCreateSketch,
    commitCreateSketch,
    beginCut,
    commitCut,
    beginFillet,
    commitFillet,
  };
}
