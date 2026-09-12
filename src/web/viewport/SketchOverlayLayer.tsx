import React from 'react';
import type { CadSketchEntity } from '../../contracts/document';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { useSketchViewportFrame } from './SketchViewportFrameContext';

export interface SketchOverlayLayerProps {
  model: SketchOverlayModel | null;
}

/**
 * Separate Sketch presentation layer above the B-Rep canvas.
 *
 * Persisted/solver geometry stays read-only here. M3 interaction is rendered by
 * a sibling Sketch interaction layer so transient pointer/ghost state never
 * enters CadRenderModel or solver-owned preview data.
 */
export function SketchOverlayLayer({ model }: SketchOverlayLayerProps) {
  const frame = useSketchViewportFrame();
  if (!model) return null;

  return (
    <svg
      className={`cad-sketch-overlay source-${model.source}`}
      data-testid="cad-sketch-overlay"
      data-sketch-id={model.sketchId}
      data-overlay-source={model.source}
      data-solve-status={model.solveStatus}
      data-constraint-state={model.constraintState}
      data-degrees-of-freedom={model.degreesOfFreedom ?? ''}
      data-entity-count={model.entities.length}
      data-view-box={frame.viewBox}
      viewBox={frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {model.entities.map((entity) => renderEntity(entity))}
    </svg>
  );
}

function renderEntity(entity: CadSketchEntity) {
  switch (entity.type) {
    case 'line':
      return (
        <line
          key={entity.id}
          className="cad-sketch-overlay-entity line"
          data-sketch-entity-id={entity.id}
          x1={entity.data.from[0]}
          y1={-entity.data.from[1]}
          x2={entity.data.to[0]}
          y2={-entity.data.to[1]}
          vectorEffect="non-scaling-stroke"
        />
      );
    case 'circle':
      return (
        <circle
          key={entity.id}
          className="cad-sketch-overlay-entity circle"
          data-sketch-entity-id={entity.id}
          cx={entity.data.center[0]}
          cy={-entity.data.center[1]}
          r={entity.data.diameter / 2}
          vectorEffect="non-scaling-stroke"
        />
      );
  }
}
