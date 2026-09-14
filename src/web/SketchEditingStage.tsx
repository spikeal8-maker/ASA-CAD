import React, { useEffect, useState } from 'react';
import type { CadSketchDelta } from '../application/SketchEntityTransform';
import type { CadPartDocument, CadPoint2, CadSketch } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';
import { CadViewport } from './CadViewport';
import { SketchSolveStatus } from './SketchSolveStatus';
import { useActiveSketchSolveOverlay } from './useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from './useSketchEntityDrag';
import type { SketchLineDraft } from './useSketchLineTool';
import type { SketchCircleDraft } from './useSketchCircleTool';
import type { SketchArcDraft } from './useSketchArcTool';
import type { SketchRectangleDraft } from './useSketchRectangleTool';
import { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';
import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';
import { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';
import { SketchRectangleInteractionLayer } from './viewport/SketchRectangleInteractionLayer';
import { SketchSelectionLayer } from './viewport/SketchSelectionLayer';
import { SketchViewportFrameProvider } from './viewport/SketchViewportFrameContext';
import {
  resetSketchViewportState,
  sketchDisplayFrame,
} from './viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from './viewport/SketchWorkplaneProjection';

export interface SketchEditingStageProps {
  document: Readonly<CadPartDocument>;
  activeSketch: Readonly<CadSketch>;
  activeCommand: string | null;
  revisionToken: number;
  selectedSketchEntityId: CadSketchEntityId | null;
  onSketchEntitySelect(entityId: CadSketchEntityId): void;
  onSketchEntityTranslate(entityId: CadSketchEntityId, delta: CadSketchDelta): Promise<boolean>;
  onSketchDragRejected(message: string): void;
  lineDraft: SketchLineDraft;
  lineCommitting: boolean;
  onSketchLinePointMove(point: CadPoint2): void;
  onSketchLinePoint(point: CadPoint2): void | Promise<void>;
  rectangleDraft: SketchRectangleDraft;
  rectangleCommitting: boolean;
  onSketchRectanglePointMove(point: CadPoint2): void;
  onSketchRectanglePoint(point: CadPoint2): void | Promise<void>;
  circleDraft: SketchCircleDraft;
  circleCommitting: boolean;
  onSketchCirclePointMove(point: CadPoint2): void;
  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;
  arcDraft: SketchArcDraft;
  arcCommitting: boolean;
  onSketchArcPointMove(point: CadPoint2): void;
  onSketchArcPoint(point: CadPoint2): void | Promise<void>;
}

/** Sole owner of the active 2D Sketch presentation/editing surface. */
export function SketchEditingStage(props: SketchEditingStageProps) {
  const sketchSelectionEnabled = props.activeCommand === null;
  const [sketchViewport, setSketchViewport] = useState(resetSketchViewportState);
  useEffect(() => {
    setSketchViewport(resetSketchViewportState());
  }, [props.activeSketch.id]);

  const sketchSolve = useActiveSketchSolveOverlay({
    document: props.document,
    sketch: props.activeSketch,
    active: true,
    revisionToken: props.revisionToken,
  });
  const entityDrag = useSketchEntityDrag({
    part: props.document,
    sketch: props.activeSketch,
    selectedEntityId: props.selectedSketchEntityId,
    enabled: sketchSelectionEnabled,
    previewCandidate: sketchSolve.previewCandidate,
    restorePersistedPreview: sketchSolve.restorePersistedPreview,
    commit: props.onSketchEntityTranslate,
    onRejected: props.onSketchDragRejected,
  });
  const sketchOverlay = sketchSolve.overlay;
  const sketchFrame = sketchDisplayFrame(sketchViewport);
  const workplaneProjection = resolveSketchWorkplaneProjection(props.activeSketch.support);

  return (
    <SketchViewportFrameProvider frame={sketchFrame}>
      <div
        className="part-model-stage"
        data-testid="part-model-stage"
        data-sketch-context="isolated-2d"
        data-sketch-support={props.activeSketch.support}
        data-sketch-projection={workplaneProjection?.kind ?? ''}
        data-model-context-ready={workplaneProjection?.modelContextReady ? 'true' : 'false'}
        data-sketch-view-span={sketchViewport.span}
        data-sketch-view-center={sketchViewport.center.join(',')}
        data-selected-sketch-entity-id={props.selectedSketchEntityId ?? ''}
        data-dragging-sketch-entity-id={entityDrag.draggingEntityId ?? ''}
      >
        <div className="origin-widget" aria-label="Ориентация">
          <span className="axis-z">Z</span>
          <span className="axis-x">X</span>
          <span className="axis-y">Y</span>
        </div>
        <div className="stage-grid" />

        <CadViewport model={null} sketchOverlay={sketchOverlay} />

        <SketchSelectionLayer
          model={sketchOverlay}
          enabled={sketchSelectionEnabled}
          selectedEntityId={props.selectedSketchEntityId}
          draggingEntityId={entityDrag.draggingEntityId}
          onEntitySelect={props.onSketchEntitySelect}
          onEntityDragStart={entityDrag.start}
          onEntityDragMove={entityDrag.move}
          onEntityDragEnd={entityDrag.end}
          onEntityDragCancel={entityDrag.cancel}
        />

        <SketchLineInteractionLayer
          model={sketchOverlay}
          frame={sketchFrame}
          viewportState={sketchViewport}
          onViewportStateChange={setSketchViewport}
          active={props.activeCommand === 'sketch.line'}
          draft={props.lineDraft}
          committing={props.lineCommitting}
          onPointMove={props.onSketchLinePointMove}
          onPoint={props.onSketchLinePoint}
        />

        <SketchRectangleInteractionLayer
          model={sketchOverlay}
          frame={sketchFrame}
          viewportState={sketchViewport}
          onViewportStateChange={setSketchViewport}
          active={props.activeCommand === 'sketch.rectangle'}
          draft={props.rectangleDraft}
          committing={props.rectangleCommitting}
          onPointMove={props.onSketchRectanglePointMove}
          onPoint={props.onSketchRectanglePoint}
        />

        <SketchCircleInteractionLayer
          model={sketchOverlay}
          frame={sketchFrame}
          viewportState={sketchViewport}
          onViewportStateChange={setSketchViewport}
          active={props.activeCommand === 'sketch.circle'}
          draft={props.circleDraft}
          committing={props.circleCommitting}
          onPointMove={props.onSketchCirclePointMove}
          onPoint={props.onSketchCirclePoint}
        />

        <SketchArcInteractionLayer
          model={sketchOverlay}
          frame={sketchFrame}
          viewportState={sketchViewport}
          onViewportStateChange={setSketchViewport}
          active={props.activeCommand === 'sketch.arc'}
          draft={props.arcDraft}
          committing={props.arcCommitting}
          onPointMove={props.onSketchArcPointMove}
          onPoint={props.onSketchArcPoint}
        />

        <div
          className="sketch-solve-hud"
          data-testid="sketch-solve-hud"
          data-overlay-source={sketchOverlay?.source ?? 'document'}
        >
          <SketchSolveStatus snapshot={sketchSolve.snapshot} />
        </div>
      </div>
    </SketchViewportFrameProvider>
  );
}
