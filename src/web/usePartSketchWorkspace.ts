import { useCallback, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadPlaneName } from '../contracts/commands';
import type { CadDocument, CadDocumentKind, CadPartDocument, CadSketch } from '../contracts/document';
import type {
  CadBodyId,
  CadDimensionId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import { useSketchSession } from './useSketchSession';
import { useSketchLineTool } from './useSketchLineTool';
import { useSketchCircleTool } from './useSketchCircleTool';
import { useSketchArcTool } from './useSketchArcTool';

export type CadWorkspacePanel = 'tree' | 'parameters' | 'tools' | 'closed';
export type PartSketchSelectionMode = 'none' | 'face' | 'edge';

export interface PartSketchWorkspaceOptions {
  app: CadApplication;
  document: Readonly<CadDocument>;
  renderModelAvailable: boolean;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

/**
 * Focused UI/controller seam for the Part + Sketch workspace.
 *
 * This is intentionally not a CAD runtime or persistence layer. It owns the
 * editor state/lifecycle that M3 Sketch will grow: active commands, sketch
 * parameters, subshape/body selection and begin/commit/cancel transitions.
 * Geometry still executes only through CadApplication.
 */
export function usePartSketchWorkspace(options: PartSketchWorkspaceOptions) {
  const { app, document, renderModelAvailable, setPanel, setNotice } = options;

  const [activeWorkspace, setActiveWorkspace] = useState('solid');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<PartSketchSelectionMode>('none');
  const [selectedPick, setSelectedPick] = useState<CadViewportPick | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<CadBodyId | null>(null);
  const [sketchPlane, setSketchPlane] = useState<CadPlaneName>('XY');
  const [rectangleWidth, setRectangleWidth] = useState(60);
  const [rectangleHeight, setRectangleHeight] = useState(40);
  const [circleDiameter, setCircleDiameter] = useState(12);
  const [extrudeDistance, setExtrudeDistance] = useState(10);
  const [filletRadius, setFilletRadius] = useState(1);
  const [editingDimensionId, setEditingDimensionId] = useState<CadDimensionId | null>(null);
  const [dimensionEditValue, setDimensionEditValue] = useState(0);

  const part = partDocument(document);
  const {
    activeSketchId,
    activeSketch: sketch,
    enterSketch: activateSketch,
    clearActiveSketch,
  } = useSketchSession(part);
  const rectangleReady = hasRectangle(sketch);
  const circleReady = hasCircle(sketch);
  const hasSolid = Boolean(part?.bodies.length);
  const lastFeature = part?.features.at(-1);
  const canExtrude = Boolean(sketch && rectangleReady && !hasSolid && part?.features.length === 0);
  const canCut = Boolean(sketch && circleReady && hasSolid && lastFeature?.type === 'extrude');
  const canFillet = Boolean(hasSolid && lastFeature?.type === 'cut-extrude');
  const selectedPointText = selectedPick
    ? selectedPick.point.map((value) => Number(value).toFixed(2)).join(', ')
    : '';
  const selectedBody = selectedBodyId && part
    ? part.bodies.find((body) => body.id === selectedBodyId) ?? null
    : null;

  const clearTransientSelection = useCallback(() => {
    setSelectionMode('none');
    setSelectedPick(null);
    setSelectedBodyId(null);
  }, []);

  const clearSelectedPick = useCallback(() => {
    setSelectedPick(null);
  }, []);

  const lineTool = useSketchLineTool({
    app,
    sketchId: activeSketchId,
    active: activeCommand === 'sketch.line',
    setNotice,
    onCommitted: () => {
      setActiveCommand(null);
      setPanel('tree');
      setActiveWorkspace('sketch');
      clearTransientSelection();
    },
  });
  const circleTool = useSketchCircleTool({
    app,
    sketchId: activeSketchId,
    active: activeCommand === 'sketch.circle',
    setNotice,
    onCommitted: (diameter) => {
      setCircleDiameter(diameter);
      setActiveCommand(null);
      setPanel('tree');
      setActiveWorkspace('sketch');
      clearTransientSelection();
    },
  });
  const arcTool = useSketchArcTool({
    app,
    sketchId: activeSketchId,
    active: activeCommand === 'sketch.arc',
    setNotice,
    onCommitted: () => {
      setActiveCommand(null);
      setPanel('tree');
      setActiveWorkspace('sketch');
      clearTransientSelection();
    },
  });

  const resetTransient = useCallback(() => {
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
  }, [clearTransientSelection]);

  const resetToWorkspace = useCallback((workspace: string) => {
    setActiveWorkspace(workspace);
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
  }, [clearTransientSelection]);

  const resetForDocument = useCallback((kind: CadDocumentKind) => {
    clearActiveSketch();
    resetToWorkspace(kind === 'part' ? 'solid' : kind);
  }, [clearActiveSketch, resetToWorkspace]);

  const handleViewportPick = useCallback((pick: CadViewportPick) => {
    setSelectedPick(pick);
    if (pick.kind === 'face') {
      setNotice(`Грань выбрана: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    } else {
      setNotice(`Ребро выбрано: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    }
  }, [setNotice]);

  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    setSelectedBodyId(bodyId);
    setSelectedPick(null);
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, [setNotice]);

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    const currentPart = partDocument(app.getDocument());
    const target = findSketch(currentPart, sketchId);
    if (!target) {
      setNotice('Эскиз больше не существует');
      clearActiveSketch();
      return;
    }
    activateSketch(sketchId);
    setActiveCommand(null);
    setEditingDimensionId(null);
    setPanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
    setNotice(`Открыт эскиз «${target.name}»`);
  }, [activateSketch, app, clearActiveSketch, clearTransientSelection, setNotice, setPanel]);

  function beginCreateSketch() {
    if (document.kind !== 'part') return;
    setActiveCommand('part.sketch.create');
    setPanel('parameters');
    setSelectedPick(null);
    setSelectedBodyId(null);
    if (hasSolid && renderModelAvailable) {
      setSelectionMode('face');
      setActiveWorkspace('solid');
      setNotice('Выберите плоскую грань в рабочей области');
    } else {
      setSelectionMode('none');
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

  function beginLine() {
    if (!sketch) return;
    lineTool.reset();
    setActiveCommand('sketch.line');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите начальную точку отрезка');
  }

  function beginRectangle() {
    if (!sketch) return;
    setActiveCommand('sketch.rectangle');
    setPanel('parameters');
    clearTransientSelection();
    setNotice('Задайте ширину и высоту прямоугольника');
  }

  async function commitRectangle() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, activeSketchId);
    if (!currentSketch) {
      setNotice('Сначала создайте эскиз');
      return;
    }
    if (!(rectangleWidth > 0) || !(rectangleHeight > 0)) {
      setNotice('Размеры прямоугольника должны быть больше нуля');
      return;
    }

    const rectangle = await app.execute({
      id: 'sketch.rectangle',
      payload: {
        sketchId: currentSketch.id,
        origin: [-rectangleWidth / 2, -rectangleHeight / 2],
        width: rectangleWidth,
        height: rectangleHeight,
      },
    });
    if (!rectangle.ok || !rectangle.createdIds || rectangle.createdIds.length < 2) {
      setNotice(rectangle.error?.message ?? 'Не удалось создать прямоугольник');
      return;
    }

    const edges = rectangle.createdIds as CadSketchEntityId[];
    const widthDimension = await app.execute({
      id: 'dimension.linear',
      payload: {
        sketchId: currentSketch.id,
        entityIds: [edges[0]],
        value: rectangleWidth,
        name: 'width',
      },
    });
    const heightDimension = await app.execute({
      id: 'dimension.linear',
      payload: {
        sketchId: currentSketch.id,
        entityIds: [edges[1]],
        value: rectangleHeight,
        name: 'height',
      },
    });
    if (!widthDimension.ok || !heightDimension.ok) {
      setNotice(widthDimension.error?.message ?? heightDimension.error?.message ?? 'Не удалось создать размеры');
      return;
    }

    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Прямоугольник ${rectangleWidth}×${rectangleHeight} мм создан`);
  }

  function beginCircle() {
    if (!sketch) return;
    circleTool.reset();
    setActiveCommand('sketch.circle');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите центр окружности');
  }

  function beginArc() {
    if (!sketch) return;
    arcTool.reset();
    setActiveCommand('sketch.arc');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите центр дуги');
  }

  async function commitCircle() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, activeSketchId);
    if (!currentSketch) {
      setNotice('Сначала создайте эскиз');
      return;
    }
    if (!(circleDiameter > 0)) {
      setNotice('Диаметр должен быть больше нуля');
      return;
    }

    const circle = await app.execute({
      id: 'sketch.circle',
      payload: { sketchId: currentSketch.id, center: [0, 0], diameter: circleDiameter },
    });
    if (!circle.ok || !circle.createdIds?.[0]) {
      setNotice(circle.error?.message ?? 'Не удалось создать окружность');
      return;
    }
    const circleEntityId = circle.createdIds[0] as CadSketchEntityId;
    const diameter = await app.execute({
      id: 'dimension.diameter',
      payload: {
        sketchId: currentSketch.id,
        entityId: circleEntityId,
        value: circleDiameter,
        name: 'diameter',
      },
    });
    if (!diameter.ok) {
      setNotice(diameter.error?.message ?? 'Не удалось создать диаметральный размер');
      return;
    }

    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Окружность Ø${circleDiameter} мм создана`);
  }

  async function finishSketch() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, activeSketchId);
    if (!currentSketch) return;
    const result = await app.execute({ id: 'sketch.finish', payload: { sketchId: currentSketch.id } });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось завершить эскиз');
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice('Эскиз завершен');
  }

  function beginExtrude() {
    if (!canExtrude || !sketch) return;
    setActiveCommand('part.extrude');
    setPanel('parameters');
    clearTransientSelection();
    setNotice('Задайте расстояние выдавливания');
  }

  async function commitExtrude() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, activeSketchId);
    if (!currentSketch || !hasRectangle(currentSketch)) {
      setNotice('Для выдавливания нужен прямоугольный эскиз');
      return;
    }
    if (!(extrudeDistance > 0)) {
      setNotice('Расстояние выдавливания должно быть больше нуля');
      return;
    }

    const feature = await app.execute({
      id: 'feature.extrude',
      payload: { sketchId: currentSketch.id, distance: extrudeDistance },
    });
    if (!feature.ok) {
      setNotice(feature.error?.message ?? 'Не удалось создать выдавливание');
      return;
    }

    setNotice('Загрузка OpenCascade и перестроение детали…');
    const rebuildResult = await app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuildResult.ok) {
      setNotice(rebuildResult.error?.message ?? 'Ошибка перестроения');
      return;
    }

    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(`Выдавливание ${extrudeDistance} мм построено локально`);
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
    const currentSketch = findSketch(currentPart, activeSketchId);
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
    setSelectionMode('edge');
    setSelectedPick(null);
    setSelectedBodyId(null);
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

    let referenceId;
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

  function cancelCommand() {
    if (activeCommand === 'sketch.line') lineTool.reset();
    if (activeCommand === 'sketch.circle') circleTool.reset();
    if (activeCommand === 'sketch.arc') arcTool.reset();
    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle' || activeCommand === 'sketch.arc';
    setActiveCommand(null);
    setEditingDimensionId(null);
    setPanel('tree');
    clearTransientSelection();
    setActiveWorkspace(
      document.kind === 'part'
        ? stayInSketch ? 'sketch' : 'solid'
        : document.kind,
    );
    setNotice('Команда отменена');
  }

  async function commitActiveCommand() {
    if (activeCommand === 'sketch.line') return lineTool.commitPreview();
    if (activeCommand === 'part.sketch.create') return commitCreateSketch();
    if (activeCommand === 'sketch.rectangle') return commitRectangle();
    if (activeCommand === 'sketch.circle') {
      if (circleTool.draft.center) return circleTool.commitPreview();
      return commitCircle();
    }
    if (activeCommand === 'sketch.arc') return arcTool.commitPreview();
    if (activeCommand === 'part.extrude') return commitExtrude();
    if (activeCommand === 'part.cutExtrude') return commitCut();
    if (activeCommand === 'part.fillet') return commitFillet();
    if (activeCommand === 'dimension.edit') return commitDimensionEdit();
  }

  return {
    activeWorkspace,
    setActiveWorkspace,
    activeCommand,
    activeSketchId,
    selectionMode,
    selectedPick,
    selectedBodyId,
    sketchPlane,
    setSketchPlane,
    rectangleWidth,
    setRectangleWidth,
    rectangleHeight,
    setRectangleHeight,
    circleDiameter,
    setCircleDiameter,
    extrudeDistance,
    setExtrudeDistance,
    filletRadius,
    setFilletRadius,
    dimensionEditValue,
    setDimensionEditValue,
    part,
    sketch,
    rectangleReady,
    circleReady,
    hasSolid,
    canExtrude,
    canCut,
    canFillet,
    selectedPointText,
    selectedBody,
    clearTransientSelection,
    clearSelectedPick,
    resetTransient,
    resetToWorkspace,
    resetForDocument,
    handleViewportPick,
    handleBodySelect,
    enterSketch,
    beginLine,
    lineDraft: lineTool.draft,
    lineCommitting: lineTool.committing,
    handleSketchLinePointMove: lineTool.move,
    handleSketchLinePoint: lineTool.point,
    circleDraft: circleTool.draft,
    circleCommitting: circleTool.committing,
    handleSketchCirclePointMove: circleTool.move,
    handleSketchCirclePoint: circleTool.point,
    arcDraft: arcTool.draft,
    arcCommitting: arcTool.committing,
    handleSketchArcPointMove: arcTool.move,
    handleSketchArcPoint: arcTool.point,
    beginCreateSketch,
    commitCreateSketch,
    beginRectangle,
    commitRectangle,
    beginCircle,
    commitCircle,
    beginArc,
    finishSketch,
    beginExtrude,
    commitExtrude,
    beginCut,
    commitCut,
    beginFillet,
    commitFillet,
    beginDimensionEdit,
    commitDimensionEdit,
    cancelCommand,
    commitActiveCommand,
  };
}

function partDocument(document: Readonly<CadDocument>): Readonly<CadPartDocument> | null {
  return document.kind === 'part' ? document : null;
}

function findSketch(
  part: Readonly<CadPartDocument> | null,
  sketchId: CadSketchId | null,
): Readonly<CadSketch> | null {
  if (!part || !sketchId) return null;
  return part.sketches.find((item) => item.id === sketchId) ?? null;
}

function hasRectangle(sketch: Readonly<CadSketch> | null): boolean {
  return Boolean(
    sketch?.entities.filter(
      (entity) => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'),
    ).length === 4,
  );
}

function hasCircle(sketch: Readonly<CadSketch> | null): boolean {
  return Boolean(sketch?.entities.some((entity) => entity.type === 'circle'));
}

function dimensionLabel(name: string | undefined, type: string): string {
  if (name === 'width') return 'Ширина';
  if (name === 'height') return 'Высота';
  if (name === 'diameter' || type === 'diameter') return 'Диаметр';
  return name || type;
}
