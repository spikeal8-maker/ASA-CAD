import React, { useEffect, useState } from 'react';
import type { CadSketchDelta } from '../application/SketchEntityTransform';
import type { CadPartDocument, CadPoint2, CadSketch } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';
import { CadViewport } from './CadViewport';
import { SketchDirectToolLayers } from './SketchDirectToolLayers';
import { SketchSolveStatus } from './SketchSolveStatus';
import { useActiveSketchSolveOverlay } from './useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from './useSketchEntityDrag';
import type { SketchLineDraft } from './useSketchLineTool';
import type { SketchCircleDraft } from './useSketchCircleTool';
import type { SketchArcDraft } from './useSketchArcTool';
import type { SketchRectangleDraft } from './useSketchRectangleTool';
import { SketchSelectionLayer } from './viewport/SketchSelectionLayer';
import { SketchViewportFrameProvider } from './viewport/SketchViewportFrameContext';
import { resetSketchViewportState, sketchDisplayFrame } from './viewport/SketchViewportGeometry';
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
  const selectionEnabled = props.activeCommand === null;
  const [viewport, setViewport] = useState(resetSketchViewportState);
  useEffect(() => setViewport(resetSketchViewportState()), [props.activeSketch.id]);

  const solve = useActiveSketchSolveOverlay({
    document: props.document, sketch: props.activeSketch, active: true,
    revisionToken: props.revisionToken,
  });
  const drag = useSketchEntityDrag({
    part: props.document, sketch: props.activeSketch,
    selectedEntityId: props.selectedSketchEntityId, enabled: selectionEnabled,
    previewCandidate: solve.previewCandidate,
    restorePersistedPreview: solve.restorePersistedPreview,
    commit: props.onSketchEntityTranslate,
    onRejected: props.onSketchDragRejected,
  });
  const overlay = solve.overlay;
  const frame = sketchDisplayFrame(viewport);
  const projection = resolveSketchWorkplaneProjection(props.activeSketch.support);

  return (
    <SketchViewportFrameProvider frame={frame}>
      <div
        className="part-model-stage"
        data-testid="part-model-stage"
        data-sketch-context="isolated-2d"
        data-sketch-support={props.activeSketch.support}
        data-sketch-projection={projection?.kind ?? ''}
        data-model-context-ready={projection?.modelContextReady ? 'true' : 'false'}
        data-sketch-view-span={viewport.span}
        data-sketch-view-center={viewport.center.join(',')}
        data-selected-sketch-entity-id={props.selectedSketchEntityId ?? ''}
        data-dragging-sketch-entity-id={drag.draggingEntityId ?? ''}
      >
        <div className="origin-widget" aria-label="Ориентация">
          <span className="axis-z">Z</span><span className="axis-x">X</span><span className="axis-y">Y</span>
        </div>
        <div className="stage-grid" />
        <CadViewport model={null} sketchOverlay={overlay} />
        <SketchSelectionLayer
          model={overlay}
          enabled={selectionEnabled}
          selectedEntityId={props.selectedSketchEntityId}
          draggingEntityId={drag.draggingEntityId}
          onEntitySelect={props.onSketchEntitySelect}
          onEntityDragStart={drag.start}
          onEntityDragMove={drag.move}
          onEntityDragEnd={drag.end}
          onEntityDragCancel={drag.cancel}
        />
        <SketchDirectToolLayers
          model={overlay}
          frame={frame}
          viewportState={viewport}
          onViewportStateChange={setViewport}
          activeCommand={props.activeCommand}
          lineDraft={props.lineDraft}
          lineCommitting={props.lineCommitting}
          onLineMove={props.onSketchLinePointMove}
          onLinePoint={props.onSketchLinePoint}
          rectangleDraft={props.rectangleDraft}
          rectangleCommitting={props.rectangleCommitting}
          onRectangleMove={props.onSketchRectanglePointMove}
          onRectanglePoint={props.onSketchRectanglePoint}
          circleDraft={props.circleDraft}
          circleCommitting={props.circleCommitting}
          onCircleMove={props.onSketchCirclePointMove}
          onCirclePoint={props.onSketchCirclePoint}
          arcDraft={props.arcDraft}
          arcCommitting={props.arcCommitting}
          onArcMove={props.onSketchArcPointMove}
          onArcPoint={props.onSketchArcPoint}
        />
        <div className="sketch-solve-hud" data-testid="sketch-solve-hud" data-overlay-source={overlay?.source ?? 'document'}>
          <SketchSolveStatus snapshot={solve.snapshot} />
        </div>
      </div>
    </SketchViewportFrameProvider>
  );
}
