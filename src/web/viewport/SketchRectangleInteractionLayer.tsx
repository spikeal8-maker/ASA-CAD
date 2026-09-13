import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchRectangleDraft } from '../useSketchRectangleTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type {
  SketchDisplayFrame,
  SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchRectangleInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  draft: SketchRectangleDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

/** Rectangle-specific first/opposite-corner ghost on shared Sketch input. */
export function SketchRectangleInteractionLayer(props: SketchRectangleInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = props.draft.from ? 'awaiting-opposite' : 'awaiting-first';
  const geometry = props.draft.from && props.draft.to
    ? rectangleGeometry(props.draft.from, props.draft.to)
    : null;

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      committing={props.committing}
      tool="rectangle"
      ariaLabel="Построение прямоугольника"
      dataAttributes={{ 'data-rectangle-phase': phase }}
      onPointMove={props.onPointMove}
      onPoint={props.onPoint}
    >
      {props.draft.from && (
        <circle
          data-testid="sketch-rectangle-first-corner"
          cx={props.draft.from[0]}
          cy={-props.draft.from[1]}
          r={0.9}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {geometry && (
        <rect
          data-testid="sketch-rectangle-ghost"
          x={geometry.x}
          y={geometry.y}
          width={geometry.width}
          height={geometry.height}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}

function rectangleGeometry(from: CadPoint2, to: CadPoint2) {
  const minX = Math.min(from[0], to[0]);
  const maxY = Math.max(from[1], to[1]);
  return {
    x: minX,
    y: -maxY,
    width: Math.abs(to[0] - from[0]),
    height: Math.abs(to[1] - from[1]),
  };
}
