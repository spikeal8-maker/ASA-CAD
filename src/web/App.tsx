import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import { parseCadClientRoute } from '../browser/routes';
import {
  createEmptyCadDocument,
  type CadDocument,
  type CadDocumentKind,
} from '../contracts/document';
import type {
  CadViewportViewCommand,
  CadViewportViewName,
} from './CadViewport';
import { applyPartDevFixture } from './devFixtures';
import { useCadProjectPersistence, type CadProjectPersistenceOverrides } from './useCadProjectPersistence';
import { useCadPersistenceCommands } from './useCadPersistenceCommands';
import { CadUiActionButton, CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';
import type { CadUiAction } from './CadUiAction';
import { useM2CadUiActions } from './useM2CadUiActions';
import { MobileToolsPanel } from './MobileToolsPanel';
import { DocumentTree } from './DocumentTree';
import { ParameterPanel } from './ParameterPanel';
import { PartModelStage } from './PartModelStage';
import { usePartSketchWorkspace } from './usePartSketchWorkspace';
import { cadUiActionIdForShortcut } from './M2CadUiActions';
import {
  ShortcutRegistry,
  shortcutInputKind,
  type ShortcutActionId,
} from './ShortcutRegistry';

const documentNames: Record<CadDocumentKind, string> = {
  part: 'Деталь',
  assembly: 'Сборка',
  drawing: 'Чертеж',
  fragment: 'Фрагмент',
  specification: 'Спецификация',
  text: 'Текстовый документ',
};

const documentDescriptions: Record<CadDocumentKind, string> = {
  part: 'Параметрическая трехмерная деталь',
  assembly: 'Сборка деталей и подсборок',
  drawing: 'Листовой ассоциативный чертеж',
  fragment: 'Свободный двумерный фрагмент',
  specification: 'Состав изделия и позиции',
  text: 'Инженерный текстовый документ',
};

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

function kindIcon(kind: CadDocumentKind): string {
  switch (kind) {
    case 'part': return '◇';
    case 'assembly': return '⬡';
    case 'drawing': return '▱';
    case 'fragment': return '⌗';
    case 'specification': return '≣';
    case 'text': return '¶';
  }
}

export function App(props: CadProjectPersistenceOverrides) {
  const route = useMemo(() => parseCadClientRoute(window.location.pathname), []);
  const devFixture = route.kind === 'dev-part' ? route.fixture : null;
  const fixtureStartedRef = useRef(false);
  const initialDocument = useMemo(
    () => createEmptyCadDocument('part', { title: 'Деталь 1' }),
    [],
  );
  const runtime = useMemo(() => new BrowserPartRuntimeAdapter(), []);
  const app = useMemo(
    () => new CadApplicationImpl(initialDocument, runtime),
    [initialDocument, runtime],
  );
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
  const {
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
    lineDraft,
    lineCommitting,
    handleSketchLinePointMove,
    handleSketchLinePoint,
    circleDraft,
    circleCommitting,
    handleSketchCirclePointMove,
    handleSketchCirclePoint,
    beginCreateSketch,
    commitCreateSketch,
    beginRectangle,
    commitRectangle,
    beginCircle,
    commitCircle,
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
        if (result.activeSketchId) {
          enterSketch(result.activeSketchId);
        } else {
          resetToWorkspace(result.workspace);
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

    return () => {
      active = false;
    };
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
    persistence,
    remoteHost: Boolean(props.projectHost),
    setNotice,
    onOpened: resetAfterOpen,
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
      open: openLocal,
      save: saveLocal,
      undo,
      redo,
      rebuild,
      createSketch: beginCreateSketch,
      line: beginLine,
      rectangle: beginRectangle,
      circle: beginCircle,
      finishSketch,
      extrude: beginExtrude,
      cutExtrude: beginCut,
      fillet: beginFillet,
      fit: () => requestView('Показать всё'),
      front: () => requestView('Спереди'),
      back: () => requestView('Сзади'),
      top: () => requestView('Сверху'),
      bottom: () => requestView('Снизу'),
      left: () => requestView('Слева'),
      right: () => requestView('Справа'),
      isometric: () => requestView('Изометрия'),
    },
    {
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      hasSketch: Boolean(sketch),
      canExtrude,
      canCutExtrude: canCut,
      canFillet,
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
      if (!sharedAction.enabled) {
        setNotice(sharedAction.disabledReason ?? 'Команда недоступна');
        return;
      }
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
      data-active-sketch-id={activeSketchId ?? ''}
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
          <CadUiActionSearchResults actions={searchableActions} onPicked={() => setSearch('')} />
        </div>
        <div className="global-actions">
          <CadUiGlobalActionButton action={uiAction('system.open')}>⌂</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={uiAction('system.save')} titleSuffix="(Ctrl+S)">▣</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={uiAction('system.undo')} titleSuffix="(Ctrl+Z)">↶</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={uiAction('system.redo')} titleSuffix="(Ctrl+Y / Ctrl+Shift+Z)">↷</CadUiGlobalActionButton>
          <button type="button" title="Настройки">⚙</button>
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
                <CadUiActionButton action={uiAction('sketch.line')} symbol="╱" large accent />
                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} />
                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton
                  label={rectangleReady ? `${rectangleWidth} × ${rectangleHeight} мм` : circleReady ? `Ø${circleDiameter} мм` : 'Размеры'}
                  symbol="↔"
                  disabled
                />
              </CommandGroup>
              <CommandGroup label="Эскиз" compact>
                <CadUiActionButton action={uiAction('sketch.finish')} symbol="✓" text />
              </CommandGroup>
            </>
          ) : document.kind === 'part' && activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CadUiActionButton action={uiAction('part.sketch.create')} symbol={commandSymbol('part.sketch.create')} large accent />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CadUiActionButton action={uiAction('part.extrude')} symbol={commandSymbol('part.extrude')} />
                <CadUiActionButton action={uiAction('part.cutExtrude')} symbol={commandSymbol('part.cutExtrude')} />
                <CadUiActionButton action={uiAction('part.fillet')} symbol={commandSymbol('part.fillet')} />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <CadUiActionButton action={uiAction('system.rebuild')} symbol="↻" text titleSuffix="(F5)" />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : document.kind === 'part' ? (
            <ViewCommandGroups viewName={viewName} getAction={uiAction} />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[document.kind]}</strong>
              <span>Документный маршрут уже существует. Инструменты включаются по roadmap без фиктивных кнопок.</span>
            </div>
          )}
        </div>
      </section>

      <main className={`content-area${activePanel === 'closed' ? ' panel-closed' : ''}`}>
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
          {activePanel === 'closed' ? null : activePanel === 'tree' ? (
            <DocumentTree
              document={document}
              selectedBodyId={selectedBodyId}
              activeSketchId={activeSketchId}
              onSelectBody={handleBodySelect}
              onEditSketch={enterSketch}
              onEditDimension={beginDimensionEdit}
            />
          ) : activePanel === 'parameters' ? (
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
          ) : (
            <MobileToolsPanel
              documentKind={document.kind}
              workspace={activeWorkspace}
              getAction={uiAction}
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
                lineDraft={lineDraft}
                lineCommitting={lineCommitting}
                onSketchLinePointMove={handleSketchLinePointMove}
                onSketchLinePoint={handleSketchLinePoint}
                circleDraft={circleDraft}
                circleCommitting={circleCommitting}
                onSketchCirclePointMove={handleSketchCirclePointMove}
                onSketchCirclePoint={handleSketchCirclePoint}
              />
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
        <button
          type="button"
          className={activePanel === 'tree' ? 'active' : ''}
          aria-pressed={activePanel === 'tree'}
          onClick={() => setActivePanel('tree')}
        >☷<span>Дерево</span></button>
        <button
          type="button"
          className={activePanel === 'parameters' ? 'active' : ''}
          aria-pressed={activePanel === 'parameters'}
          onClick={() => setActivePanel('parameters')}
        >≡<span>Параметры</span></button>
        <button
          type="button"
          className={activePanel === 'tools' ? 'active' : ''}
          aria-pressed={activePanel === 'tools'}
          onClick={() => setActivePanel('tools')}
        >⌘<span>Инструменты</span></button>
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

function ViewCommandGroups(props: { viewName: string; getAction: (id: string) => CadUiAction }) {
  const views = [
    { label: 'Спереди', id: 'view.front', shortcut: '1' },
    { label: 'Сзади', id: 'view.back' },
    { label: 'Сверху', id: 'view.top', shortcut: '2' },
    { label: 'Снизу', id: 'view.bottom' },
    { label: 'Слева', id: 'view.left', shortcut: '3' },
    { label: 'Справа', id: 'view.right' },
    { label: 'Изометрия', id: 'view.iso', shortcut: '0' },
  ];
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <CadUiActionButton
          key={view.id}
          action={props.getAction(view.id)}
          symbol="◇"
          className="view-command"
          selected={props.viewName === view.label}
          titleSuffix={view.shortcut ? `(${view.shortcut})` : undefined}
        />
      ))}
    </CommandGroup>
  );
}
