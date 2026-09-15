import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';
import { documentKindIcon, documentNames } from './CadDocumentPresentation';
import { CadShellCommandGroups } from './CadShellCommandGroups';

export type CadWorkspaceId = 'solid' | 'sketch' | 'surfaces' | 'diagnostics' | 'view';

export interface CadShellTopProps {
  documentKind: CadDocumentKind; documentTitle: string; dirty: boolean;
  activeWorkspace: CadWorkspaceId; setActiveWorkspace: (workspace: CadWorkspaceId) => void;
  search: string; setSearch: (value: string) => void; searchableActions: CadUiAction[];
  getAction: (id: string) => CadUiAction; openNewDocument: () => void;
  rectangleReady: boolean; rectangleWidth: number; rectangleHeight: number;
  circleReady: boolean; circleDiameter: number; viewName: string;
}

export function CadShellTop(props: CadShellTopProps) {
  return (
    <>
      <header className="main-menu-bar">
        <button className="brand-button" type="button" onClick={props.openNewDocument} aria-label="ASA-CAD">
          <span className="brand-mark">A</span><span>ASA-CAD</span>
        </button>
        <nav className="main-menu-items" aria-label="Главное меню">
          <button type="button">Файл</button><button type="button">Главная</button><button type="button">Сервис</button>
        </nav>
        <div className="command-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Поиск команд" aria-label="Поиск команд" />
          <CadUiActionSearchResults actions={props.searchableActions} onPicked={() => props.setSearch('')} />
        </div>
        <div className="global-actions">
          <CadUiGlobalActionButton action={props.getAction('system.open')}>⌂</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.save')} titleSuffix="(Ctrl+S)">▣</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.undo')} titleSuffix="(Ctrl+Z)">↶</CadUiGlobalActionButton>
          <CadUiGlobalActionButton action={props.getAction('system.redo')} titleSuffix="(Ctrl+Y / Ctrl+Shift+Z)">↷</CadUiGlobalActionButton>
          <button type="button" title="Настройки">⚙</button>
        </div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Документы">
        <button type="button" className="new-tab-button" onClick={props.openNewDocument} title="Новый документ">＋</button>
        <button className="document-tab active" type="button" role="tab" aria-selected="true">
          <span className="document-kind-icon">{documentKindIcon(props.documentKind)}</span>
          <span>{props.documentTitle}</span>
          {props.dirty && <span className="dirty-dot" title="Изменено">●</span>}
          <span className="tab-close" aria-hidden="true">×</span>
        </button>
      </div>

      <section className="instrument-area">
        <div className="workspace-tabs" role="tablist" aria-label="Инструментальные области">
          {props.documentKind === 'part' ? (
            <>
              <WorkspaceTab active={props.activeWorkspace === 'solid'} onClick={() => props.setActiveWorkspace('solid')}>Твердотельное моделирование</WorkspaceTab>
              {props.activeWorkspace === 'sketch' && <WorkspaceTab active>Эскиз</WorkspaceTab>}
              <WorkspaceTab active={props.activeWorkspace === 'surfaces'} onClick={() => props.setActiveWorkspace('surfaces')}>Каркас и поверхности</WorkspaceTab>
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

function WorkspaceTab(props: React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>) {
  return (
    <button className={props.active ? 'active' : ''} type="button" onClick={props.onClick} role="tab" aria-selected={props.active}>
      {props.children}
    </button>
  );
}
