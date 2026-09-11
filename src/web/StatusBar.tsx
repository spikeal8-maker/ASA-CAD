import React from 'react';
import type { CadApplicationState } from '../contracts/application';
import type { CadViewportPick } from '../contracts/render';
import type { CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import { SketchSolveStatus } from './SketchSolveStatus';

export interface StatusBarProps {
  recomputeStatus: CadApplicationState['recompute']['status'];
  notice: string;
  fixture?: string | null;
  selectedPick: CadViewportPick | null;
  selectedPointText: string;
  selectedBodyName?: string | null;
  documentName: string;
  runtimeReady: boolean;
  sketchSolveActive: boolean;
  solveSnapshot: Readonly<CadSketchSolveSnapshot>;
}

export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className={`status-indicator ${props.recomputeStatus}`} />
        <span>{props.notice}</span>
      </div>
      <div className="status-right">
        {props.fixture && <span>fixture:{props.fixture}</span>}
        {props.selectedPick && (
          <span>{props.selectedPick.kind === 'face' ? 'Грань' : 'Ребро'}: {props.selectedPointText}</span>
        )}
        {props.selectedBodyName && <span>Выбрано: {props.selectedBodyName}</span>}
        <SketchSolveStatus active={props.sketchSolveActive} snapshot={props.solveSnapshot} />
        <span>{props.documentName}</span>
        <span>{props.runtimeReady ? 'OCC локально' : 'ядро по требованию'}</span>
        <span>мм</span>
        <span>UI 100%</span>
        <span>M3</span>
      </div>
    </footer>
  );
}
