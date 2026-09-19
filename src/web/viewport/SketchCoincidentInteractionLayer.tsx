import React, { useEffect, useState } from 'react';
import type { CadSketchCommandReference } from '../../contracts/commands';
import type { CadPoint2 } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import {
  useSketchAngularPairSelect, useSketchCoincidentCommit, useSketchParallelCommit,
  useSketchPerpendicularCommit, useSketchEqualCommit, type SketchLinePairCommit,
} from '../CoincidentPartModelStage';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type { SketchOverlayModel } from './SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

export interface SketchCoincidentInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
}

type BinaryLayerProps = SketchCoincidentInteractionLayerProps;
interface LineEndpoint {
  ref: CadSketchCommandReference & { point: 'a' | 'b' };
  position: CadPoint2;
}

/** Transient Line-endpoint picker for the narrow M3.7C Coincident product slice. */
export function SketchCoincidentInteractionLayer(props: SketchCoincidentInteractionLayerProps) {
  const commit = useSketchCoincidentCommit();
  const [first, setFirst] = useState<LineEndpoint | null>(null);
  useEffect(() => setFirst(null), [props.active, props.model?.sketchId]);

  const endpoints = lineEndpoints(props.model);
  const pickRadius = props.frame.width * 0.025;
  const markerRadius = props.frame.width * 0.007;
  const pick = (point: CadPoint2): LineEndpoint | null => nearestEndpoint(endpoints, point, pickRadius);

  const onPoint = async (point: CadPoint2) => {
    const endpoint = pick(point);
    if (!endpoint) return;
    if (!first) { setFirst(endpoint); return; }
    if (endpointKey(first.ref) === endpointKey(endpoint.ref)) { setFirst(null); return; }
    if (await commit(first.ref, endpoint.ref)) setFirst(null);
  };

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      tool="constraint.coincident"
      ariaLabel="Совпадение концов отрезков"
      dataAttributes={{
        'data-coincident-first': first ? endpointKey(first.ref) : '',
        'data-coincident-endpoint-count': String(endpoints.length),
      }}
      onPoint={onPoint}
    >
      {endpoints.map((endpoint) => {
        const selected = first && endpointKey(first.ref) === endpointKey(endpoint.ref);
        return (
          <circle
            key={endpointKey(endpoint.ref)}
            data-coincident-entity-id={endpoint.ref.entityId}
            data-coincident-point={endpoint.ref.point}
            data-coincident-selected={selected ? 'true' : 'false'}
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
    </SketchInteractionSurface>
  );
}

/** Accepted M3.7D Parallel wrapper over the shared whole-Line pair picker. */
export function SketchParallelInteractionLayer(props: BinaryLayerProps) {
  const commit = useSketchParallelCommit();
  return <SketchLinePairInteractionLayer {...props} commit={commit} tool="constraint.parallel" label="Параллельность отрезков" prefix="parallel" />;
}

/** M3.7E Perpendicular reuses the same transient whole-Line pair lifecycle. */
export function SketchPerpendicularInteractionLayer(props: BinaryLayerProps) {
  const commit = useSketchPerpendicularCommit();
  return <SketchLinePairInteractionLayer {...props} commit={commit} tool="constraint.perpendicular" label="Перпендикулярность отрезков" prefix="perpendicular" />;
}

export function SketchEqualInteractionLayer(props: BinaryLayerProps) {
  const commit = useSketchEqualCommit();
  return <SketchLinePairInteractionLayer {...props} commit={commit} tool="constraint.equal" label="Равенство отрезков" prefix="equal" />;
}

/** Angular Dimension reuses the accepted whole-Line pair picker before Parameters. */
export function SketchAngularDimensionInteractionLayer(props: BinaryLayerProps) {
  const select = useSketchAngularPairSelect();
  return <SketchLinePairInteractionLayer {...props} commit={select} tool="dimension.angular" label="Угловой размер" prefix="angular" />;
}

function SketchLinePairInteractionLayer(props: BinaryLayerProps & {
  commit: SketchLinePairCommit;
  tool: 'constraint.parallel' | 'constraint.perpendicular' | 'constraint.equal' | 'dimension.angular';
  label: string;
  prefix: 'parallel' | 'perpendicular' | 'equal' | 'angular';
}) {
  const [first, setFirst] = useState<CadSketchEntityId | null>(null);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    setFirst(null);
    setComplete(false);
  }, [props.active, props.model?.sketchId]);
  const lines = lineEntities(props.model);
  const pickRadius = props.frame.width * 0.025;

  const onPoint = async (point: CadPoint2) => {
    const entityId = nearestLine(lines, point, pickRadius);
    if (!entityId) return;
    if (!first) { setFirst(entityId); return; }
    if (first === entityId) { setFirst(null); return; }
    if (await props.commit(first, entityId)) {
      setFirst(null);
      setComplete(true);
    }
  };

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active && !complete}
      tool={props.tool}
      ariaLabel={props.label}
      dataAttributes={{
        [`data-${props.prefix}-first`]: first ?? '',
        [`data-${props.prefix}-line-count`]: String(lines.length),
      }}
      onPoint={onPoint}
    >
      {lines.map((line) => {
        const selected = first === line.id;
        return (
          <line
            key={line.id}
            {...{
              [`data-${props.prefix}-line-id`]: line.id,
              [`data-${props.prefix}-selected`]: selected ? 'true' : 'false',
            }}
            x1={line.from[0]} y1={-line.from[1]} x2={line.to[0]} y2={-line.to[1]}
            vectorEffect="non-scaling-stroke"
            style={{
              stroke: 'var(--cad-accent, #3467d6)', strokeWidth: selected ? 3 : 2,
              opacity: selected ? 1 : 0.35, pointerEvents: 'none',
            }}
          />
        );
      })}
    </SketchInteractionSurface>
  );
}

function lineEndpoints(model: SketchOverlayModel | null): LineEndpoint[] {
  if (!model) return [];
  return model.entities.flatMap((entity): LineEndpoint[] => {
    if (entity.type !== 'line') return [];
    return [
      { ref: { entityId: entity.id, point: 'a' }, position: entity.data.from },
      { ref: { entityId: entity.id, point: 'b' }, position: entity.data.to },
    ];
  });
}

interface PickLine { id: CadSketchEntityId; from: CadPoint2; to: CadPoint2 }
function lineEntities(model: SketchOverlayModel | null): PickLine[] {
  if (!model) return [];
  return model.entities.flatMap((entity): PickLine[] => entity.type === 'line'
    ? [{ id: entity.id, from: entity.data.from, to: entity.data.to }]
    : []);
}

function nearestEndpoint(endpoints: readonly LineEndpoint[], point: CadPoint2, radius: number): LineEndpoint | null {
  let best: LineEndpoint | null = null;
  let distance = radius;
  for (const endpoint of endpoints) {
    const next = Math.hypot(endpoint.position[0] - point[0], endpoint.position[1] - point[1]);
    if (next <= distance) { best = endpoint; distance = next; }
  }
  return best;
}

function nearestLine(lines: readonly PickLine[], point: CadPoint2, radius: number): CadSketchEntityId | null {
  let best: CadSketchEntityId | null = null;
  let distance = radius;
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
