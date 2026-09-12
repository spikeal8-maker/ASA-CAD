import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchLineDraft } from '../useSketchLineTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type {
  SketchDisplayFrame,
  SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchLineInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  draft: SketchLineDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

/**
 * Line-specific Sketch interaction presentation.
 *
 * Shared pointer/touch/navigation semantics live in SketchInteractionSurface;
 * this component owns only Line draft/ghost rendering.
 */
export function SketchLineInteractionLayer(props: SketchLineInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = props.draft.from ? 'anchored' : 'awaiting-start';

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      committing={props.committing}
      tool="line"
      phase={phase}
      ariaLabel="Построение отрезка"
      onPointMove={props.onPointMove}
      onPoint={props.onPoint}
    >
      {props.draft.from && (
        <circle
          className="cad-sketch-line-anchor"
          data-testid="sketch-line-anchor"
          cx={props.draft.from[0]}
          cy={-props.draft.from[1]}
          r={0.9}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {props.draft.from && props.draft.to && (
        <line
          className="cad-sketch-line-ghost"
          data-testid="sketch-line-ghost"
          x1={props.draft.from[0]}
          y1={-props.draft.from[1]}
          x2={props.draft.to[0]}
          y2={-props.draft.to[1]}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </SketchInteractionSurface>
  );
}
