import React from 'react';
import type { CadSketchEntity } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { sketchArcGeometry } from './SketchArcGeometry';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { useSketchViewportFrame } from './SketchViewportFrameContext';
import './sketch-selection.css';

export interface SketchSelectionLayerProps {
  model: SketchOverlayModel | null;
  enabled: boolean;
  selectedEntityId: CadSketchEntityId | null;
  onEntitySelect(entityId: CadSketchEntityId): void;
}

/**
 * Transient stable-ID selection layer for persisted/solver Sketch geometry.
 *
 * Base geometry remains read-only in SketchOverlayLayer inside CadViewport.
 * This sibling owns only hit targets and selected highlighting; it never writes
 * CadDocument and stays disabled while a direct Sketch tool owns pointer input.
 */
export function SketchSelectionLayer(props: SketchSelectionLayerProps) {
  const frame = useSketchViewportFrame();
  if (!props.model) return null;

  return (
    <svg
      className="cad-sketch-selection-layer"
      data-testid="cad-sketch-selection-layer"
      data-selection-enabled={props.enabled ? 'true' : 'false'}
      data-selected-sketch-entity-id={props.selectedEntityId ?? ''}
      viewBox={frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {props.model.entities.map((entity) => (
        <React.Fragment key={entity.id}>
          {props.selectedEntityId === entity.id && renderGeometry(
            entity,
            'cad-sketch-selection-highlight selected',
            { 'data-sketch-entity-id': entity.id },
          )}
          {renderGeometry(
            entity,
            'cad-sketch-selection-hit-target',
            { 'data-sketch-select-id': entity.id },
            props.enabled ? () => props.onEntitySelect(entity.id) : undefined,
          )}
        </React.Fragment>
      ))}
    </svg>
  );
}

function renderGeometry(
  entity: CadSketchEntity,
  className: string,
  data: Record<string, string>,
  onPointerUp?: () => void,
) {
  const common = {
    className,
    ...data,
    vectorEffect: 'non-scaling-stroke' as const,
    onPointerUp: onPointerUp
      ? (event: React.PointerEvent<SVGElement>) => {
        if (event.button !== 0 && event.pointerType !== 'touch') return;
        event.stopPropagation();
        onPointerUp();
      }
      : undefined,
  };

  switch (entity.type) {
    case 'line':
      return (
        <line
          {...common}
          x1={entity.data.from[0]}
          y1={-entity.data.from[1]}
          x2={entity.data.to[0]}
          y2={-entity.data.to[1]}
        />
      );
    case 'circle':
      return (
        <circle
          {...common}
          cx={entity.data.center[0]}
          cy={-entity.data.center[1]}
          r={entity.data.diameter / 2}
          fill="none"
        />
      );
    case 'arc': {
      const geometry = sketchArcGeometry(
        entity.data.center,
        entity.data.radius,
        entity.data.startAngle,
        entity.data.endAngle,
      );
      if (!geometry) return null;
      return <path {...common} d={geometry.path} fill="none" />;
    }
  }
}
