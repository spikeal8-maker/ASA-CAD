import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchArcDraft } from '../useSketchArcTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { sketchArcGeometryFromConstruction } from './SketchArcGeometry';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type {
  SketchDisplayFrame,
  SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchArcInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  draft: SketchArcDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

/** Arc-specific center/start/sweep ghost on the shared Sketch input substrate. */
export function SketchArcInteractionLayer(props: SketchArcInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = !props.draft.center
    ? 'awaiting-center'
    : !props.draft.start
      ? 'awaiting-start'
      : 'awaiting-end';
  const startCandidate = props.draft.start ?? props.draft.hover;
  const endCandidate = props.draft.end ?? props.draft.hover;
  const arcGhost = props.draft.center && props.draft.start && endCandidate
    ? sketchArcGeometryFromConstruction(props.draft.center, props.draft.start, endCandidate)
    : null;

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      committing={props.committing}
      tool="arc"
      ariaLabel="Построение дуги"
      dataAttributes={{ 'data-arc-phase': phase }}
      onPointMove={props.onPointMove}
      onPoint={props.onPoint}
    >
      {props.draft.center && (
        <circle
          data-testid="sketch-arc-center"
          cx={props.draft.center[0]}
          cy={-props.draft.center[1]}
          r={0.9}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {props.draft.center && startCandidate && !props.draft.start && (
        <line
          data-testid="sketch-arc-radius-ghost"
          x1={props.draft.center[0]}
          y1={-props.draft.center[1]}
          x2={startCandidate[0]}
          y2={-startCandidate[1]}
          stroke="currentColor"
          strokeWidth={0.35}
          strokeDasharray="2 1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {arcGhost && (
        <path
          data-testid="sketch-arc-ghost"
          className="cad-sketch-arc-ghost"
          d={arcGhost.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}
