import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchCircleDraft } from '../SketchCircleNumericInput';
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
  const { center, hover, canonical } = props.draft;
  const phase = center ? 'awaiting-point' : 'awaiting-center';
  const radius = canonical
    ? canonical.radius
    : center && hover ? Math.hypot(hover[0] - center[0], hover[1] - center[1]) : 0;

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
      {center && (
        <circle
          data-testid="sketch-circle-center"
          cx={center[0]}
          cy={-center[1]}
          r={0.9}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {center && hover && radius > 0 && (
        <line
          data-testid="sketch-circle-radius-line"
          x1={center[0]}
          y1={-center[1]}
          x2={hover[0]}
          y2={-hover[1]}
          stroke="currentColor"
          strokeWidth={0.25}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {center && radius > 0 && (
        <circle
          data-testid="sketch-circle-ghost"
          cx={center[0]}
          cy={-center[1]}
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
