import React from 'react';
import type { CadSketchEntity } from '../../contracts/document';
import type { SketchOverlayModel } from './SketchOverlayModel';

export interface SketchOverlayLayerProps {
  model: SketchOverlayModel | null;
}

/**
 * Separate Sketch presentation layer above the B-Rep canvas.
 *
 * M2O keeps this layer read-only. M3 may add pointer/snap/drag adapters through
 * the shared viewport candidate model; it must not move Sketch entities into
 * CadRenderModel/Three B-Rep meshes.
 */
export function SketchOverlayLayer({ model }: SketchOverlayLayerProps) {
  if (!model) return null;
  const bounds = sketchDisplayBounds(model.entities);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const padding = Math.max(Math.max(width, height) * 0.08, 1);
  const viewBox = [
    bounds.minX - padding,
    bounds.minY - padding,
    width + padding * 2,
    height + padding * 2,
  ].join(' ');

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
      viewBox={viewBox}
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

interface SketchDisplayBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function sketchDisplayBounds(entities: readonly CadSketchEntity[]): SketchDisplayBounds {
  if (entities.length === 0) return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const entity of entities) {
    if (entity.type === 'line') {
      include(entity.data.from[0], -entity.data.from[1]);
      include(entity.data.to[0], -entity.data.to[1]);
      continue;
    }
    const radius = entity.data.diameter / 2;
    const x = entity.data.center[0];
    const y = -entity.data.center[1];
    include(x - radius, y - radius);
    include(x + radius, y + radius);
  }

  return { minX, minY, maxX, maxY };
}
