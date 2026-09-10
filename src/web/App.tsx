import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import { parseCadClientRoute } from '../browser/routes';
import {
  createEmptyCadDocument,
  type CadDocument,
  type CadDocumentKind,
  type CadPartDocument,
} from '../contracts/document';
import type { CadBodyId, CadDimensionId, CadSketchEntityId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import {
  CadViewport,
  type CadViewportViewCommand,
  type CadViewportViewName,
} from './CadViewport';
import { applyPartDevFixture } from './devFixtures';
import { CadEditorPersistence } from './CadEditorPersistence';
import { useUiScaleSettings } from './UiScaleSettings';
import { DocumentTree, ParameterPanel } from './panels/EditorPanels';
import {
  commandById,
  commandLabel,
  dimensionLabel,
  documentDescriptions,
  documentNames,
  hasCircle,
  hasRectangle,
  kindIcon,
  latestSketch,
  partDocument,
  searchCommands,
  viewportViewByLabel,
} from './presentation/CadEditorPresentation';
import {
  ShortcutRegistry,
  shortcutInputKind,
  type ShortcutActionId,
} from './ShortcutRegistry';

export function App() {
  const { openSettings } = useUiScaleSettings();
  const route = useMemo(() => parseCadClientRoute(window.location.pathname), []);
  const devFixture = route.kind === 'dev-part' ? route.fixture : null;
  const fixtureStartedRef = useRef(false);
  const runtime = useMemo(() => new BrowserPartRuntimeAdapter(), []);
  const app = useMemo(
    () => new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Деталь 1' }), runtime),
    [runtime],
  );
  const persistence = useMemo(
    () => new CadEditorPersistence(route, createEmptyCadDocument('part', { title: 'Деталь 1' })),
    [route],
  );
  const shortcutRegistry = useMemo(() => new ShortcutRegistry(), []);
  const [, setRevisionToken] = useState(0);
  const [activePanel, setActivePanel] = useState<'tree' | 'parameters'>('tree');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('solid');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'none' | 'face' | 'edge'>('none');
  const [selectedPick, setSelectedPick] = useState<CadViewportPick | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<CadBodyId | null>(null);
  const [sketchPlane, setSketchPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
  const [rectangleWidth, setRectangleWidth] = useState(60);
  const [rectangleHeight, setRectangleHeight] = useState(40);
  const [circleDiameter, setCircleDiameter] = useState(12);
  const [extrudeDistance, setExtrudeDistance] = useState(10);
  const [filletRadius, setFilletRadius] = useState(1);
  const [editingDimensionId, setEditingDimensionId] = useState<CadDimensionId | null>(null);
  const [dimensionEditValue, setDimensionEditValue] = useState(0);
  const [notice, setNotice] = useState(devFixture ? `Fixture ${devFixture}: загрузка…` : 'Готово');
  const [fixtureStatus, setFixtureStatus] = useState<'none' | 'loading' | 'ready' | 'error'>(devFixture ? 'loading' : 'none');
  const [viewName, setViewName] = useState('Изометрия');
  const [viewCommand, setViewCommand] = useState<CadViewportViewCommand>({ sequence: 0, view: 'isometric' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = app.subscribe(() => setRevisionToken((value) => value + 1));
    return () => {
      unsubscribe();
      app.dispose();
    };
  }, [app]);

  const document = app.getDocument();
  const state = app.getState();
  const part = partDocument(document);
  const sketch = latestSketch(part);
  const rectangleReady = hasRectangle(sketch);
  const circleReady = hasCircle(sketch);
  const hasSolid = Boolean(part?.bodies.length);
  const lastFeature = part?.features.at(-1);
  const canExtrude = Boolean(sketch && rectangleReady && !hasSolid && part?.features.length === 0);
  const canCut = Boolean(sketch && circleReady && hasSolid && lastFeature?.type === 'extrude');
  const canFillet = Boolean(hasSolid && lastFeature?.type === 'cut-extrude');
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();
  const selectedPointText = selectedPick
    ? selectedPick.point.map((value) => Number(value).toFixed(2)).join(', ')
    : '';
  const selectedBody = selectedBodyId && part
    ? part.bodies.find((body) => body.id === selectedBodyId) ?? null
    : null;

  const searchableCommands = searchCommands(search, document.kind);

  const clearTransientSelection = useCallback(() => {
    setSelectionMode('none');
    setSelectedPick(null);
    setSelectedBodyId(null);
  }, []);

  useEffect(() => {
    if (!devFixture || fixtureStartedRef.current) return;
    fixtureStartedRef.current = true;
    let active = true;

    setFixtureStatus('loading');
    setActivePanel('tree');
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
    setNotice(`Fixture ${devFixture}: загрузка…`);

    void applyPartDevFixture(app, devFixture)
      .then((result) => {
        if (!active) return;
        setActiveWorkspace(result.workspace);
        setActivePanel('tree');
        setActiveCommand(null);
        setEditingDimensionId(null);
        clearTransientSelection();
        setFixtureStatus(result.expectedRecomputeStatus === 'error' ? 'error' : 'ready');
        setNotice(result.message);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFixtureStatus('error');
        setNotice(`Fixture ${devFixture} failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    return () => {
      active = false;
    };
  }, [app, clearTransientSelection, devFixture]);

  const requestViewportCommand = useCallback((view: CadViewportViewName) => {
    setViewCommand((current) => ({ sequence: current.sequence + 1, view }));
  }, []);

  const requestView = useCallback((label: string) => {
    const view = viewportViewByLabel[label];
    if (!view) return;
    setViewName(label);
    requestViewportCommand(view);
  }, [requestViewportCommand]);

  const handleViewportPick = useCallback((pick: CadViewportPick) => {
    setSelectedPick(pick);
    if (pick.kind === 'face') {
      setNotice(`Грань выбрана: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    } else {
      setNotice(`Ребро выбрано: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    }
  }, []);

  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    setSelectedBodyId(bodyId);
    setSelectedPick(null);
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, []);

  async function createDocument(kind: CadDocumentKind) {
    await app.replaceDocument(createEmptyCadDocument(kind, { title: `${documentNames[kind]} 1` }));
    setNewDialogOpen(false);
    setActivePanel('tree');
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
    setActiveWorkspace(kind === 'part' ? 'solid' : kind);
    setNotice(`Создан документ «${documentNames[kind]}»`);
  }

  async function saveLocal() {
    try {
      const result = await persistence.save(app.getDocument() as CadDocument);
      setNotice(`Сохранено локально · ревизия ${result.revision}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function openLocal() {
    if (!persistence.hasStoredProject()) {
      setNotice('Нет локально сохраненного документа');
      return;
    }
    try {
      setNotice('Открытие документа…');
      await app.replaceDocument(await persistence.load());
      setActivePanel('tree');
      setActiveCommand(null);
      setEditingDimensionId(null);
      clearTransientSelection();
      setActiveWorkspace(app.getDocument().kind === 'part' ? 'solid' : app.getDocument().kind);
      setNotice('Локальный документ открыт');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  function beginCreateSketch() {
    if (document.kind !== 'part') return;
    setActiveCommand('part.sketch.create');
    setActivePanel('parameters');
    setSelectedPick(null);
    setSelectedBodyId(null);
    if (hasSolid && renderModel) {
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
    let support: 'XY' | 'XZ' | 'YZ' | string = sketchPlane;
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
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    const supportText = currentPart?.bodies.length ? 'выбранной грани' : `плоскости ${sketchPlane}`;
    setActiveCommand(null);
    setActivePanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
    setNotice(`Создан эскиз на ${supportText}`);
  }

  function beginRectangle() {
    if (!sketch) return;
    setActiveCommand('sketch.rectangle');
    setActivePanel('parameters');
    clearTransientSelection();
    setNotice('Задайте ширину и высоту прямоугольника');
  }

  async function commitRectangle() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = latestSketch(currentPart);
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
    setActivePanel('tree');
    setNotice(`Прямоугольник ${rectangleWidth}×${rectangleHeight} мм создан`);
  }

  function beginCircle() {
    if (!sketch) return;
    setActiveCommand('sketch.circle');
    setActivePanel('parameters');
    clearTransientSelection();
    setNotice('Задайте диаметр окружности');
  }

  async function commitCircle() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = latestSketch(currentPart);
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
    setActivePanel('tree');
    setNotice(`Окружность Ø${circleDiameter} мм создана`);
  }

  async function finishSketch() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = latestSketch(currentPart);
    if (!currentSketch) return;
    const result = await app.execute({ id: 'sketch.finish', payload: { sketchId: currentSketch.id } });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось завершить эскиз');
      return;
    }
    setActiveCommand(null);
    setActivePanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice('Эскиз завершен');
  }

  function beginExtrude() {
    if (!canExtrude || !sketch) return;
    setActiveCommand('part.extrude');
    setActivePanel('parameters');
    clearTransientSelection();
    setNotice('Задайте расстояние выдавливания');
  }

  async function commitExtrude() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = latestSketch(currentPart);
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
    setActivePanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(`Выдавливание ${extrudeDistance} мм построено локально`);
  }

  function beginCut() {
    if (!canCut) return;
    setActiveCommand('part.cutExtrude');
    setActivePanel('parameters');
    clearTransientSelection();
    setNotice('Вырез будет выполнен сквозь всё тело');
  }

  async function commitCut() {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = latestSketch(currentPart);
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
    setActivePanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice('Сквозной вырез построен локально');
  }

  function beginFillet() {
    if (!canFillet || !renderModel) return;
    setActiveCommand('part.fillet');
    setActivePanel('parameters');
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
    setActivePanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    setNotice(`Скругление R${filletRadius} построено локально`);
  }

  function beginDimensionEdit(id: CadDimensionId) {
    const currentPart = partDocument(app.getDocument());
    const dimension = currentPart?.dimensions.find((item) => item.id === id);
    if (!dimension || !dimension.driving) return;
    setEditingDimensionId(id);
    setDimensionEditValue(dimension.value);
    setActiveCommand('dimension.edit');
    setActivePanel('parameters');
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
    setActivePanel('tree');
    clearTransientSelection();
    setNotice(`${label} изменен на ${dimensionEditValue} мм; модель перестроена`);
  }

  function cancelCommand() {
    const stayInSketch = activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';
    setActiveCommand(null);
    setEditingDimensionId(null);
    setActivePanel('tree');
    clearTransientSelection();
    setActiveWorkspace(
      document.kind === 'part'
        ? stayInSketch ? 'sketch' : 'solid'
        : document.kind,
    );
    setNotice('Команда отменена');
  }

  async function commitActiveCommand() {
    if (activeCommand === 'part.sketch.create') return commitCreateSketch();
    if (activeCommand === 'sketch.rectangle') return commitRectangle();
    if (activeCommand === 'sketch.circle') return commitCircle();
    if (activeCommand === 'part.extrude') return commitExtrude();
    if (activeCommand === 'part.cutExtrude') return commitCut();
    if (activeCommand === 'part.fillet') return commitFillet();
    if (activeCommand === 'dimension.edit') return commitDimensionEdit();
  }

  async function undo() {
    clearTransientSelection();
    const result = await app.undo();
    setNotice(result.changed ? 'Отменено' : 'Нечего отменять');
  }

  async function redo() {
    clearTransientSelection();
    const result = await app.redo();
    setNotice(result.changed ? 'Повторено' : 'Нечего повторять');
  }

  async function rebuild() {
    clearTransientSelection();
    setNotice('Перестроение…');
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');
  }

  async function dispatchShortcutAction(action: ShortcutActionId) {
    switch (action) {
      case 'system.save':
        await saveLocal();
        return;
      case 'system.undo':
        await undo();
        return;
      case 'system.redo':
        await redo();
        return;
      case 'system.rebuild':
        await rebuild();
        return;
      case 'interaction.cancel':
        if (activeCommand && selectedPick) {
          setSelectedPick(null);
          setNotice('Выбор очищен; команда остаётся активной');
          return;
        }
        if (activeCommand) {
          cancelCommand();
          return;
        }
        clearTransientSelection();
        setNotice('Выбор очищен');
        return;
      case 'interaction.commit':
        await commitActiveCommand();
        return;
      case 'interaction.delete':
        setNotice('Удаление выбранного объекта будет включено отдельной безопасной командой');
        return;
      case 'view.fit':
        requestView('Показать всё');
        return;
      case 'view.iso':
        requestView('Изометрия');
        return;
      case 'view.front':
        requestView('Спереди');
        return;
      case 'view.top':
        requestView('Сверху');
        return;
      case 'view.left':
        requestView('Слева');
        return;
      case 'view.zoomIn':
        requestViewportCommand('zoom-in');
        return;
      case 'view.zoomOut':
        requestViewportCommand('zoom-out');
        return;
      case 'view.panLeft':
        requestViewportCommand('pan-left');
        return;
      case 'view.panRight':
        requestViewportCommand('pan-right');
        return;
      case 'view.panUp':
        requestViewportCommand('pan-up');
        return;
      case 'view.panDown':
        requestViewportCommand('pan-down');
        return;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const resolved = shortcutRegistry.resolve(
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      },
      {
        documentKind: document.kind,
        activeCommand,
        hasSelection: Boolean(selectedBodyId) && !activeCommand,
        cadEditorFocused: true,
        inputKind: shortcutInputKind(event.target),
      },
    );
    if (!resolved) return;
    if (resolved.preventDefault) event.preventDefault();
    void dispatchShortcutAction(resolved.action);
  }

  const fixtureError = state.recompute.status === 'error' ? state.recompute.message : undefined;

  return (
    <div
      className="cad-app"
      data-document-kind={document.kind}
      data-runtime-status={runtimeState.status}
      data-recompute-status={state.recompute.status}
      data-dev-fixture={devFixture ?? ''}
      data-fixture-status={fixtureStatus}
      data-sketch-count={part?.sketches.length ?? 0}
      data-feature-count={part?.features.length ?? 0}
      data-stable-reference-count={part?.stableReferences.length ?? 0}
      data-selected-kind={selectedPick?.kind ?? ''}
      data-selected-point={selectedPointText}
      data-selected-body-id={selectedBodyId ?? ''}
      data-shortcuts="central"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className="main-menu-bar">
        <button className="brand-button" type="button" onClick={() => setNewDialogOpen(true)} aria-label="ASA-CAD">
          <span className="brand-mark">A</span>
          <span>ASA-CAD</span>
        </button>
        <nav className="main-menu-items" aria-label="Главное меню">
          <button type="button">Файл</button>
          <button type="button">Главная</button>
          <button type="button">Сервис</button>
        </nav>
        <div className="command-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск команд"
            aria-label="Поиск команд"
          />
          {searchableCommands.length > 0 && (
            <div className="command-search-results">
              {searchableCommands.map((command) => (
                <button key={command.id} type="button" onClick={() => setSearch('')}>
                  <span>{command.labelRu}</span>
                  <small>{command.milestone}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="global-actions">
          <button type="button" title="Открыть" onClick={openLocal}>⌂</button>
          <button type="button" title="Сохранить (Ctrl+S)" onClick={saveLocal}>▣</button>
          <button type="button" title="Отменить (Ctrl+Z)" onClick={undo} disabled={!state.canUndo}>↶</button>
          <button type="button" title="Повторить (Ctrl+Y / Ctrl+Shift+Z)" onClick={redo} disabled={!state.canRedo}>↷</button>
          <button type="button" title="Настройки" onClick={openSettings} aria-haspopup="dialog" aria-controls="asa-cad-interface-settings">⚙</button>
        </div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Документы">
        <button type="button" className="new-tab-button" onClick={() => setNewDialogOpen(true)} title="Новый документ">＋</button>
        <button className="document-tab active" type="button" role="tab" aria-selected="true">
          <span className="document-kind-icon">{kindIcon(document.kind)}</span>
          <span>{document.title}</span>
          {state.dirty && <span className="dirty-dot" title="Изменено">●</span>}
          <span className="tab-close" aria-hidden="true">×</span>
        </button>
      </div>

      <section className="instrument-area">
        <div className="workspace-tabs" role="tablist" aria-label="Инструментальные области">
          {document.kind === 'part' ? (
            <>
              <WorkspaceTab active={activeWorkspace === 'solid'} onClick={() => setActiveWorkspace('solid')}>Твердотельное моделирование</WorkspaceTab>
              {activeWorkspace === 'sketch' && <WorkspaceTab active>Эскиз</WorkspaceTab>}
              <WorkspaceTab active={activeWorkspace === 'surfaces'} onClick={() => setActiveWorkspace('surfaces')}>Каркас и поверхности</WorkspaceTab>
              <WorkspaceTab active={activeWorkspace === 'diagnostics'} onClick={() => setActiveWorkspace('diagnostics')}>Проверка / Измерения</WorkspaceTab>
              <WorkspaceTab active={activeWorkspace === 'view'} onClick={() => setActiveWorkspace('view')}>Вид</WorkspaceTab>
            </>
          ) : (
            <WorkspaceTab active>{documentNames[document.kind]}</WorkspaceTab>
          )}
        </div>

        <div className="command-ribbon">
          {document.kind === 'part' && activeWorkspace === 'sketch' ? (
            <>
              <CommandGroup label="Геометрия">
                <CommandButton id="sketch.rectangle" large active disabled={!sketch} reason="Сначала создайте эскиз" onClick={beginRectangle} />
                <CommandButton id="sketch.circle" disabled={!sketch} reason="Сначала создайте эскиз" onClick={beginCircle} />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton
                  label={rectangleReady ? `${rectangleWidth} × ${rectangleHeight} мм` : circleReady ? `Ø${circleDiameter} мм` : 'Размеры'}
                  symbol="↔"
                  disabled
                />
              </CommandGroup>
              <CommandGroup label="Эскиз" compact>
                <RibbonTextButton label="Завершить эскиз" symbol="✓" onClick={finishSketch} disabled={!sketch} />
              </CommandGroup>
            </>
          ) : document.kind === 'part' && activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CommandButton id="part.sketch.create" large active onClick={beginCreateSketch} />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CommandButton
                  id="part.extrude"
                  disabled={!canExtrude}
                  reason="Завершите прямоугольный эскиз"
                  onClick={beginExtrude}
                />
                <CommandButton
                  id="part.cutExtrude"
                  disabled={!canCut}
                  reason="Создайте окружность на грани и завершите эскиз"
                  onClick={beginCut}
                />
                <CommandButton
                  id="part.fillet"
                  disabled={!canFillet}
                  reason="Сначала постройте сквозной вырез"
                  onClick={beginFillet}
                />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <RibbonTextButton label="Перестроить" symbol="↻" onClick={rebuild} title="Перестроить (F5)" />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : document.kind === 'part' ? (
            <ViewCommandGroups viewName={viewName} requestView={requestView} />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[document.kind]}</strong>
              <span>Документный маршрут уже существует. Инструменты включаются по roadmap без фиктивных кнопок.</span>
            </div>
          )}
        </div>
      </section>

      <main className="content-area">
        <aside className="management-rail" aria-label="Панели">
          <button
            type="button"
            className={activePanel === 'tree' ? 'active' : ''}
            onClick={() => setActivePanel('tree')}
            title="Дерево"
          >
            ☷
            <span>Дерево</span>
          </button>
          <button
            type="button"
            className={activePanel === 'parameters' ? 'active' : ''}
            onClick={() => setActivePanel('parameters')}
            title="Параметры"
          >
            ≡
            <span>Параметры</span>
          </button>
          <button type="button" disabled title="Переменные — M7">
            ƒ
            <span>Переменные</span>
          </button>
        </aside>

        <aside className="management-panel">
          {activePanel === 'tree' ? (
            <DocumentTree
              document={document}
              selectedBodyId={selectedBodyId}
              onSelectBody={handleBodySelect}
              onEditDimension={beginDimensionEdit}
            />
          ) : (
            <ParameterPanel
              activeCommand={activeCommand}
              requiresFaceSelection={hasSolid && activeCommand === 'part.sketch.create'}
              selectedPick={selectedPick}
              sketchPlane={sketchPlane}
              setSketchPlane={setSketchPlane}
              rectangleWidth={rectangleWidth}
              rectangleHeight={rectangleHeight}
              setRectangleWidth={setRectangleWidth}
              setRectangleHeight={setRectangleHeight}
              circleDiameter={circleDiameter}
              setCircleDiameter={setCircleDiameter}
              extrudeDistance={extrudeDistance}
              setExtrudeDistance={setExtrudeDistance}
              filletRadius={filletRadius}
              setFilletRadius={setFilletRadius}
              dimensionEditValue={dimensionEditValue}
              setDimensionEditValue={setDimensionEditValue}
              onCreateSketch={commitCreateSketch}
              onCreateRectangle={commitRectangle}
              onCreateCircle={commitCircle}
              onExtrude={commitExtrude}
              onCut={commitCut}
              onFillet={commitFillet}
              onDimensionEdit={commitDimensionEdit}
              onCancel={cancelCommand}
            />
          )}
        </aside>

        <section className="work-area" aria-label="Рабочая область">
          <div className="viewport-quick-access" aria-label="Быстрый доступ рабочей области">
            <button type="button" title="Показать всё (F)" onClick={() => requestView('Показать всё')}>⌗</button>
            <button type="button" title="Изометрия (0)" onClick={() => requestView('Изометрия')}>◇</button>
            <span className="quick-separator" />
            <span className="view-caption">{viewName}</span>
            {selectionMode !== 'none' && <span className="selection-caption">{selectionMode === 'face' ? 'Выбор грани' : 'Выбор ребра'}</span>}
            {selectedBody && selectionMode === 'none' && <span className="selection-caption">Выбрано: {selectedBody.name}</span>}
            {activeCommand && (
              <>
                <span className="quick-separator" />
                <button className="quick-accept" type="button" onClick={commitActiveCommand} title="Применить (Ctrl+Enter)">✓</button>
                <button className="quick-cancel" type="button" onClick={cancelCommand} title="Отмена (Esc)">×</button>
              </>
            )}
          </div>

          <div className="model-stage">
            {document.kind === 'part' ? (
              <>
                <div className="origin-widget" aria-label="Ориентация">
                  <span className="axis-z">Z</span>
                  <span className="axis-x">X</span>
                  <span className="axis-y">Y</span>
                </div>
                <div className="stage-grid" />
                {renderModel ? (
                  <CadViewport
                    model={renderModel}
                    selectionMode={selectionMode}
                    onPick={handleViewportPick}
                    viewCommand={viewCommand}
                    selectedBodyId={selectedBodyId}
                    onBodySelect={handleBodySelect}
                  />
                ) : (
                  <div className="stage-message">
                    <div className="stage-symbol">{fixtureError ? '!' : '◇'}</div>
                    <strong>
                      {fixtureError
                        ? 'Ошибка перестроения'
                        : part && part.sketches.length > 0 ? `${part.sketches.length} эскиз(а)` : 'Новая деталь'}
                    </strong>
                    <span>{runtimeState.status === 'loading' ? 'Загрузка OpenCascade…' : fixtureError ? 'B-Rep не построен' : 'ASA-CAD'}</span>
                    <small>
                      {fixtureError
                        ? fixtureError
                        : rectangleReady
                          ? 'Эскиз параметрический. Завершите его и выполните выдавливание — B-Rep будет построен локально в браузере.'
                          : 'Создайте эскиз и геометрию. OpenCascade не загружается до первой твердотельной операции.'}
                    </small>
                  </div>
                )}
              </>
            ) : (
              <div className="stage-message">
                <div className="stage-symbol">{kindIcon(document.kind)}</div>
                <strong>{documentNames[document.kind]}</strong>
                <span>{documentDescriptions[document.kind]}</span>
                <small>Каркас маршрута готов; функциональный редактор включается на соответствующем milestone.</small>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="status-bar">
        <div className="status-left">
          <span className={`status-indicator ${state.recompute.status}`} />
          <span>{notice}</span>
        </div>
        <div className="status-right">
          {devFixture && <span>fixture:{devFixture}</span>}
          {selectedPick && <span>{selectedPick.kind === 'face' ? 'Грань' : 'Ребро'}: {selectedPointText}</span>}
          {selectedBody && <span>Выбрано: {selectedBody.name}</span>}
          <span>{documentNames[document.kind]}</span>
          <span>{runtimeState.status === 'ready' ? 'OCC локально' : 'ядро по требованию'}</span>
          <span>мм</span>
          <span>UI 100%</span>
          <span>M2</span>
        </div>
      </footer>

      <div className="mobile-bottom-bar" aria-label="Мобильные панели">
        <button type="button" onClick={() => setActivePanel('tree')}>☷<span>Дерево</span></button>
        <button type="button" onClick={() => setActivePanel('parameters')}>≡<span>Параметры</span></button>
        <button type="button" onClick={() => setNewDialogOpen(true)}>＋<span>Документ</span></button>
      </div>

      {newDialogOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setNewDialogOpen(false)}>
          <section className="new-document-dialog" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
            <header>
              <div>
                <h2 id="new-document-title">Новый документ</h2>
                <p>Один ASA-CAD, шесть инженерных типов документов</p>
              </div>
              <button type="button" onClick={() => setNewDialogOpen(false)} aria-label="Закрыть">×</button>
            </header>
            <div className="document-kind-grid">
              {(Object.keys(documentNames) as CadDocumentKind[]).map((kind) => (
                <button key={kind} type="button" onClick={() => createDocument(kind)}>
                  <span className="kind-card-icon">{kindIcon(kind)}</span>
                  <span className="kind-card-text">
                    <strong>{documentNames[kind]}</strong>
                    <small>{documentDescriptions[kind]}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function WorkspaceTab(props: React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>) {
  return (
    <button className={props.active ? 'active' : ''} type="button" onClick={props.onClick} role="tab" aria-selected={props.active}>
      {props.children}
    </button>
  );
}

function CommandGroup(props: React.PropsWithChildren<{ label: string; compact?: boolean }>) {
  return (
    <section className={`command-group ${props.compact ? 'compact' : ''}`}>
      <div className="command-group-content">{props.children}</div>
      <div className="command-group-label">{props.label}</div>
    </section>
  );
}

function CommandButton(props: {
  id: string;
  disabled?: boolean;
  reason?: string;
  large?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const command = commandById.get(props.id);
  const label = command?.labelRu ?? props.id;
  return (
    <button
      className={`ribbon-command ${props.large ? 'large' : ''} ${props.active ? 'accent' : ''}`}
      type="button"
      disabled={props.disabled}
      title={props.disabled && props.reason ? `${label}: ${props.reason}` : label}
      onClick={props.onClick}
    >
      <span className="ribbon-command-icon" aria-hidden="true">{commandSymbol(props.id)}</span>
      <span>{label}</span>
      {props.disabled && <span className="planned-badge">позже</span>}
    </button>
  );
}

function RibbonTextButton(props: { label: string; symbol: string; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button className="ribbon-command text-command" type="button" disabled={props.disabled} onClick={props.onClick} title={props.title}>
      <span className="ribbon-command-icon">{props.symbol}</span>
      <span>{props.label}</span>
    </button>
  );
}

function commandSymbol(id: string): string {
  if (id.includes('sketch')) return '▱';
  if (id.includes('circle')) return '○';
  if (id.includes('cut')) return '▣';
  if (id.includes('extrude')) return '▤';
  if (id.includes('fillet')) return '◜';
  return '◇';
}

function ViewCommandGroups(props: { viewName: string; requestView: (value: string) => void }) {
  const views = ['Спереди', 'Сзади', 'Сверху', 'Снизу', 'Слева', 'Справа', 'Изометрия'];
  const shortcuts: Record<string, string> = {
    'Спереди': '1',
    'Сверху': '2',
    'Слева': '3',
    'Изометрия': '0',
  };
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <button
          className={`ribbon-command view-command ${props.viewName === view ? 'selected' : ''}`}
          type="button"
          key={view}
          onClick={() => props.requestView(view)}
          title={shortcuts[view] ? `${view} (${shortcuts[view]})` : view}
        >
          <span className="ribbon-command-icon">◇</span>
          <span>{view}</span>
        </button>
      ))}
    </CommandGroup>
  );
}
