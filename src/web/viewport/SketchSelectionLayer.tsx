import React, { useRef } from 'react';
import type { CadPoint2, CadSketchEntity } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { sketchArcGeometry } from './SketchArcGeometry';
import type { SketchOverlayModel } from './SketchOverlayModel';
import { useSketchViewportFrame } from './SketchViewportFrameContext';
import { screenPointToSketchPoint } from './SketchViewportGeometry';
import './sketch-selection.css';

export interface SketchSelectionLayerProps {
  model: SketchOverlayModel | null;
  enabled: boolean;
  selectedEntityId: CadSketchEntityId | null;
  draggingEntityId?: CadSketchEntityId | null;
  onEntitySelect(entityId: CadSketchEntityId): void;
  onEntityDragStart?(entityId: CadSketchEntityId, point: CadPoint2): boolean;
  onEntityDragMove?(point: CadPoint2): void;
  onEntityDragEnd?(point: CadPoint2): void | Promise<void>;
  onEntityDragCancel?(): void;
}

/**
 * Transient stable-ID selection/rigid-drag input layer for persisted/solver
 * Sketch geometry. Base geometry remains read-only in SketchOverlayLayer inside
 * CadViewport. Empty workspace is never intercepted, so Sketch navigation keeps
 * its existing ownership.
 */
export function SketchSelectionLayer(props: SketchSelectionLayerProps) {
  const frame = useSketchViewportFrame();
  const dragPointerRef = useRef<number | null>(null);
  const dragEntityRef = useRef<CadSketchEntityId | null>(null);
  if (!props.model) return null;

  const pointFromEvent = (event: React.PointerEvent<SVGElement>): CadPoint2 | null => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    return screenPointToSketchPoint(frame, svg.getBoundingClientRect(), event.clientX, event.clientY);
  };

  const pointerDown = (entityId: CadSketchEntityId) => (event: React.PointerEvent<SVGElement>) => {
    if (!props.enabled || props.selectedEntityId !== entityId || !props.onEntityDragStart) return;
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    const point = pointFromEvent(event);
    if (!point || !props.onEntityDragStart(entityId, point)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPointerRef.current = event.pointerId;
    dragEntityRef.current = entityId;
  };

  const pointerMove = (event: React.PointerEvent<SVGElement>) => {
    if (dragPointerRef.current !== event.pointerId || !props.onEntityDragMove) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.stopPropagation();
    props.onEntityDragMove(point);
  };

  const finishDrag = (event: React.PointerEvent<SVGElement>) => {
    if (dragPointerRef.current !== event.pointerId) return false;
    const point = pointFromEvent(event);
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragPointerRef.current = null;
    dragEntityRef.current = null;
    if (point && props.onEntityDragEnd) void props.onEntityDragEnd(point);
    else props.onEntityDragCancel?.();
    return true;
  };

  const cancelDrag = (event: React.PointerEvent<SVGElement>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    dragPointerRef.current = null;
    dragEntityRef.current = null;
    props.onEntityDragCancel?.();
  };

  return (
    <svg
      className="cad-sketch-selection-layer"
      data-testid="cad-sketch-selection-layer"
      data-selection-enabled={props.enabled ? 'true' : 'false'}
      data-selected-sketch-entity-id={props.selectedEntityId ?? ''}
      data-dragging-sketch-entity-id={props.draggingEntityId ?? ''}
      viewBox={frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {props.model.entities.map((entity) => (
        <React.Fragment key={entity.id}>
          {props.selectedEntityId === entity.id && renderGeometry(
            entity,
            `cad-sketch-selection-highlight selected${props.draggingEntityId === entity.id ? ' dragging' : ''}`,
            { 'data-sketch-entity-id': entity.id },
          )}
          {renderGeometry(
            entity,
            'cad-sketch-selection-hit-target',
            { 'data-sketch-select-id': entity.id },
            {
              onPointerDown: pointerDown(entity.id),
              onPointerMove: pointerMove,
              onPointerUp: (event) => {
                if (finishDrag(event)) return;
                if (!props.enabled) return;
                if (event.button !== 0 && event.pointerType !== 'touch') return;
                event.stopPropagation();
                props.onEntitySelect(entity.id);
              },
              onPointerCancel: cancelDrag,
            },
          )}
        </React.Fragment>
      ))}
    </svg>
  );
}

type GeometryPointerHandlers = {
  onPointerDown?: (event: React.PointerEvent<SVGElement>) => void;
  onPointerMove?: (event: React.PointerEvent<SVGElement>) => void;
  onPointerUp?: (event: React.PointerEvent<SVGElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<SVGElement>) => void;
};

function renderGeometry(
  entity: CadSketchEntity,
  className: string,
  data: Record<string, string>,
  handlers: GeometryPointerHandlers = {},
) {
  const common = {
    className,
    ...data,
    vectorEffect: 'non-scaling-stroke' as const,
    ...handlers,
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
