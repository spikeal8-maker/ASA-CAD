import React, { useEffect, useState } from 'react';
import type { CadSketchCommandReference } from '../../contracts/commands';
import type { CadPoint2 } from '../../contracts/document';
import { useSketchCoincidentCommit } from '../CoincidentPartModelStage';
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

  const pick = (point: CadPoint2): LineEndpoint | null => {
    let best: LineEndpoint | null = null;
    let distance = pickRadius;
    for (const endpoint of endpoints) {
      const next = Math.hypot(endpoint.position[0] - point[0], endpoint.position[1] - point[1]);
      if (next <= distance) {
        best = endpoint;
        distance = next;
      }
    }
    return best;
  };

  const onPoint = async (point: CadPoint2) => {
    const endpoint = pick(point);
    if (!endpoint) return;
    if (!first) {
      setFirst(endpoint);
      return;
    }
    if (endpointKey(first.ref) === endpointKey(endpoint.ref)) {
      setFirst(null);
      return;
    }
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
              stroke: 'var(--cad-accent, #3467d6)',
              strokeWidth: selected ? 2 : 1.5,
              pointerEvents: 'none',
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

function endpointKey(ref: CadSketchCommandReference): string {
  return `${ref.entityId}:${ref.point ?? ''}`;
}
