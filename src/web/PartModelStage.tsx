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
import type { SketchLineDraft } from './useSketchLineTool';
import { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';
import { resolveSketchWorkplaneProjection } from './viewport/SketchWorkplaneProjection';

export interface PartModelStageProps {
  document: Readonly<CadPartDocument>;
  activeSketch: Readonly<CadSketch> | null;
  activeWorkspace: string;
  activeCommand: string | null;
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
  lineDraft: SketchLineDraft;
  lineCommitting: boolean;
  onSketchLinePointMove(point: CadPoint2): void;
  onSketchLinePoint(point: CadPoint2): void | Promise<void>;
}

/**
 * Focused owner for the Part work-area presentation.
 *
 * Active Sketch editing remains an isolated 2D workplane until a StableRef face
 * can provide a resolved model-space frame. Origin planes already expose a
 * support-aware projection contract, but M3.2 does not fake B-Rep composition.
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
  const viewportModel = sketchEditing ? null : props.renderModel;
  const showViewport = Boolean(viewportModel || sketchOverlay);
  const workplaneProjection = props.activeSketch
    ? resolveSketchWorkplaneProjection(props.activeSketch.support)
    : null;

  return (
    <div
      className="part-model-stage"
      data-testid="part-model-stage"
      data-sketch-context={sketchEditing ? 'isolated-2d' : 'model'}
      data-sketch-support={props.activeSketch?.support ?? ''}
      data-sketch-projection={workplaneProjection?.kind ?? ''}
      data-model-context-ready={workplaneProjection?.modelContextReady ? 'true' : 'false'}
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
          model={sketchOverlay}
          active={props.activeCommand === 'sketch.line'}
          draft={props.lineDraft}
          committing={props.lineCommitting}
          onPointMove={props.onSketchLinePointMove}
          onPoint={props.onSketchLinePoint}
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
