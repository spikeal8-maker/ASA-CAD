import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';
import { documentNames } from './CadDocumentPresentation';
import { CadIcon, type CadIconName } from './CadIcon';
import { CadShellCommandGroups } from './CadShellCommandGroups';
import { CadFileMenu } from './CadFileMenu';
import { CadShellMenu } from './CadShellMenu';

export type CadWorkspaceId = 'solid' | 'sketch' | 'surfaces' | 'diagnostics' | 'view';

export interface CadShellTopProps {
  documentKind: CadDocumentKind; documentTitle: string; dirty: boolean;
  activeWorkspace: CadWorkspaceId; setActiveWorkspace: (workspace: CadWorkspaceId) => void;
  search: string; setSearch: (value: string) => void; searchableActions: CadUiAction[];
  getAction: (id: string) => CadUiAction;
  showRoadmapCommands: boolean;
  rectangleReady: boolean; rectangleWidth: number; rectangleHeight: number;
  circleReady: boolean; circleDiameter: number; viewName: string;
}

const EDIT_ACTIONS = ['system.undo', 'system.redo'] as const;
const VIEW_ACTIONS = ['view.fit', 'view.iso', 'view.front', 'view.top', 'view.left', 'view.right'] as const;
const SKETCH_ACTIONS = ['part.sketch.create', 'sketch.line', 'sketch.rectangle', 'sketch.circle', 'sketch.finish'] as const;
const SOLID_ACTIONS = ['system.rebuild', 'part.sketch.create', 'part.extrude', 'part.cutExtrude', 'part.fillet'] as const;

export function CadShellTop(props: CadShellTopProps) {
  const newAction = props.getAction('system.new');
  const hasSearch = props.search.trim().length > 0;
  return (
    <>
      <header className="main-menu-bar">
        <button
          className="brand-button"
          type="button"
          disabled={!newAction.enabled}
          onClick={() => { void newAction.execute(); }}
          data-command-id={newAction.id}
          aria-label="ASA-CAD"
          title="ASA-CAD · новый документ"
        >
          <span className="brand-mark">A</span><span className="brand-label">ASA-CAD</span>
        </button>
        <nav className="main-menu-items" aria-label="Главное меню">
          <CadFileMenu getAction={props.getAction} />
          <CadShellMenu menuKey="edit" label="Правка" actionIds={EDIT_ACTIONS} getAction={props.getAction} />
          <CadShellMenu menuKey="view" label="Вид" actionIds={VIEW_ACTIONS} getAction={props.getAction} />
          {props.documentKind === 'part' && (
            <>
              <CadShellMenu menuKey="sketch" label="Эскиз" actionIds={SKETCH_ACTIONS} getAction={props.getAction} />
              <CadShellMenu menuKey="solid" label="Моделирование" actionIds={SOLID_ACTIONS} getAction={props.getAction} />
            </>
          )}
        </nav>
        <div className="command-search-wrap" role="search">
          <CadIcon name="search" size={15} />
          <input
            value={props.search}
            onChange={(event) => props.setSearch(event.target.value)}
            placeholder="Найти команду"
            aria-label="Поиск команд"
            aria-expanded={hasSearch}
            aria-controls="cad-action-search-results"
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                props.setSearch('');
                event.currentTarget.blur();
              } else if (event.key === 'Enter' && hasSearch) {
                const first = props.searchableActions.find((action) => action.enabled);
                if (first) {
                  event.preventDefault();
                  props.setSearch('');
                  void first.execute();
                }
              } else if (event.key === 'ArrowDown' && hasSearch) {
                const first = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.command-search-results button:not(:disabled)');
                if (first) { event.preventDefault(); first.focus(); }
              }
            }}
          />
          {hasSearch && (
            <div id="cad-action-search-results" className="cad-search-popup">
              {props.searchableActions.length > 0
                ? <CadUiActionSearchResults actions={props.searchableActions} showRoadmapCommands={props.showRoadmapCommands} onPicked={() => props.setSearch('')} />
                : <div className="cad-search-empty">Команды не найдены</div>}
            </div>
          )}
        </div>
        <div className="global-actions" aria-label="Быстрые действия">
          <CadUiGlobalActionButton action={props.getAction('system.open')}><CadIcon name="open" /></CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.save')} titleSuffix="(Ctrl+S)"><CadIcon name="save" /></CadUiGlobalActionButton>
          <span className="global-actions-divider" aria-hidden="true" />
          <CadUiGlobalActionButton action={props.getAction('system.undo')} titleSuffix="(Ctrl+Z)"><CadIcon name="undo" /></CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.redo')} titleSuffix="(Ctrl+Y)"><CadIcon name="redo" /></CadUiGlobalActionButton>
          <button type="button" title="Настройки" aria-label="Настройки"><CadIcon name="settings" /></button>
        </div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Документы">
        <button
          type="button"
          className="new-tab-button"
          disabled={!newAction.enabled}
          onClick={() => { void newAction.execute(); }}
          data-command-id={newAction.id}
          title="Новый документ"
          aria-label="Новый документ"
        ><CadIcon name="new" size={15} /></button>
        <div className="document-tab active" role="tab" aria-selected="true" tabIndex={0} title={props.documentTitle}>
          <span className="document-kind-icon"><CadIcon name={documentIcon(props.documentKind)} size={15} /></span>
          <span className="document-title">{props.documentTitle}</span>
          {props.dirty && <span className="dirty-dot" title="Изменено" />}
          {props.dirty && <span className="dirty-indicator" title="Есть несохранённые изменения">Изменено</span>}
        </div>
        <span className="document-kind-caption">{documentNames[props.documentKind]}</span>
      </div>

      <section className="instrument-area" aria-label="Инструментальная область">
        <div className="workspace-tabs" role="tablist" aria-label="Инструментальные области">
          {props.documentKind === 'part' ? (
            <>
              <WorkspaceTab active={props.activeWorkspace === 'solid'} onClick={() => props.setActiveWorkspace('solid')}>Твердотельное моделирование</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'surfaces'} onClick={() => props.setActiveWorkspace('surfaces')}>Каркас и поверхности</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'sketch'} disabled={props.activeWorkspace !== 'sketch'} title="Войти через команду «Создать эскиз»">Инструменты эскиза</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'diagnostics'} onClick={() => props.setActiveWorkspace('diagnostics')}>Проверка / Измерения</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'view'} onClick={() => props.setActiveWorkspace('view')}>Вид</WorkspaceTab>
            </>
          ) : <WorkspaceTab active>{documentNames[props.documentKind]}</WorkspaceTab>}
        </div>
        <div className="command-ribbon" role="toolbar" aria-label="Команды активной инструментальной области">
          {props.documentKind === 'part' ? (
            <CadShellCommandGroups
              workspace={props.activeWorkspace} getAction={props.getAction} showRoadmapCommands={props.showRoadmapCommands}
              rectangleReady={props.rectangleReady} rectangleWidth={props.rectangleWidth} rectangleHeight={props.rectangleHeight}
              circleReady={props.circleReady} circleDiameter={props.circleDiameter} viewName={props.viewName}
            />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[props.documentKind]}</strong>
              <span>Команды документа пока недоступны; действия не имитируются.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function WorkspaceTab(props: React.PropsWithChildren<{ active?: boolean; disabled?: boolean; title?: string; onClick?: () => void }>) {
  return (
    <button
      className={props.active ? 'active' : ''}
      type="button"
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
      role="tab"
      aria-selected={props.active}
    >{props.children}</button>
  );
}

function documentIcon(kind: CadDocumentKind): CadIconName {
  switch (kind) {
    case 'part': return 'part';
    case 'assembly': return 'assembly';
    case 'drawing':
    case 'fragment': return 'drawing';
    case 'specification': return 'tree';
    case 'text': return 'text';
  }
}
