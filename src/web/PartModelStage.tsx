import React from 'react';
import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadBodyId } from '../contracts/ids';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import {
  CadViewport,
  type CadViewportViewCommand,
} from './CadViewport';
import { SketchSolveStatus } from './SketchSolveStatus';
import { useActiveSketchSolveOverlay } from './useActiveSketchSolveOverlay';

export interface PartModelStageProps {
  document: Readonly<CadPartDocument>;
  activeSketch: Readonly<CadSketch> | null;
  activeWorkspace: string;
  revisionToken: number;
  renderModel: CadRenderModel | null;
  runtimeStatus: string;
  fixtureError?: string;
  rectangleReady: boolean;
  selectionMode: 'none' | 'face' | 'edge';
  onPick(pick: CadViewportPick): void;
  viewCommand: CadViewportViewCommand;
  selectedBodyId: CadBodyId | null;
  onBodySelect(bodyId: CadBodyId | null): void;
}

/**
 * Focused owner for the Part work-area presentation.
 *
 * B-Rep rendering stays in CadViewport/Three. Sketch solving and SVG preview
 * remain a separate transient layer and are active only while editing Sketch.
 */
export function PartModelStage(props: PartModelStageProps) {
  const sketchEditing = props.activeWorkspace === 'sketch' && Boolean(props.activeSketch);
  const sketchSolve = useActiveSketchSolveOverlay({
    document: props.document,
    sketch: props.activeSketch,
    active: sketchEditing,
    revisionToken: props.revisionToken,
  });
  const sketchOverlay = sketchSolve.overlay;
  const showViewport = Boolean(props.renderModel || sketchOverlay);

  return (
    <>
      <div className="origin-widget" aria-label="Ориентация">
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
      </div>
      <div className="stage-grid" />

      {showViewport ? (
        <CadViewport
          model={props.renderModel}
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
        <div
          className="sketch-solve-hud"
          data-testid="sketch-solve-hud"
          data-overlay-source={sketchOverlay?.source ?? 'document'}
        >
          <SketchSolveStatus snapshot={sketchSolve.snapshot} />
        </div>
      )}
    </>
  );
}
