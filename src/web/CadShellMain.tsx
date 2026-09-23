import React from 'react';
import { CadIcon } from './CadIcon';

export type CadShellPanel = 'tree' | 'parameters' | 'tools' | 'closed';

export interface CadShellMainProps {
  activePanel: CadShellPanel;
  setActivePanel: (panel: CadShellPanel) => void;
  requestView: (label: string) => void;
  viewName: string;
  selectionMode: 'none' | 'face' | 'edge';
  selectedBodyName?: string;
  selectedSketchEntityId?: string | null;
  activeCommand?: string | null;
  commitActiveCommand: () => void | Promise<void>;
  cancelCommand: () => void;
  treeContent: React.ReactNode;
  parametersContent: React.ReactNode;
  toolsContent: React.ReactNode;
  modelContent: React.ReactNode;
}

export function CadShellMain(props: CadShellMainProps) {
  return (
    <main className={`content-area${props.activePanel === 'closed' ? ' panel-closed' : ''}`}>
      <aside className="management-rail" aria-label="Панели">
        <button
          type="button"
          className={props.activePanel === 'tree' ? 'active' : ''}
          onClick={() => props.setActivePanel('tree')}
          title="Дерево"
        >
          <CadIcon name="tree" size={16} />
          <span>Дерево</span>
        </button>
        <button
          type="button"
          className={props.activePanel === 'parameters' ? 'active' : ''}
          onClick={() => props.setActivePanel('parameters')}
          title="Параметры"
        >
          <CadIcon name="parameters" size={16} />
          <span>Параметры</span>
        </button>
        <button type="button" disabled title="Переменные — M7">
          <CadIcon name="variables" size={16} />
          <span>Переменные</span>
        </button>
        <button type="button" disabled title="Библиотеки — roadmap">
          <CadIcon name="library" size={16} />
          <span>Библиотеки</span>
        </button>
      </aside>

      <aside className="management-panel">
        {props.activePanel === 'closed' ? null : props.activePanel === 'tree'
          ? props.treeContent
          : props.activePanel === 'parameters'
            ? props.parametersContent
            : props.toolsContent}
      </aside>

      <section className="work-area" aria-label="Рабочая область">
        <div className="viewport-quick-access" aria-label="Быстрый доступ рабочей области">
          <button type="button" title="Показать всё (F)" onClick={() => props.requestView('Показать всё')}><CadIcon name="fit" size={16} /></button>
          <button type="button" title="Изометрия (0)" onClick={() => props.requestView('Изометрия')}><CadIcon name="view" size={16} /></button>
          <span className="quick-separator" />
          <span className="view-caption">{props.viewName}</span>
          {props.selectionMode !== 'none' && (
            <span className="selection-caption">{props.selectionMode === 'face' ? 'Выбор грани' : 'Выбор ребра'}</span>
          )}
          {props.selectedBodyName && props.selectionMode === 'none' && (
            <span className="selection-caption">Выбрано: {props.selectedBodyName}</span>
          )}
          {props.selectedSketchEntityId && !props.activeCommand && (
            <span className="selection-caption">Элемент эскиза выбран</span>
          )}
          {props.activeCommand && (
            <>
              <span className="quick-separator" />
              <button className="quick-accept" type="button" onClick={props.commitActiveCommand} title="Применить (Ctrl+Enter)"><CadIcon name="accept" size={16} /></button>
              <button className="quick-cancel" type="button" onClick={props.cancelCommand} title="Отмена (Esc)"><CadIcon name="cancel" size={16} /></button>
            </>
          )}
        </div>

        <div className="model-stage">{props.modelContent}</div>
      </section>
    </main>
  );
}
