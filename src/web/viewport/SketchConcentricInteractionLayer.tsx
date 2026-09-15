import React, { useEffect, useState } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { useSketchConcentricCommit } from '../CoincidentPartModelStage';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type { SketchOverlayModel } from './SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

export interface SketchConcentricInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
}

type CircleCandidate = { id: CadSketchEntityId; center: CadPoint2; radius: number };

/** Transient first-slice Concentric picker: exactly two distinct Circles. */
export function SketchConcentricInteractionLayer(props: SketchConcentricInteractionLayerProps) {
  const commit = useSketchConcentricCommit();
  const [first, setFirst] = useState<CircleCandidate | null>(null);
  useEffect(() => setFirst(null), [props.active, props.model?.sketchId]);
  const circles = circleCandidates(props.model);
  const pickRadius = props.frame.width * 0.025;

  const onPoint = async (point: CadPoint2) => {
    const candidate = nearestCircle(circles, point, pickRadius);
    if (!candidate) return;
    if (!first) { setFirst(candidate); return; }
    if (first.id === candidate.id) { setFirst(null); return; }
    if (await commit(first.id, candidate.id)) setFirst(null);
  };

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      tool="constraint.concentric"
      ariaLabel="Концентричность окружностей"
      dataAttributes={{
        'data-concentric-first': first?.id ?? '',
        'data-concentric-circle-count': String(circles.length),
      }}
      onPoint={onPoint}
    >
      {circles.map((circle) => {
        const selected = first?.id === circle.id;
        return (
          <circle
            key={circle.id}
            data-concentric-circle-id={circle.id}
            data-concentric-selected={selected ? 'true' : 'false'}
            cx={circle.center[0]} cy={-circle.center[1]} r={circle.radius}
            vectorEffect="non-scaling-stroke"
            style={{ fill: 'none', stroke: 'var(--cad-accent, #3467d6)', strokeWidth: selected ? 3 : 2, opacity: selected ? 1 : 0.35, pointerEvents: 'none' }}
          />
        );
      })}
    </SketchInteractionSurface>
  );
}

function circleCandidates(model: SketchOverlayModel | null): CircleCandidate[] {
  if (!model) return [];
  return model.entities.flatMap((entity): CircleCandidate[] => entity.type === 'circle'
    ? [{ id: entity.id, center: entity.data.center, radius: entity.data.diameter / 2 }]
    : []);
}

function nearestCircle(circles: readonly CircleCandidate[], point: CadPoint2, radius: number): CircleCandidate | null {
  let best: CircleCandidate | null = null;
  let distance = radius;
  for (const circle of circles) {
    const next = Math.abs(Math.hypot(point[0] - circle.center[0], point[1] - circle.center[1]) - circle.radius);
    if (next <= distance) { best = circle; distance = next; }
  }
  return best;
}
