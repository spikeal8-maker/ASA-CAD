import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import {
  positiveSketchArcSweep,
  SKETCH_FULL_TURN,
  sketchArcEndPoint,
  sketchArcSvgPath,
  sketchPointAngle,
  sketchPointDistance,
} from '../SketchArcGeometry';
import type { SketchArcDraft } from '../useSketchArcTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
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

/** Arc-specific draft/ghost layer on the shared Sketch input substrate. */
export function SketchArcInteractionLayer(props: SketchArcInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = !props.draft.center
    ? 'awaiting-center'
    : !props.draft.start ? 'awaiting-start' : 'sweep';
  const radius = props.draft.center && props.draft.start
    ? sketchPointDistance(props.draft.center, props.draft.start)
    : 0;
  const startAngle = props.draft.center && props.draft.start
    ? sketchPointAngle(props.draft.center, props.draft.start)
    : 0;
  const endAngle = props.draft.center && props.draft.cursor
    ? sketchPointAngle(props.draft.center, props.draft.cursor)
    : 0;
  const sweep = props.draft.center && props.draft.start && props.draft.cursor
    ? positiveSketchArcSweep(startAngle, endAngle)
    : 0;
  const ghostPath = radius > 0 && sweep > 1e-6 && sweep < SKETCH_FULL_TURN - 1e-6
    ? sketchArcSvgPath(props.draft.center!, radius, startAngle, startAngle + sweep)
    : '';
  const projectedEnd = props.draft.center && ghostPath
    ? sketchArcEndPoint(props.draft.center, radius, startAngle + sweep)
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
      {props.draft.center && !props.draft.start && props.draft.cursor && (
        <line
          data-testid="sketch-arc-radius-preview"
          x1={props.draft.center[0]}
          y1={-props.draft.center[1]}
          x2={props.draft.cursor[0]}
          y2={-props.draft.cursor[1]}
          stroke="currentColor"
          strokeWidth={0.35}
          strokeDasharray="1.5 1.2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {props.draft.start && props.draft.center && (
        <>
          <line
            data-testid="sketch-arc-radius"
            x1={props.draft.center[0]}
            y1={-props.draft.center[1]}
            x2={props.draft.start[0]}
            y2={-props.draft.start[1]}
            stroke="currentColor"
            strokeWidth={0.3}
            strokeDasharray="1.5 1.2"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            data-testid="sketch-arc-start"
            cx={props.draft.start[0]}
            cy={-props.draft.start[1]}
            r={0.8}
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {ghostPath && (
        <path
          data-testid="sketch-arc-ghost"
          d={ghostPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {projectedEnd && (
        <circle
          data-testid="sketch-arc-end"
          cx={projectedEnd[0]}
          cy={-projectedEnd[1]}
          r={0.7}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}
