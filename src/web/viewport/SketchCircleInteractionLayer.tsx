import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchCircleDraft } from '../useSketchCircleTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type {
  SketchDisplayFrame,
  SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchCircleInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  draft: SketchCircleDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

/** Circle-specific draft/ghost layer on the shared Sketch input substrate. */
export function SketchCircleInteractionLayer(props: SketchCircleInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = props.draft.center ? 'radius' : 'awaiting-center';
  const radius = props.draft.center && props.draft.edge
    ? Math.hypot(
      props.draft.edge[0] - props.draft.center[0],
      props.draft.edge[1] - props.draft.center[1],
    )
    : 0;

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      committing={props.committing}
      tool="circle"
      ariaLabel="Построение окружности"
      dataAttributes={{ 'data-circle-phase': phase }}
      onPointMove={props.onPointMove}
      onPoint={props.onPoint}
    >
      {props.draft.center && (
        <circle
          data-testid="sketch-circle-center"
          cx={props.draft.center[0]}
          cy={-props.draft.center[1]}
          r={0.9}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {props.draft.center && props.draft.edge && radius > 0 && (
        <circle
          data-testid="sketch-circle-ghost"
          cx={props.draft.center[0]}
          cy={-props.draft.center[1]}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}
