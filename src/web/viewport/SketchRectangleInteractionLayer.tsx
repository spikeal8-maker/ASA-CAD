import React from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchRectangleDraft } from '../useSketchRectangleTool';
import { canonicalSketchRectangle } from './SketchRectangleGeometry';
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

/** Rectangle-specific transient presentation over the shared Sketch input surface. */
export function SketchRectangleInteractionLayer(props: SketchRectangleInteractionLayerProps) {
  if (!props.active || !props.model) return null;
  const phase = props.draft.first ? 'awaiting-opposite' : 'awaiting-first';
  const geometry = props.draft.first && props.draft.opposite
    ? canonicalSketchRectangle(props.draft.first, props.draft.opposite)
    : null;
  const edges = geometry ? rectangleEdges(geometry.origin, geometry.width, geometry.height) : [];

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
      {edges.map(([from, to], index) => (
        <line
          key={index}
          className="cad-sketch-rectangle-ghost"
          data-testid="sketch-rectangle-ghost-edge"
          data-edge-index={index}
          x1={from[0]}
          y1={-from[1]}
          x2={to[0]}
          y2={-to[1]}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </SketchInteractionSurface>
  );
}

function rectangleEdges(
  origin: readonly [number, number],
  width: number,
  height: number,
): ReadonlyArray<readonly [CadPoint2, CadPoint2]> {
  const [x, y] = origin;
  const a: CadPoint2 = [x, y];
  const b: CadPoint2 = [x + width, y];
  const c: CadPoint2 = [x + width, y + height];
  const d: CadPoint2 = [x, y + height];
  return [[a, b], [b, c], [c, d], [d, a]];
}
