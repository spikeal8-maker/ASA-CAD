import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import { parseCadClientRoute } from '../browser/routes';
import { createEmptyCadDocument, type CadDocumentKind } from '../contracts/document';
import type { CadViewportViewCommand, CadViewportViewName } from './CadViewport';
import { applyPartDevFixture } from './devFixtures';
import { useCadProjectPersistence, type CadProjectPersistenceOverrides } from './useCadProjectPersistence';
import { useCadPersistenceCommands } from './useCadPersistenceCommands';
import { useDocumentReplacementGuard } from './useDocumentReplacementGuard';
import { usePartCadUiActionCatalog } from './usePartCadUiActionCatalog';
import { CadShellTop } from './CadShellTop';
import { CadShellBottom } from './CadShellBottom';
import { CadWorkspaceContent } from './CadWorkspaceContent';
import { documentNames } from './CadDocumentPresentation';
import { usePartSketchWorkspace } from './usePartSketchWorkspace';
import { useDrawingWorkspace } from './useDrawingWorkspace';
import { cadUiActionIdForShortcut } from './M2CadUiActions';
import { ShortcutRegistry, shortcutInputKind, type ShortcutActionId } from './ShortcutRegistry';

const viewportViewByLabel: Record<string, CadViewportViewName> = {
  'Показать всё': 'fit',
  'Спереди': 'front',
  'Сзади': 'back',
  'Сверху': 'top',
  'Снизу': 'bottom',
  'Слева': 'left',
  'Справа': 'right',
  'Изометрия': 'isometric',
};

export function App(props: CadProjectPersistenceOverrides) {
  const route = useMemo(() => parseCadClientRoute(window.location.pathname), []);
  const devFixture = route.kind === 'dev-part' ? route.fixture : null;
  const fixtureStartedRef = useRef(false);
  const initialDocument = useMemo(() => createEmptyCadDocument('part', { title: 'Деталь 1' }), []);
  const runtime = useMemo(() => new BrowserPartRuntimeAdapter(), []);
  const app = useMemo(() => new CadApplicationImpl(initialDocument, runtime), [initialDocument, runtime]);
  const persistence = useCadProjectPersistence(app, initialDocument, route, props);
  const shortcutRegistry = useMemo(() => new ShortcutRegistry(), []);

  const [revisionToken, setRevisionToken] = useState(0);
  const [activePanel, setActivePanel] = useState<'tree' | 'parameters' | 'tools' | 'closed'>('tree');
  const [notice, setNotice] = useState(devFixture ? `Fixture ${devFixture}: загрузка…` : 'Готово');
  const [fixtureStatus, setFixtureStatus] = useState<'none' | 'loading' | 'ready' | 'error'>(
    devFixture ? 'loading' : 'none',
  );
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
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();

  const workspace = usePartSketchWorkspace({
    app,
    document,
    renderModelAvailable: Boolean(renderModel),
    setPanel: setActivePanel,
    setNotice,
  });
  const drawing = useDrawingWorkspace({ app, document, setPanel: setActivePanel, setNotice });

  useEffect(() => {
    if (!devFixture || fixtureStartedRef.current) return;
    fixtureStartedRef.current = true;
    let active = true;
    setFixtureStatus('loading');
    setActivePanel('tree');
    workspace.resetTransient();
    setNotice(`Fixture ${devFixture}: загрузка…`);
    void applyPartDevFixture(app, devFixture)
      .then((result) => {
        if (!active) return;
        if (result.activeSketchId) workspace.enterSketch(result.activeSketchId);
        else {
          workspace.resetToWorkspace(result.workspace);
          setActivePanel('tree');
        }
        setFixtureStatus(result.expectedRecomputeStatus === 'error' ? 'error' : 'ready');
        setNotice(result.message);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFixtureStatus('error');
        setNotice(`Fixture ${devFixture} failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  }, [app, devFixture, workspace.enterSketch, workspace.resetToWorkspace, workspace.resetTransient]);

  const requestViewportCommand = useCallback(
    (view: CadViewportViewName) => setViewCommand((current) => ({ sequence: current.sequence + 1, view })),
    [],
  );
  const requestView = useCallback((label: string) => {
    const view = viewportViewByLabel[label];
    if (!view) return;
    setViewName(label);
    requestViewportCommand(view);
  }, [requestViewportCommand]);

  async function createDocument(kind: CadDocumentKind) {
    await app.replaceDocument(createEmptyCadDocument(kind, { title: `${documentNames[kind]} 1` }));
    setActivePanel('tree');
    workspace.resetForDocument(kind);
    drawing.resetTransient();
    setNotice(`Создан документ «${documentNames[kind]}»`);
  }

  const resetAfterOpen = useCallback((kind: CadDocumentKind) => {
    setActivePanel('tree');
    workspace.resetForDocument(kind);
    drawing.resetTransient();
  }, [drawing.resetTransient, workspace.resetForDocument]);

  const { save: saveLocal, open: openLocal } = useCadPersistenceCommands({
    persistence,
    remoteHost: Boolean(props.projectHost),
    setNotice,
    onOpened: resetAfterOpen,
  });
  const replacement = useDocumentReplacementGuard({
    dirty: state.dirty,
    document,
    save: saveLocal,
    open: openLocal,
    onCreate: createDocument,
  });

  async function undo() {
    workspace.clearTransientSelection();
    drawing.resetTransient();
    const result = await app.undo();
    setNotice(result.changed ? 'Отменено' : 'Нечего отменять');
  }
  async function redo() {
    workspace.clearTransientSelection();
    drawing.resetTransient();
    const result = await app.redo();
    setNotice(result.changed ? 'Повторено' : 'Нечего повторять');
  }
  async function rebuild() {
    workspace.clearTransientSelection();
    drawing.resetTransient();
    setNotice('Перестроение…');
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');
  }

  const uiActions = usePartCadUiActionCatalog({
    workspace,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    newDocument: replacement.newDocument,
    open: replacement.openDocument,
    save: replacement.saveDocument,
    undo,
    redo,
    rebuild,
    horizontalConstraint: workspace.applyHorizontalConstraint,
    verticalConstraint: workspace.applyVerticalConstraint,
    fixedConstraint: workspace.applyFixedConstraint,
    concentricConstraint: workspace.beginConcentricConstraint,
    equalConstraint: workspace.beginEqualConstraint,
    symmetricConstraint: workspace.beginSymmetryConstraint,
    pointOnCurveConstraint: workspace.beginPointOnCurveConstraint,
    requestView,
    drawing: {
      line: drawing.beginLine,
      deleteEntity: drawing.deleteSelectedEntity,
      canLine: document.kind === 'drawing' && drawing.canLine,
      hasSelection: document.kind === 'drawing' && drawing.hasSelection,
    },
  });
  const searchableActions = uiActions.search(search);
  function uiAction(id: string) {
    const action = uiActions.byId.get(id);
    if (!action) throw new Error(`Missing CadUiAction: ${id}`);
    return action;
  }

  const drawingMode = document.kind === 'drawing';
  const activeCommand = drawingMode ? drawing.activeCommand : workspace.activeCommand;

  async function dispatchShortcutAction(action: ShortcutActionId) {
    const sharedActionId = cadUiActionIdForShortcut(action);
    if (sharedActionId) {
      const sharedAction = uiActions.byId.get(sharedActionId);
      if (!sharedAction) throw new Error(`Missing CadUiAction for shortcut: ${sharedActionId}`);
      if (!sharedAction.enabled) {
        setNotice(sharedAction.disabledReason ?? 'Команда недоступна');
        return;
      }
      await sharedAction.execute();
      return;
    }

    if (action === 'interaction.cancel') {
      if (drawingMode) {
        if (drawing.activeCommand) drawing.cancelCommand();
        else drawing.clearSelection();
        return;
      }
      if (workspace.activeCommand && workspace.selectedPick) {
        workspace.clearSelectedPick();
        setNotice('Выбор очищен; команда остаётся активной');
        return;
      }
      if (workspace.activeCommand) {
        workspace.cancelCommand();
        return;
      }
      workspace.clearTransientSelection();
      setNotice('Выбор очищен');
      return;
    }

    if (action === 'interaction.commit') {
      await (drawingMode ? drawing.commitActiveCommand() : workspace.commitActiveCommand());
      return;
    }
    if (action === 'interaction.delete') {
      await (drawingMode ? drawing.deleteSelectedEntity() : workspace.deleteSelectedSketchEntity());
      return;
    }

    const viewByShortcut: Partial<Record<ShortcutActionId, CadViewportViewName>> = {
      'view.zoomIn': 'zoom-in',
      'view.zoomOut': 'zoom-out',
      'view.panLeft': 'pan-left',
      'view.panRight': 'pan-right',
      'view.panUp': 'pan-up',
      'view.panDown': 'pan-down',
    };
    const view = viewByShortcut[action];
    if (view) requestViewportCommand(view);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const hasSelection = drawingMode
      ? drawing.hasSelection
      : Boolean(workspace.selectedBodyId || workspace.selectedSketchEntityId);
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
        hasSelection: hasSelection && !activeCommand,
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
      data-sketch-count={workspace.part?.sketches.length ?? 0}
      data-feature-count={workspace.part?.features.length ?? 0}
      data-stable-reference-count={workspace.part?.stableReferences.length ?? 0}
      data-selected-kind={workspace.selectedPick?.kind ?? ''}
      data-selected-point={workspace.selectedPointText}
      data-selected-body-id={workspace.selectedBodyId ?? ''}
      data-active-sketch-id={workspace.activeSketchId ?? ''}
      data-selected-sketch-entity-id={workspace.selectedSketchEntityId ?? ''}
      data-selected-drawing-entity-id={drawing.selectedEntityId ?? ''}
      data-shortcuts="central"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <CadShellTop
        documentKind={document.kind}
        documentTitle={document.title}
        dirty={replacement.dirty}
        activeWorkspace={workspace.activeWorkspace}
        setActiveWorkspace={workspace.setActiveWorkspace}
        search={search}
        setSearch={setSearch}
        searchableActions={searchableActions}
        getAction={uiAction}
        showRoadmapCommands={devFixture !== null}
        rectangleReady={workspace.rectangleReady}
        rectangleWidth={workspace.rectangleWidth}
        rectangleHeight={workspace.rectangleHeight}
        circleReady={workspace.circleReady}
        circleDiameter={workspace.circleDiameter}
        viewName={drawingMode ? 'Лист A4' : viewName}
      />

      <CadWorkspaceContent
        document={document}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        requestView={requestView}
        viewName={viewName}
        getAction={uiAction}
        part={workspace}
        drawing={drawing}
        revisionToken={revisionToken}
        renderModel={renderModel}
        runtimeStatus={runtimeState.status}
        fixtureError={fixtureError}
        viewCommand={viewCommand}
        onNotice={setNotice}
      />

      <CadShellBottom
        recomputeStatus={state.recompute.status}
        notice={notice}
        devFixture={devFixture}
        selectedPickKind={workspace.selectedPick?.kind}
        selectedPointText={workspace.selectedPointText}
        selectedBodyName={workspace.selectedBody?.name}
        selectedSketchEntityId={workspace.selectedSketchEntityId}
        documentKind={document.kind}
        runtimeStatus={runtimeState.status}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />
      {replacement.dialogs}
    </div>
  );
}
