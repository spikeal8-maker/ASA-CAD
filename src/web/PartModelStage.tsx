import React from 'react';
import type { CadPartDocument, CadPoint2, CadSketch } from '../contracts/document';
import type { CadBodyId } from '../contracts/ids';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import {
  CadViewport,
  type CadViewportViewCommand,
} from './CadViewport';
import { SketchSolveStatus } from './SketchSolveStatus';
import { useActiveSketchSolveOverlay } from './useActiveSketchSolveOverlay';
import { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';

export interface PartModelStageProps {
  document: Readonly<CadPartDocument>;
  activeSketch: Readonly<CadSketch> | null;
  activeWorkspace: string;
  revisionToken: number;
  renderModel: CadRenderModel | null;
  runtimeStatus: string;
  fixtureError?: string;
  rectangleReady: boolean;
  selectionMode: 'none' | 'face' | 'edge' | 'sketch';
  onPick(pick: CadViewportPick): void;
  viewCommand: CadViewportViewCommand;
  selectedBodyId: CadBodyId | null;
  onBodySelect(bodyId: CadBodyId | null): void;
  lineToolActive: boolean;
  onCommitLine(from: CadPoint2, to: CadPoint2): Promise<boolean> | boolean;
}

/** Focused owner for Part/Sketch work-area presentation and transient tools. */
export function PartModelStage(props: PartModelStageProps) {
  const sketchEditing = props.activeWorkspace === 'sketch' && Boolean(props.activeSketch);
  const sketchSolve = useActiveSketchSolveOverlay({
    document: props.document,
    sketch: props.activeSketch,
    active: sketchEditing,
    revisionToken: props.revisionToken,
  });
  const sketchOverlay = sketchSolve.overlay;
  const viewportModel = sketchEditing ? null : props.renderModel;
  const showViewport = Boolean(viewportModel || sketchOverlay);

  return (
    <div
      className="part-model-stage"
      data-testid="part-model-stage"
      data-sketch-context={sketchEditing ? 'isolated-2d' : 'model'}
    >
      <div className="origin-widget" aria-label="Ориентация">
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
      </div>
      <div className="stage-grid" />

      {showViewport ? (
        <CadViewport
          model={viewportModel}
          sketchOverlay={sketchOverlay}
          selectionMode={props.selectionMode}
          onPick={props.onPick}
          viewCommand={props.viewCommand}
          selectedBodyId={props.selectedBodyId}
          onBodySelect={props.onBodySelect}
        />
      ) : (
        <div className="stage-message">
          <div className="stage-symbol">{props.fixtureError ? '!' : '◇'}</div>
          <strong>
            {props.fixtureError
              ? 'Ошибка перестроения'
              : props.document.sketches.length > 0 ? `${props.document.sketches.length} эскиз(а)` : 'Новая деталь'}
          </strong>
          <span>{props.runtimeStatus === 'loading' ? 'Загрузка OpenCascade…' : props.fixtureError ? 'B-Rep не построен' : 'ASA-CAD'}</span>
          <small>
            {props.fixtureError
              ? props.fixtureError
              : props.rectangleReady
                ? 'Эскиз параметрический. Завершите его и выполните выдавливание — B-Rep будет построен локально в браузере.'
                : 'Создайте эскиз и геометрию. OpenCascade не загружается до первой твердотельной операции.'}
          </small>
        </div>
      )}

      {sketchEditing && (
        <SketchLineInteractionLayer
          active={props.lineToolActive}
          onCommit={props.onCommitLine}
        />
      )}

      {sketchEditing && (
        <div
          className="sketch-solve-hud"
          data-testid="sketch-solve-hud"
          data-overlay-source={sketchOverlay?.source ?? 'document'}
        >
          <SketchSolveStatus snapshot={sketchSolve.snapshot} />
        </div>
      )}
    </div>
  );
}
