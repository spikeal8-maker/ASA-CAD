import React, { useEffect, useMemo, useState } from 'react';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import {
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDocument,
  type CadDocumentKind,
  type CadPartDocument,
} from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import { CadViewport } from './CadViewport';

interface RegistryCommand {
  id: string;
  labelRu: string;
  milestone: string;
  status: string;
}

const registry = commandRegistryJson as { commands: RegistryCommand[] };
const commandById = new Map(registry.commands.map((command) => [command.id, command]));

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

function commandLabel(id: string, fallback: string): string {
  return commandById.get(id)?.labelRu ?? fallback;
}

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

function partDocument(document: CadDocument): CadPartDocument | null {
  return document.kind === 'part' ? document : null;
}

function latestSketch(part: CadPartDocument | null) {
  return part?.sketches.at(-1) ?? null;
}

function hasRectangle(sketch: ReturnType<typeof latestSketch>): boolean {
  return Boolean(
    sketch?.entities.filter(
      (entity) => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'),
    ).length === 4,
  );
}

export function App() {
  const runtime = useMemo(() => new BrowserPartRuntimeAdapter(), []);
  const app = useMemo(
    () => new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Деталь 1' }), runtime),
    [runtime],
  );
  const [, setRevisionToken] = useState(0);
  const [activePanel, setActivePanel] = useState<'tree' | 'parameters'>('tree');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('solid');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [sketchPlane, setSketchPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
  const [rectangleWidth, setRectangleWidth] = useState(60);
  const [rectangleHeight, setRectangleHeight] = useState(40);
  const [extrudeDistance, setExtrudeDistance] = useState(10);
  const [notice, setNotice] = useState('Готово');
  const [viewName, setViewName] = useState('Изометрия');
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
  const canExtrude = Boolean(sketch && rectangleReady && part?.bodies.length === 0);
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();

  const searchableCommands = search.trim()
    ? registry.commands
        .filter((command) => command.labelRu.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))
        .slice(0, 8)
    : [];

  async function createDocument(kind: CadDocumentKind) {
    await app.replaceDocument(createEmptyCadDocument(kind, { title: `${documentNames[kind]} 1` }));
    setNewDialogOpen(false);
    setActivePanel('tree');
    setActiveCommand(null);
    setActiveWorkspace(kind === 'part' ? 'solid' : kind);
    setNotice(`Создан документ «${documentNames[kind]}»`);
  }

  async function saveLocal() {
    localStorage.setItem('asa-cad-m2-shell-document', serializeCadDocument(app.getDocument()));
    setNotice('Сохранено локально');
  }

  async function openLocal() {
    const saved = localStorage.getItem('asa-cad-m2-shell-document');
    if (!saved) {
      setNotice('Нет локально сохраненного документа');
      return;
    }
    try {
      setNotice('Открытие документа…');
      await app.replaceDocument(parseCadDocument(saved));
      setActivePanel('tree');
      setActiveCommand(null);
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
    setActiveWorkspace('sketch');
    setNotice('Выберите плоскость и создайте эскиз');
  }

  async function commitCreateSketch() {
    const result = await app.execute({ id: 'sketch.create', payload: { support: sketchPlane } });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    setActiveCommand(null);
    setActivePanel('tree');
    setActiveWorkspace('sketch');
    setNotice(`Создан эскиз на плоскости ${sketchPlane}`);
  }

  function beginRectangle() {
    if (!sketch) return;
    setActiveCommand('sketch.rectangle');
    setActivePanel('parameters');
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
    setNotice('Эскиз завершен');
  }

  function beginExtrude() {
    if (!canExtrude || !sketch) return;
    setActiveCommand('part.extrude');
    setActivePanel('parameters');
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
    setNotice(`Выдавливание ${extrudeDistance} мм построено локально`);
  }

  function cancelCommand() {
    const stayInSketch = activeCommand === 'sketch.rectangle';
    setActiveCommand(null);
    setActivePanel('tree');
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
    if (activeCommand === 'part.extrude') return commitExtrude();
  }

  async function undo() {
    const result = await app.undo();
    setNotice(result.changed ? 'Отменено' : 'Нечего отменять');
  }

  async function redo() {
    const result = await app.redo();
    setNotice(result.changed ? 'Повторено' : 'Нечего повторять');
  }

  async function rebuild() {
    setNotice('Перестроение…');
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');
  }

  return (
    <div className="cad-app" data-document-kind={document.kind} data-runtime-status={runtimeState.status}>
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
          <button type="button" title="Сохранить" onClick={saveLocal}>▣</button>
          <button type="button" title="Отменить" onClick={undo} disabled={!state.canUndo}>↶</button>
          <button type="button" title="Повторить" onClick={redo} disabled={!state.canRedo}>↷</button>
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
                <CommandButton id="sketch.rectangle" large active disabled={!sketch} reason="Сначала создайте эскиз" onClick={beginRectangle} />
                <CommandButton id="sketch.circle" disabled reason="Окружность включается в следующем cut-срезе" />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton label={rectangleReady ? `${rectangleWidth} × ${rectangleHeight} мм` : 'Размеры'} symbol="↔" disabled />
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
                <CommandButton id="part.cutExtrude" disabled reason="Подключается после stable-face sketch" />
                <CommandButton id="part.fillet" disabled reason="Подключается после stable-edge picking" />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <RibbonTextButton label="Перестроить" symbol="↻" onClick={rebuild} />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : document.kind === 'part' ? (
            <ViewCommandGroups viewName={viewName} setViewName={setViewName} />
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
            <DocumentTree document={document} />
          ) : (
            <ParameterPanel
              activeCommand={activeCommand}
              sketchPlane={sketchPlane}
              setSketchPlane={setSketchPlane}
              rectangleWidth={rectangleWidth}
              rectangleHeight={rectangleHeight}
              setRectangleWidth={setRectangleWidth}
              setRectangleHeight={setRectangleHeight}
              extrudeDistance={extrudeDistance}
              setExtrudeDistance={setExtrudeDistance}
              onCreateSketch={commitCreateSketch}
              onCreateRectangle={commitRectangle}
              onExtrude={commitExtrude}
              onCancel={cancelCommand}
            />
          )}
        </aside>

        <section className="work-area" aria-label="Рабочая область">
          <div className="viewport-quick-access" aria-label="Быстрый доступ рабочей области">
            <button type="button" title="Показать всё" onClick={() => setViewName('Показать всё')}>⌗</button>
            <button type="button" title="Изометрия" onClick={() => setViewName('Изометрия')}>◇</button>
            <span className="quick-separator" />
            <span className="view-caption">{viewName}</span>
            {activeCommand && (
              <>
                <span className="quick-separator" />
                <button className="quick-accept" type="button" onClick={commitActiveCommand} title="Применить">✓</button>
                <button className="quick-cancel" type="button" onClick={cancelCommand} title="Отмена">×</button>
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
                  <CadViewport model={renderModel} />
                ) : (
                  <div className="stage-message">
                    <div className="stage-symbol">◇</div>
                    <strong>{part && part.sketches.length > 0 ? `${part.sketches.length} эскиз(а)` : 'Новая деталь'}</strong>
                    <span>{runtimeState.status === 'loading' ? 'Загрузка OpenCascade…' : 'ASA-CAD'}</span>
                    <small>
                      {rectangleReady
                        ? 'Эскиз параметрический. Завершите его и выполните выдавливание — B-Rep будет построен локально в браузере.'
                        : 'Создайте эскиз и прямоугольник. OpenCascade не загружается до первой твердотельной операции.'}
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

function RibbonTextButton(props: { label: string; symbol: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button className="ribbon-command text-command" type="button" disabled={props.disabled} onClick={props.onClick}>
      <span className="ribbon-command-icon">{props.symbol}</span>
      <span>{props.label}</span>
    </button>
  );
}

function commandSymbol(id: string): string {
  if (id.includes('sketch')) return '▱';
  if (id.includes('cut')) return '▣';
  if (id.includes('extrude')) return '▤';
  if (id.includes('fillet')) return '◜';
  return '◇';
}

function ViewCommandGroups(props: { viewName: string; setViewName: (value: string) => void }) {
  const views = ['Спереди', 'Сверху', 'Слева', 'Справа', 'Изометрия'];
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <button
          className={`ribbon-command view-command ${props.viewName === view ? 'selected' : ''}`}
          type="button"
          key={view}
          onClick={() => props.setViewName(view)}
        >
          <span className="ribbon-command-icon">◇</span>
          <span>{view}</span>
        </button>
      ))}
    </CommandGroup>
  );
}

function DocumentTree({ document }: { document: CadDocument }) {
  return (
    <div className="tree-panel">
      <div className="panel-title-row">
        <strong>Дерево</strong>
        <button type="button" title="Параметры дерева">⋯</button>
      </div>
      <div className="tree-search"><span>⌕</span><input placeholder="Найти в дереве" /></div>
      <div className="tree-root">
        <TreeRow depth={0} icon={kindIcon(document.kind)} label={document.title} bold />
        {document.kind === 'part' && (
          <>
            <TreeRow depth={1} icon="⌖" label="Начало координат" />
            <TreeRow depth={2} icon="▱" label="Плоскость XY" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость XZ" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость YZ" muted />
            {document.sketches.map((item) => (
              <TreeRow key={item.id} depth={1} icon="⌗" label={item.name} />
            ))}
            {document.features.map((feature) => (
              <TreeRow key={feature.id} depth={1} icon="◇" label={feature.name} />
            ))}
            {document.bodies.map((body) => (
              <TreeRow key={body.id} depth={1} icon="⬡" label={body.name} />
            ))}
          </>
        )}
        {document.kind === 'assembly' && <TreeRow depth={1} icon="＋" label="Компоненты появятся в M4A" muted />}
        {document.kind === 'drawing' && <TreeRow depth={1} icon="▱" label="Листы появятся в M6" muted />}
        {document.kind === 'fragment' && <TreeRow depth={1} icon="⌗" label="Геометрия появится в M6" muted />}
        {document.kind === 'specification' && <TreeRow depth={1} icon="≣" label="Разделы появятся в M6A" muted />}
        {document.kind === 'text' && <TreeRow depth={1} icon="¶" label="Структура появится в M6A" muted />}
      </div>
    </div>
  );
}

function TreeRow(props: { depth: number; icon: string; label: string; muted?: boolean; bold?: boolean }) {
  return (
    <button
      className={`tree-row ${props.muted ? 'muted' : ''} ${props.bold ? 'bold' : ''}`}
      type="button"
      style={{ paddingInlineStart: 10 + props.depth * 18 }}
    >
      <span className="tree-chevron">{props.depth < 2 ? '›' : ''}</span>
      <span className="tree-icon">{props.icon}</span>
      <span className="tree-label">{props.label}</span>
    </button>
  );
}

function ParameterPanel(props: {
  activeCommand: string | null;
  sketchPlane: 'XY' | 'XZ' | 'YZ';
  setSketchPlane: (plane: 'XY' | 'XZ' | 'YZ') => void;
  rectangleWidth: number;
  rectangleHeight: number;
  setRectangleWidth: (value: number) => void;
  setRectangleHeight: (value: number) => void;
  extrudeDistance: number;
  setExtrudeDistance: (value: number) => void;
  onCreateSketch: () => void;
  onCreateRectangle: () => void;
  onExtrude: () => void;
  onCancel: () => void;
}) {
  if (props.activeCommand === 'part.sketch.create') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Эскиз</small>
            <strong>{commandLabel('part.sketch.create', 'Создать эскиз')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Плоскость построения</h3>
          <p>Выберите базовую плоскость. Выбор грани будет подключен через stable reference.</p>
          <div className="plane-grid">
            {(['XY', 'XZ', 'YZ'] as const).map((plane) => (
              <button
                type="button"
                key={plane}
                className={props.sketchPlane === plane ? 'selected' : ''}
                onClick={() => props.setSketchPlane(plane)}
              >
                <span>▱</span>
                <strong>{plane}</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="parameter-section collapsed-preview">
          <h3>Ориентация</h3>
          <div className="property-row"><span>Нормаль</span><strong>Автоматически</strong></div>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCreateSketch}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'sketch.rectangle') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Эскиз</small>
            <strong>{commandLabel('sketch.rectangle', 'Прямоугольник')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Размеры</h3>
          <NumericField label="Ширина" value={props.rectangleWidth} onChange={props.setRectangleWidth} suffix="мм" />
          <NumericField label="Высота" value={props.rectangleHeight} onChange={props.setRectangleHeight} suffix="мм" />
          <p>Прямоугольник создается относительно начала координат и получает два управляющих размера.</p>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCreateRectangle}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'part.extrude') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Элемент тела</small>
            <strong>{commandLabel('part.extrude', 'Элемент выдавливания')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Параметры</h3>
          <NumericField label="Расстояние" value={props.extrudeDistance} onChange={props.setExtrudeDistance} suffix="мм" />
          <p>При применении впервые загружается OpenCascade WASM и строится точный B-Rep на этом устройстве.</p>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onExtrude}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div className="parameter-panel empty-parameters">
      <div className="panel-title-row"><strong>Параметры</strong></div>
      <div className="empty-panel-message">
        <span>≡</span>
        <strong>Нет активной команды</strong>
        <p>При запуске операции эта панель автоматически показывает её параметры.</p>
      </div>
    </div>
  );
}

function NumericField(props: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="numeric-field">
      <span>{props.label}</span>
      <span className="numeric-control">
        <input
          type="number"
          min="0.01"
          step="1"
          value={Number.isFinite(props.value) ? props.value : 0}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <small>{props.suffix}</small>
      </span>
    </label>
  );
}
