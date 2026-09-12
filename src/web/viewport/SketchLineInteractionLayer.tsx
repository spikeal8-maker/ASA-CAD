import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchLineDraft } from '../useSketchLineTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { screenPointToSketchPoint, sketchDisplayFrame } from './SketchViewportGeometry';

export interface SketchLineInteractionLayerProps {
  model: SketchOverlayModel | null;
  active: boolean;
  draft: SketchLineDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

/**
 * M3.2 pointer surface for one direct Line vertical slice.
 *
 * This layer owns no persisted geometry and no solver state. It converts mouse
 * and touch Pointer Events to local Sketch coordinates and displays only the
 * transient start/ghost line supplied by the Line tool controller.
 */
export function SketchLineInteractionLayer(props: SketchLineInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const frame = sketchDisplayFrame(props.model.entities);
  const phase = props.draft.from ? 'anchored' : 'awaiting-start';

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): CadPoint2 | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    return screenPointToSketchPoint(frame, rect, event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!props.draft.from || props.committing) return;
    const point = pointFromEvent(event);
    if (point) props.onPointMove(point);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (props.committing) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.focus();
    void props.onPoint(point);
  };

  return (
    <svg
      className="cad-sketch-interaction"
      data-testid="cad-sketch-interaction"
      data-tool="line"
      data-line-phase={phase}
      data-sketch-id={props.model.sketchId}
      viewBox={frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Построение отрезка"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
    >
      {props.draft.from && (
        <circle
          className="cad-sketch-line-anchor"
          data-testid="sketch-line-anchor"
          cx={props.draft.from[0]}
          cy={-props.draft.from[1]}
          r={0.55}
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
    </svg>
  );
}
