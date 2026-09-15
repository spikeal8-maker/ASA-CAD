import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionButton, CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';
import { documentKindIcon, documentNames } from './CadDocumentPresentation';

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
            value={props.search}
            onChange={(event) => props.setSearch(event.target.value)}
            placeholder="Поиск команд"
            aria-label="Поиск команд"
          />
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
          ) : (
            <WorkspaceTab active>{documentNames[props.documentKind]}</WorkspaceTab>
          )}
        </div>

        <div className="command-ribbon">
          {props.documentKind === 'part' && props.activeWorkspace === 'sketch' ? (
            <>
              <CommandGroup label="Геометрия">
                <CadUiActionButton action={props.getAction('sketch.line')} symbol="╱" large accent />
                <CadUiActionButton action={props.getAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} />
                <CadUiActionButton action={props.getAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />
                <CadUiActionButton action={props.getAction('sketch.arc')} symbol="⌒" />
              </CommandGroup>
              <CommandGroup label="Ограничения">
                <CadUiActionButton action={props.getAction('constraint.horizontal')} symbol="—" text />
                <CadUiActionButton action={props.getAction('constraint.vertical')} symbol="|" text />
                <CadUiActionButton action={props.getAction('constraint.fixed')} symbol="⌾" text />
                <CadUiActionButton action={props.getAction('constraint.coincident')} symbol="●" text />
                <CadUiActionButton action={props.getAction('constraint.parallel')} symbol="∥" text />
                <CadUiActionButton action={props.getAction('constraint.perpendicular')} symbol="⊥" text />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton
                  label={props.rectangleReady ? `${props.rectangleWidth} × ${props.rectangleHeight} мм` : props.circleReady ? `Ø${props.circleDiameter} мм` : 'Размеры'}
                  symbol="↔"
                  disabled
                />
              </CommandGroup>
              <CommandGroup label="Эскиз" compact>
                <CadUiActionButton action={props.getAction('sketch.finish')} symbol="✓" text />
              </CommandGroup>
            </>
          ) : props.documentKind === 'part' && props.activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CadUiActionButton action={props.getAction('part.sketch.create')} symbol={commandSymbol('part.sketch.create')} large accent />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CadUiActionButton action={props.getAction('part.extrude')} symbol={commandSymbol('part.extrude')} />
                <CadUiActionButton action={props.getAction('part.cutExtrude')} symbol={commandSymbol('part.cutExtrude')} />
                <CadUiActionButton action={props.getAction('part.fillet')} symbol={commandSymbol('part.fillet')} />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <CadUiActionButton action={props.getAction('system.rebuild')} symbol="↻" text titleSuffix="(F5)" />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : props.documentKind === 'part' ? (
            <ViewCommandGroups viewName={props.viewName} getAction={props.getAction} />
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
