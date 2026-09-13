import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchArcDraft } from '../useSketchArcTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import { sketchArcGeometryFromPoints, sketchArcSvgPath } from './SketchArcGeometry';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

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

/** Arc-specific center/start/end draft layer on the shared Sketch input substrate. */
export function SketchArcInteractionLayer(props: SketchArcInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = !props.draft.center ? 'awaiting-center' : !props.draft.start ? 'awaiting-start' : 'awaiting-end';
  const ghost = props.draft.center && props.draft.start && props.draft.preview
    ? sketchArcGeometryFromPoints(props.draft.center, props.draft.start, props.draft.preview)
    : null;
  const path = ghost ? sketchArcSvgPath(ghost) : '';

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
        <circle data-testid="sketch-arc-center" cx={props.draft.center[0]} cy={-props.draft.center[1]} r={0.9} fill="currentColor" vectorEffect="non-scaling-stroke" />
      )}
      {props.draft.center && props.draft.start && (
        <line
          data-testid="sketch-arc-radius"
          x1={props.draft.center[0]}
          y1={-props.draft.center[1]}
          x2={props.draft.start[0]}
          y2={-props.draft.start[1]}
          stroke="currentColor"
          strokeWidth={0.3}
          strokeDasharray="1.5 1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {path && (
        <path
          data-testid="sketch-arc-ghost"
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}
