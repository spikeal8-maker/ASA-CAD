import React, { useEffect, useMemo, useState } from 'react';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import type { CadRuntimeAdapter, CadRuntimeRecomputeResult, CadRuntimeReferenceCaptureResult } from '../contracts/runtime';
import {
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDocument,
  type CadDocumentKind,
  type CadPartDocument,
} from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

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

class ShellRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm2-shell-preview' };
  }

  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('Geometry picking is connected in the next M2 runtime slice');
  }

  dispose(): void {}
}

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

export function App() {
  const app = useMemo(
    () => new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Деталь 1' }), new ShellRuntime()),
    [],
  );
  const [, setRevisionToken] = useState(0);
  const [activePanel, setActivePanel] = useState<'tree' | 'parameters'>('tree');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('solid');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [sketchPlane, setSketchPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
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
      await app.replaceDocument(parseCadDocument(saved));
      setActivePanel('tree');
      setActiveCommand(null);
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
    setNotice(`Создан эскиз на плоскости ${sketchPlane}`);
  }

  function cancelCommand() {
    setActiveCommand(null);
    setActivePanel('tree');
    setActiveWorkspace(document.kind === 'part' ? 'solid' : document.kind);
    setNotice('Команда отменена');
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
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');
  }

  return (
    <div className="cad-app" data-document-kind={document.kind}>
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
          {document.kind === 'part' && activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CommandButton id="part.sketch.create" large active onClick={beginCreateSketch} />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CommandButton id="part.extrude" disabled reason="Подключение B-Rep к ASA shell — следующий срез" />
                <CommandButton id="part.cutExtrude" disabled reason="Подключение B-Rep к ASA shell — следующий срез" />
                <CommandButton id="part.fillet" disabled reason="Подключение B-Rep к ASA shell — следующий срез" />
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
              onCreateSketch={commitCreateSketch}
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
                <button className="quick-accept" type="button" onClick={commitCreateSketch} title="Создать">✓</button>
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
                <div className="stage-message">
                  <div className="stage-symbol">◇</div>
                  <strong>{part && part.sketches.length > 0 ? `${part.sketches.length} эскиз(а)` : 'Новая деталь'}</strong>
                  <span>ASA-owned M2 shell</span>
                  <small>Реальный OpenCascade runtime уже проходит M1 CI; Three.js viewport подключается к этой рабочей области следующим вертикальным срезом.</small>
                </div>
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
            {document.sketches.map((sketch) => (
              <TreeRow key={sketch.id} depth={1} icon="⌗" label={sketch.name} />
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
  onCreateSketch: () => void;
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
