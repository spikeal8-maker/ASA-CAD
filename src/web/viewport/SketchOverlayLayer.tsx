import React from 'react';
import type { CadSketchEntity } from '../../contracts/document';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { sketchPointToSvg, sketchWorkplaneViewBox } from './SketchWorkplane';

export interface SketchOverlayLayerProps {
  model: SketchOverlayModel | null;
}

/**
 * Separate Sketch presentation layer above the B-Rep canvas.
 *
 * M3.2 uses one stable workplane viewBox shared with direct tools. Geometry may
 * change without changing the pointer-to-Sketch transform underneath the user.
 */
export function SketchOverlayLayer({ model }: SketchOverlayLayerProps) {
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
      viewBox={sketchWorkplaneViewBox()}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {model.entities.map((entity) => renderEntity(entity))}
    </svg>
  );
}

function renderEntity(entity: CadSketchEntity) {
  switch (entity.type) {
    case 'line': {
      const from = sketchPointToSvg(entity.data.from);
      const to = sketchPointToSvg(entity.data.to);
      return (
        <line
          key={entity.id}
          className="cad-sketch-overlay-entity line"
          data-sketch-entity-id={entity.id}
          x1={from[0]}
          y1={from[1]}
          x2={to[0]}
          y2={to[1]}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    case 'circle': {
      const center = sketchPointToSvg(entity.data.center);
      return (
        <circle
          key={entity.id}
          className="cad-sketch-overlay-entity circle"
          data-sketch-entity-id={entity.id}
          cx={center[0]}
          cy={center[1]}
          r={entity.data.diameter / 2}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
  }
}
