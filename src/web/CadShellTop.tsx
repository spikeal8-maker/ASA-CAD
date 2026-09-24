import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';
import { documentNames } from './CadDocumentPresentation';
import { CadIcon, type CadIconName } from './CadIcon';
import { CadShellCommandGroups } from './CadShellCommandGroups';
import { CadFileMenu } from './CadFileMenu';

export type CadWorkspaceId = 'solid' | 'sketch' | 'surfaces' | 'diagnostics' | 'view';

export interface CadShellTopProps {
  documentKind: CadDocumentKind; documentTitle: string; dirty: boolean;
  activeWorkspace: CadWorkspaceId; setActiveWorkspace: (workspace: CadWorkspaceId) => void;
  search: string; setSearch: (value: string) => void; searchableActions: CadUiAction[];
  getAction: (id: string) => CadUiAction;
  rectangleReady: boolean; rectangleWidth: number; rectangleHeight: number;
  circleReady: boolean; circleDiameter: number; viewName: string;
}

export function CadShellTop(props: CadShellTopProps) {
  const newAction = props.getAction('system.new');
  return (
    <>
      <header className="main-menu-bar">
        <button className="brand-button" type="button" disabled={!newAction.enabled} onClick={() => { void newAction.execute(); }} data-command-id={newAction.id} aria-label="ASA-CAD">
          <span className="brand-mark">A</span><span className="brand-label">ASA-CAD</span>
        </button>
        <nav className="main-menu-items" aria-label="Главное меню">
          <CadFileMenu getAction={props.getAction} />
          <button type="button">Правка</button>
          <button type="button">Выделить</button>
          <button type="button">Вид</button>
          <button type="button">Эскиз</button>
          <button type="button">Моделирование</button>
          <button type="button">Оформление</button>
          <button type="button">Диагностика</button>
          <button type="button">Управление</button>
          <button type="button">Настройка</button>
          <button type="button">Приложения</button>
          <button type="button">Окно</button>
          <button type="button">Справка</button>
        </nav>
        <div className="command-search-wrap">
          <CadIcon name="search" size={15} />
          <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Поиск команд" aria-label="Поиск команд" />
          <CadUiActionSearchResults actions={props.searchableActions} onPicked={() => props.setSearch('')} />
        </div>
        <div className="global-actions">
          <CadUiGlobalActionButton action={props.getAction('system.open')}><CadIcon name="open" /></CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.save')} titleSuffix="(Ctrl+S)"><CadIcon name="save" /></CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.undo')} titleSuffix="(Ctrl+Z)"><CadIcon name="undo" /></CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.redo')} titleSuffix="(Ctrl+Y / Ctrl+Shift+Z)"><CadIcon name="redo" /></CadUiGlobalActionButton>
          <button type="button" title="Настройки"><CadIcon name="settings" /></button>
        </div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Документы">
        <button type="button" className="new-tab-button" disabled={!newAction.enabled} onClick={() => { void newAction.execute(); }} data-command-id={newAction.id} title="Новый документ" aria-label="Новый документ"><CadIcon name="new" size={15} /></button>
        <button className="document-tab active" type="button" role="tab" aria-selected="true">
          <span className="document-kind-icon"><CadIcon name={documentIcon(props.documentKind)} size={15} /></span>
          <span>{props.documentTitle}</span>
          {props.dirty && <span className="dirty-dot" title="Изменено" />}
          <span className="tab-close" aria-hidden="true"><CadIcon name="close" size={12} /></span>
        </button>
      </div>

      <section className="instrument-area">
        <div className="workspace-tabs" role="tablist" aria-label="Инструментальные области">
          {props.documentKind === 'part' ? (
            <>
              <WorkspaceTab active={props.activeWorkspace === 'solid'} onClick={() => props.setActiveWorkspace('solid')}>Твердотельное моделирование</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'surfaces'} onClick={() => props.setActiveWorkspace('surfaces')}>Каркас и поверхности</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'sketch'} disabled={props.activeWorkspace !== 'sketch'}>Эскиз</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'diagnostics'} onClick={() => props.setActiveWorkspace('diagnostics')}>Проверка / Измерения</WorkspaceTab>
              <WorkspaceTab active={props.activeWorkspace === 'view'} onClick={() => props.setActiveWorkspace('view')}>Вид</WorkspaceTab>
            </>
          ) : <WorkspaceTab active>{documentNames[props.documentKind]}</WorkspaceTab>}
        </div>

        <div className="command-ribbon">
          {props.documentKind === 'part' ? (
            <CadShellCommandGroups
              workspace={props.activeWorkspace} getAction={props.getAction}
              rectangleReady={props.rectangleReady} rectangleWidth={props.rectangleWidth} rectangleHeight={props.rectangleHeight}
              circleReady={props.circleReady} circleDiameter={props.circleDiameter} viewName={props.viewName}
            />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[props.documentKind]}</strong>
              <span>Документный маршрут уже существует. Инструменты включаются по roadmap без фиктивных кнопок.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function WorkspaceTab(props: React.PropsWithChildren<{ active?: boolean; disabled?: boolean; onClick?: () => void }>) {
  return (
    <button className={props.active ? 'active' : ''} type="button" disabled={props.disabled} onClick={props.onClick} role="tab" aria-selected={props.active}>
      {props.children}
    </button>
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
