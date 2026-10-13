import { useState, type Dispatch, type SetStateAction } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPlaneName } from '../contracts/commands';
import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId, CadStableReferenceId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import type { CadWorkspacePanel, PartSketchSelectionMode } from './PartSketchWorkspaceTypes';
import { findSketch, hasCircle, hasRectangle, partDocument } from './PartSketchWorkspaceModel';
import { cutAvailability } from './PartFeatureAvailability';
import { useExtrudeOperationController } from './useExtrudeOperationController';

export interface PartFeatureControllerOptions {
  app: CadApplication;
  document: Readonly<CadDocument>;
  renderModelAvailable: boolean;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedPick: CadViewportPick | null;
  /** Selected origin plane = Sketch support. */
  selectedPlane: CadPlaneName | null;
  selectBasePlane(plane: CadPlaneName): void;
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
    app, document, renderModelAvailable, activeSketchId, sketch, selectedPick, selectedPlane, selectBasePlane,
    setActiveCommand, setActiveWorkspace, setPanel, setNotice, activateSketch, beginPartSelection, clearTransientSelection,
  } = options;

  const sketchPlane = selectedPlane ?? 'XY';
  const [filletRadius, setFilletRadius] = useState(1);

  const part = partDocument(document);
  const rectangleReady = hasRectangle(sketch);
  const circleReady = hasCircle(sketch);
  const hasSolid = Boolean(part?.bodies.length);
  const lastFeature = part?.features.at(-1);
  const canCut = cutAvailability(part, sketch).enabled;
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
      setNotice('Выберите грань или плоскость');
    } else {
      beginPartSelection('none');
      setActiveWorkspace('sketch');
      if (!selectedPlane) selectBasePlane('XY');
      setNotice('Выберите плоскость и создайте эскиз');
    }
  }

  async function commitCreateSketch() {
    let support: CadPlaneName | CadStableReferenceId = sketchPlane;
    const currentPart = partDocument(app.getDocument());
    const onFace = Boolean(currentPart?.bodies.length) && !selectedPlane;

    if (onFace) {
      if (selectedPick?.kind !== 'face' || !selectedPick.sourceFeatureId) {
        setNotice('Выберите грань модели для нового эскиза');
        return;
      }
      const captured = await capturePick('face', 'sketch-support-face');
      if (!captured) return;
      support = captured;
    }

    const result = await app.execute({ id: 'sketch.create', payload: { support } });
    const createdSketchId = result.createdIds?.[0] as CadSketchId | undefined;
    if (!result.ok || !createdSketchId) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    activateSketch(createdSketchId);
    const supportText = onFace ? 'выбранной грани' : `плоскости ${sketchPlane}`;
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
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, sketch?.id ?? null);
    const check = cutAvailability(currentPart, currentSketch);
    if (!currentSketch || !check.enabled) {
      setNotice(check.reason ?? 'Вырез недоступен');
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
    await rebuildFeature('Перестроение сквозного выреза…', 'Ошибка перестроения выреза', 'Сквозной вырез построен локально');
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

    const referenceId = await capturePick('edge', 'fillet-edge');
    if (!referenceId) return;

    const feature = await app.execute({
      id: 'feature.fillet',
      payload: { references: [referenceId], radius: filletRadius },
    });
    if (!feature.ok) {
      setNotice(feature.error?.message ?? 'Не удалось создать скругление');
      return;
    }
    await rebuildFeature('Перестроение скругления…', 'Ошибка перестроения скругления', `Скругление R${filletRadius} построено локально`);
  }

  async function capturePick(kind: 'face' | 'edge', semanticRole: string): Promise<CadStableReferenceId | null> {
    if (!selectedPick?.sourceFeatureId) return null;
    try {
      const point = [...selectedPick.point] as [number, number, number];
      return await app.captureReference({ kind, sourceFeatureId: selectedPick.sourceFeatureId, point, semanticRole });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async function rebuildFeature(progress: string, failure: string, done: string) {
    setNotice(progress);
    const rebuildResult = await app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuildResult.ok) {
      setNotice(rebuildResult.error?.message ?? failure);
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(done);
  }

  return {
    part, sketchPlane, setSketchPlane: selectBasePlane, filletRadius, setFilletRadius,
    rectangleReady, circleReady, hasSolid, canCut, canFillet, extrude,
    beginCreateSketch, commitCreateSketch, beginCut, commitCut, beginFillet, commitFillet,
  };
}
