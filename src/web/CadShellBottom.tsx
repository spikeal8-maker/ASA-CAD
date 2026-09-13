import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import { documentNames } from './CadDocumentPresentation';
import type { CadShellPanel } from './CadShellMain';

export interface CadShellBottomProps {
  recomputeStatus: string;
  notice: string;
  devFixture?: string | null;
  selectedPickKind?: 'face' | 'edge';
  selectedPointText?: string;
  selectedBodyName?: string;
  selectedSketchEntityId?: string | null;
  documentKind: CadDocumentKind;
  runtimeStatus: string;
  activePanel: CadShellPanel;
  setActivePanel: (panel: CadShellPanel) => void;
}

export function CadShellBottom(props: CadShellBottomProps) {
  return (
    <>
      <footer className="status-bar">
        <div className="status-left">
          <span className={`status-indicator ${props.recomputeStatus}`} />
          <span>{props.notice}</span>
        </div>
        <div className="status-right">
          {props.devFixture && <span>fixture:{props.devFixture}</span>}
          {props.selectedPickKind && (
            <span>{props.selectedPickKind === 'face' ? 'Грань' : 'Ребро'}: {props.selectedPointText}</span>
          )}
          {props.selectedBodyName && <span>Выбрано: {props.selectedBodyName}</span>}
          {props.selectedSketchEntityId && <span>Sketch entity: {props.selectedSketchEntityId}</span>}
          <span>{documentNames[props.documentKind]}</span>
          <span>{props.runtimeStatus === 'ready' ? 'OCC локально' : 'ядро по требованию'}</span>
          <span>мм</span>
          <span>UI 100%</span>
          <span>M2</span>
        </div>
      </footer>

      <div className="mobile-bottom-bar" aria-label="Мобильные панели">
        <button
          type="button"
          className={props.activePanel === 'tree' ? 'active' : ''}
          aria-pressed={props.activePanel === 'tree'}
          onClick={() => props.setActivePanel('tree')}
        >☷<span>Дерево</span></button>
        <button
          type="button"
          className={props.activePanel === 'parameters' ? 'active' : ''}
          aria-pressed={props.activePanel === 'parameters'}
          onClick={() => props.setActivePanel('parameters')}
        >≡<span>Параметры</span></button>
        <button
          type="button"
          className={props.activePanel === 'tools' ? 'active' : ''}
          aria-pressed={props.activePanel === 'tools'}
          onClick={() => props.setActivePanel('tools')}
        >⌘<span>Инструменты</span></button>
      </div>
    </>
  );
}
