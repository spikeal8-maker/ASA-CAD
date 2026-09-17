import React, { useEffect, useState } from 'react';
import type { CadSketchCommandReference } from '../../contracts/commands';
import type { CadPoint2 } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { useSketchSymmetryCommit } from '../CoincidentPartModelStage';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type { SketchOverlayModel } from './SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

export interface SketchSymmetryInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
}

type EndpointRef = CadSketchCommandReference & { point: 'a' | 'b' };
interface LineEndpoint { ref: EndpointRef; position: CadPoint2 }
interface PickLine { id: CadSketchEntityId; from: CadPoint2; to: CadPoint2 }

/** Transient endpoint → endpoint → axis picker for the first bounded Symmetry slice. */
export function SketchSymmetryInteractionLayer(props: SketchSymmetryInteractionLayerProps) {
  const commit = useSketchSymmetryCommit();
  const [first, setFirst] = useState<LineEndpoint | null>(null);
  const [second, setSecond] = useState<LineEndpoint | null>(null);
  useEffect(() => { setFirst(null); setSecond(null); }, [props.active, props.model?.sketchId]);

  const endpoints = lineEndpoints(props.model);
  const lines = lineEntities(props.model);
  const pickRadius = props.frame.width * 0.025;
  const markerRadius = props.frame.width * 0.007;

  const onPoint = async (point: CadPoint2) => {
    if (!first) {
      const next = nearestEndpoint(endpoints, point, pickRadius);
      if (next) setFirst(next);
      return;
    }
    if (!second) {
      const next = nearestEndpoint(endpoints.filter((item) => item.ref.entityId !== first.ref.entityId), point, pickRadius);
      if (!next) return;
      setSecond(next);
      return;
    }
    const axisId = nearestLine(
      lines.filter((line) => line.id !== first.ref.entityId && line.id !== second.ref.entityId),
      point,
      pickRadius,
    );
    if (!axisId) return;
    if (await commit(first.ref, second.ref, axisId)) { setFirst(null); setSecond(null); }
  };

  const phase = !first ? 'first-endpoint' : !second ? 'second-endpoint' : 'axis';
  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      tool="constraint.symmetric"
      ariaLabel="Симметрия точек относительно отрезка"
      dataAttributes={{
        'data-symmetry-phase': phase,
        'data-symmetry-first': first ? endpointKey(first.ref) : '',
        'data-symmetry-second': second ? endpointKey(second.ref) : '',
        'data-symmetry-endpoint-count': String(endpoints.length),
        'data-symmetry-line-count': String(lines.length),
      }}
      onPoint={onPoint}
    >
      {endpoints.map((endpoint) => {
        const key = endpointKey(endpoint.ref);
        const selected = key === (first && endpointKey(first.ref)) || key === (second && endpointKey(second.ref));
        return (
          <circle
            key={key}
            data-symmetry-endpoint={key}
            data-symmetry-entity-id={endpoint.ref.entityId}
            data-symmetry-point={endpoint.ref.point}
            data-symmetry-selected={selected ? 'true' : 'false'}
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
        const validAxis = Boolean(first && second && line.id !== first.ref.entityId && line.id !== second.ref.entityId);
        return (
          <line
            key={`axis:${line.id}`}
            data-symmetry-axis-id={line.id}
            data-symmetry-axis-valid={validAxis ? 'true' : 'false'}
            x1={line.from[0]} y1={-line.from[1]} x2={line.to[0]} y2={-line.to[1]}
            vectorEffect="non-scaling-stroke"
            style={{
              stroke: 'var(--cad-accent, #3467d6)', strokeWidth: validAxis ? 3 : 1.5,
              opacity: validAxis ? 0.9 : 0.18, pointerEvents: 'none',
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
