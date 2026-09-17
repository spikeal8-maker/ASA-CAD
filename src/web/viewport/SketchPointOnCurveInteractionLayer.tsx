import React, { useEffect, useState } from 'react';
import type { CadSketchCommandReference } from '../../contracts/commands';
import type { CadPoint2 } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { useSketchPointOnCurveCommit } from '../CoincidentPartModelStage';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type { SketchOverlayModel } from './SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

export interface SketchPointOnCurveInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
}

type EndpointRef = CadSketchCommandReference & { point: 'a' | 'b' };
interface LineEndpoint { ref: EndpointRef; position: CadPoint2 }
interface PickLine { id: CadSketchEntityId; from: CadPoint2; to: CadPoint2 }

/** Transient endpoint -> distinct target-Line picker for the first bounded Point-on-curve slice. */
export function SketchPointOnCurveInteractionLayer(props: SketchPointOnCurveInteractionLayerProps) {
  const commit = useSketchPointOnCurveCommit();
  const [source, setSource] = useState<LineEndpoint | null>(null);
  useEffect(() => { setSource(null); }, [props.active, props.model?.sketchId]);

  const endpoints = lineEndpoints(props.model);
  const lines = lineEntities(props.model);
  const pickRadius = props.frame.width * 0.025;
  const markerRadius = props.frame.width * 0.007;

  const onPoint = async (point: CadPoint2) => {
    if (!source) {
      const next = nearestEndpoint(endpoints, point, pickRadius);
      if (next) setSource(next);
      return;
    }
    const targetEntityId = nearestLine(
      lines.filter((line) => line.id !== source.ref.entityId),
      point,
      pickRadius,
    );
    if (!targetEntityId) return;
    if (await commit(source.ref, targetEntityId)) setSource(null);
  };

  const phase = source ? 'target-line' : 'endpoint';
  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      tool="constraint.pointOnCurve"
      ariaLabel="Точка отрезка на другом отрезке"
      dataAttributes={{
        'data-point-on-curve-phase': phase,
        'data-point-on-curve-source': source ? endpointKey(source.ref) : '',
        'data-point-on-curve-endpoint-count': String(endpoints.length),
        'data-point-on-curve-line-count': String(lines.length),
      }}
      onPoint={onPoint}
    >
      {endpoints.map((endpoint) => {
        const key = endpointKey(endpoint.ref);
        const selected = key === (source && endpointKey(source.ref));
        return (
          <circle
            key={key}
            data-point-on-curve-endpoint={key}
            data-point-on-curve-entity-id={endpoint.ref.entityId}
            data-point-on-curve-point={endpoint.ref.point}
            data-point-on-curve-selected={selected ? 'true' : 'false'}
            cx={endpoint.position[0]}
            cy={-endpoint.position[1]}
            r={markerRadius}
            vectorEffect="non-scaling-stroke"
            style={{
              fill: selected ? 'var(--cad-accent, #3467d6)' : 'var(--cad-surface, #fff)',
              stroke: 'var(--cad-accent, #3467d6)', strokeWidth: selected ? 2 : 1.5, pointerEvents: 'none',
            }}
          />
        );
      })}
      {lines.map((line) => {
        const validTarget = Boolean(source && line.id !== source.ref.entityId);
        return (
          <line
            key={`target:${line.id}`}
            data-point-on-curve-target-id={line.id}
            data-point-on-curve-target-valid={validTarget ? 'true' : 'false'}
            x1={line.from[0]} y1={-line.from[1]} x2={line.to[0]} y2={-line.to[1]}
            vectorEffect="non-scaling-stroke"
            style={{
              stroke: 'var(--cad-accent, #3467d6)', strokeWidth: validTarget ? 3 : 1.5,
              opacity: validTarget ? 0.9 : 0.18, pointerEvents: 'none',
            }}
          />
        );
      })}
    </SketchInteractionSurface>
  );
}

function lineEndpoints(model: SketchOverlayModel | null): LineEndpoint[] {
  if (!model) return [];
  return model.entities.flatMap((entity): LineEndpoint[] => entity.type === 'line' ? [
    { ref: { entityId: entity.id, point: 'a' }, position: entity.data.from },
    { ref: { entityId: entity.id, point: 'b' }, position: entity.data.to },
  ] : []);
}

function lineEntities(model: SketchOverlayModel | null): PickLine[] {
  if (!model) return [];
  return model.entities.flatMap((entity): PickLine[] => entity.type === 'line'
    ? [{ id: entity.id, from: entity.data.from, to: entity.data.to }]
    : []);
}

function nearestEndpoint(endpoints: readonly LineEndpoint[], point: CadPoint2, radius: number): LineEndpoint | null {
  let best: LineEndpoint | null = null, distance = radius;
  for (const endpoint of endpoints) {
    const next = Math.hypot(endpoint.position[0] - point[0], endpoint.position[1] - point[1]);
    if (next <= distance) { best = endpoint; distance = next; }
  }
  return best;
}

function nearestLine(lines: readonly PickLine[], point: CadPoint2, radius: number): CadSketchEntityId | null {
  let best: CadSketchEntityId | null = null, distance = radius;
  for (const line of lines) {
    const next = pointSegmentDistance(point, line.from, line.to);
    if (next <= distance) { best = line.id; distance = next; }
  }
  return best;
}

function pointSegmentDistance(point: CadPoint2, a: CadPoint2, b: CadPoint2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

function endpointKey(ref: CadSketchCommandReference): string {
  return `${ref.entityId}:${ref.point ?? ''}`;
}
