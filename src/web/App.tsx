import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import { parseCadClientRoute } from '../browser/routes';
import { createEmptyCadDocument, type CadDocument, type CadDocumentKind } from '../contracts/document';
import type { CadViewportViewCommand, CadViewportViewName } from './CadViewport';
import { applyPartDevFixture } from './devFixtures';
import { useCadProjectPersistence, type CadProjectPersistenceOverrides } from './useCadProjectPersistence';
import { useCadPersistenceCommands } from './useCadPersistenceCommands';
import { useM2CadUiActions } from './useM2CadUiActions';
import { MobileToolsPanel } from './MobileToolsPanel';
import { DocumentTree } from './DocumentTree';
import { ParameterPanel } from './ParameterPanel';
import { PartModelStage } from './PartModelStage';
import { CadShellTop } from './CadShellTop';
import { CadShellMain } from './CadShellMain';
import { CadShellBottom } from './CadShellBottom';
import { NewDocumentDialog } from './NewDocumentDialog';
import { PlannedDocumentStage } from './PlannedDocumentStage';
import { documentNames } from './CadDocumentPresentation';
import { usePartSketchWorkspace } from './usePartSketchWorkspace';
import { cadUiActionIdForShortcut } from './M2CadUiActions';
import { ShortcutRegistry, shortcutInputKind, type ShortcutActionId } from './ShortcutRegistry';

const viewportViewByLabel: Record<string, CadViewportViewName> = {
  'Показать всё': 'fit', 'Спереди': 'front', 'Сзади': 'back', 'Сверху': 'top',
  'Снизу': 'bottom', 'Слева': 'left', 'Справа': 'right', 'Изометрия': 'isometric',
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
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [notice, setNotice] = useState(devFixture ? `Fixture ${devFixture}: загрузка…` : 'Готово');
  const [fixtureStatus, setFixtureStatus] = useState<'none' | 'loading' | 'ready' | 'error'>(devFixture ? 'loading' : 'none');
  const [viewName, setViewName] = useState('Изометрия');
  const [viewCommand, setViewCommand] = useState<CadViewportViewCommand>({ sequence: 0, view: 'isometric' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = app.subscribe(() => setRevisionToken((value) => value + 1));
    return () => { unsubscribe(); app.dispose(); };
  }, [app]);

  const document = app.getDocument();
  const state = app.getState();
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();
  const workspace = usePartSketchWorkspace({
    app, document, renderModelAvailable: Boolean(renderModel), setPanel: setActivePanel, setNotice,
  });
  const {
    activeWorkspace, setActiveWorkspace, activeCommand, activeSketchId, selectedSketchEntityId,
    selectionMode, selectedPick, selectedBodyId, sketchPlane, setSketchPlane,
    rectangleWidth, setRectangleWidth, rectangleHeight, setRectangleHeight,
    circleDiameter, setCircleDiameter, extrudeDistance, setExtrudeDistance,
    filletRadius, setFilletRadius, dimensionEditValue, setDimensionEditValue,
    part, sketch, rectangleReady, circleReady, hasSolid, canExtrude, canCut, canFillet,
    selectedPointText, selectedBody, clearTransientSelection, clearSelectedPick,
    resetTransient, resetToWorkspace, resetForDocument, handleViewportPick, handleBodySelect,
    handleSketchEntitySelect, deleteSelectedSketchEntity, translateSketchEntity, enterSketch,
    beginLine, lineDraft, lineCommitting, handleSketchLinePointMove, handleSketchLinePoint,
    rectangleDraft, rectangleCommitting, handleSketchRectanglePointMove, handleSketchRectanglePoint,
    circleDraft, circleCommitting, handleSketchCirclePointMove, handleSketchCirclePoint,
    beginArc, arcDraft, arcCommitting, handleSketchArcPointMove, handleSketchArcPoint,
    beginCreateSketch, commitCreateSketch, beginRectangle, commitRectangle, beginCircle, commitCircle,
    finishSketch, beginExtrude, commitExtrude, beginCut, commitCut, beginFillet, commitFillet,
    beginDimensionEdit, commitDimensionEdit, cancelCommand, commitActiveCommand,
  } = workspace;

  useEffect(() => {
    if (!devFixture || fixtureStartedRef.current) return;
    fixtureStartedRef.current = true;
    let active = true;
    setFixtureStatus('loading');
    setActivePanel('tree');
    resetTransient();
    setNotice(`Fixture ${devFixture}: загрузка…`);

    void applyPartDevFixture(app, devFixture)
      .then((result) => {
        if (!active) return;
        if (result.activeSketchId) enterSketch(result.activeSketchId);
        else { resetToWorkspace(result.workspace); setActivePanel('tree'); }
        setFixtureStatus(result.expectedRecomputeStatus === 'error' ? 'error' : 'ready');
        setNotice(result.message);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFixtureStatus('error');
        setNotice(`Fixture ${devFixture} failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  }, [app, devFixture, enterSketch, resetToWorkspace, resetTransient]);

  const requestViewportCommand = useCallback((view: CadViewportViewName) => {
    setViewCommand((current) => ({ sequence: current.sequence + 1, view }));
  }, []);
  const requestView = useCallback((label: string) => {
    const view = viewportViewByLabel[label];
    if (!view) return;
    setViewName(label);
    requestViewportCommand(view);
  }, [requestViewportCommand]);

  async function createDocument(kind: CadDocumentKind) {
    await app.replaceDocument(createEmptyCadDocument(kind, { title: `${documentNames[kind]} 1` }));
    setNewDialogOpen(false);
    setActivePanel('tree');
    resetForDocument(kind);
    setNotice(`Создан документ «${documentNames[kind]}»`);
  }

  const resetAfterOpen = useCallback((kind: CadDocumentKind) => {
    setActivePanel('tree');
    resetForDocument(kind);
  }, [resetForDocument]);
  const { save: saveLocal, open: openLocal } = useCadPersistenceCommands({
    persistence, remoteHost: Boolean(props.projectHost), setNotice, onOpened: resetAfterOpen,
  });

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

  const uiActions = useM2CadUiActions(
    {
      open: openLocal, save: saveLocal, undo, redo, rebuild, createSketch: beginCreateSketch,
      line: beginLine, rectangle: beginRectangle, circle: beginCircle, arc: beginArc,
      deleteSketchEntity: deleteSelectedSketchEntity, finishSketch, extrude: beginExtrude,
      cutExtrude: beginCut, fillet: beginFillet,
      fit: () => requestView('Показать всё'), front: () => requestView('Спереди'),
      back: () => requestView('Сзади'), top: () => requestView('Сверху'), bottom: () => requestView('Снизу'),
      left: () => requestView('Слева'), right: () => requestView('Справа'), isometric: () => requestView('Изометрия'),
    },
    {
      canUndo: state.canUndo, canRedo: state.canRedo, hasSketch: Boolean(sketch),
      hasSketchEntitySelection: Boolean(selectedSketchEntityId), canExtrude,
      canCutExtrude: canCut, canFillet,
    },
  );
  const searchableActions = uiActions.search(search);
  const uiAction = (id: string) => {
    const action = uiActions.byId.get(id);
    if (!action) throw new Error(`Missing CadUiAction: ${id}`);
    return action;
  };

  async function dispatchShortcutAction(action: ShortcutActionId) {
    const sharedActionId = cadUiActionIdForShortcut(action);
    if (sharedActionId) {
      const sharedAction = uiActions.byId.get(sharedActionId);
      if (!sharedAction) throw new Error(`Missing CadUiAction for shortcut: ${sharedActionId}`);
      if (!sharedAction.enabled) { setNotice(sharedAction.disabledReason ?? 'Команда недоступна'); return; }
      await sharedAction.execute();
      return;
    }

    switch (action) {
      case 'interaction.cancel':
        if (activeCommand && selectedPick) {
          clearSelectedPick();
          setNotice('Выбор очищен; команда остаётся активной');
          return;
        }
        if (activeCommand) { cancelCommand(); return; }
        clearTransientSelection();
        setNotice('Выбор очищен');
        return;
      case 'interaction.commit': await commitActiveCommand(); return;
      case 'interaction.delete': await deleteSelectedSketchEntity(); return;
      case 'view.zoomIn': requestViewportCommand('zoom-in'); return;
      case 'view.zoomOut': requestViewportCommand('zoom-out'); return;
      case 'view.panLeft': requestViewportCommand('pan-left'); return;
      case 'view.panRight': requestViewportCommand('pan-right'); return;
      case 'view.panUp': requestViewportCommand('pan-up'); return;
      case 'view.panDown': requestViewportCommand('pan-down'); return;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const resolved = shortcutRegistry.resolve(
      {
        key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        shiftKey: event.shiftKey, altKey: event.altKey,
      },
      {
        documentKind: document.kind, activeCommand,
        hasSelection: Boolean(selectedBodyId || selectedSketchEntityId) && !activeCommand,
        cadEditorFocused: true, inputKind: shortcutInputKind(event.target),
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
      data-active-sketch-id={activeSketchId ?? ''}
      data-selected-sketch-entity-id={selectedSketchEntityId ?? ''}
      data-shortcuts="central"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <CadShellTop
        documentKind={document.kind}
        documentTitle={document.title}
        dirty={state.dirty}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        search={search}
        setSearch={setSearch}
        searchableActions={searchableActions}
        getAction={uiAction}
        openNewDocument={() => setNewDialogOpen(true)}
        rectangleReady={rectangleReady}
        rectangleWidth={rectangleWidth}
        rectangleHeight={rectangleHeight}
        circleReady={circleReady}
        circleDiameter={circleDiameter}
        viewName={viewName}
      />

      <CadShellMain
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        requestView={requestView}
        viewName={viewName}
        selectionMode={selectionMode}
        selectedBodyName={selectedBody?.name}
        selectedSketchEntityId={selectedSketchEntityId}
        activeCommand={activeCommand}
        commitActiveCommand={commitActiveCommand}
        cancelCommand={cancelCommand}
        treeContent={
          <DocumentTree
            document={document}
            selectedBodyId={selectedBodyId}
            activeSketchId={activeSketchId}
            onSelectBody={handleBodySelect}
            onEditSketch={enterSketch}
            onEditDimension={beginDimensionEdit}
          />
        }
        parametersContent={
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
        }
        toolsContent={
          <MobileToolsPanel documentKind={document.kind} workspace={activeWorkspace} getAction={uiAction} />
        }
        modelContent={
          document.kind === 'part' ? (
            <PartModelStage
              document={document}
              activeSketch={sketch}
              activeWorkspace={activeWorkspace}
              activeCommand={activeCommand}
              revisionToken={revisionToken}
              renderModel={renderModel}
              runtimeStatus={runtimeState.status}
              fixtureError={fixtureError}
              rectangleReady={rectangleReady}
              selectionMode={selectionMode}
              onPick={handleViewportPick}
              viewCommand={viewCommand}
              selectedBodyId={selectedBodyId}
              onBodySelect={handleBodySelect}
              selectedSketchEntityId={selectedSketchEntityId}
              onSketchEntitySelect={handleSketchEntitySelect}
              onSketchEntityTranslate={translateSketchEntity}
              onSketchDragRejected={setNotice}
              lineDraft={lineDraft}
              lineCommitting={lineCommitting}
              onSketchLinePointMove={handleSketchLinePointMove}
              onSketchLinePoint={handleSketchLinePoint}
              rectangleDraft={rectangleDraft}
              rectangleCommitting={rectangleCommitting}
              onSketchRectanglePointMove={handleSketchRectanglePointMove}
              onSketchRectanglePoint={handleSketchRectanglePoint}
              circleDraft={circleDraft}
              circleCommitting={circleCommitting}
              onSketchCirclePointMove={handleSketchCirclePointMove}
              onSketchCirclePoint={handleSketchCirclePoint}
              arcDraft={arcDraft}
              arcCommitting={arcCommitting}
              onSketchArcPointMove={handleSketchArcPointMove}
              onSketchArcPoint={handleSketchArcPoint}
            />
          ) : (
            <PlannedDocumentStage kind={document.kind} />
          )
        }
      />

      <CadShellBottom
        recomputeStatus={state.recompute.status}
        notice={notice}
        devFixture={devFixture}
        selectedPickKind={selectedPick?.kind}
        selectedPointText={selectedPointText}
        selectedBodyName={selectedBody?.name}
        selectedSketchEntityId={selectedSketchEntityId}
        documentKind={document.kind}
        runtimeStatus={runtimeState.status}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />

      <NewDocumentDialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} onCreate={createDocument} />
    </div>
  );
}
