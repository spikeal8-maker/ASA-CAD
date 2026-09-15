import React, { useEffect, useState } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { useSketchTangentCommit } from '../CoincidentPartModelStage';
import { SketchInteractionSurface } from './SketchInteractionSurface';
import type { SketchOverlayModel } from './SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './SketchViewportGeometry';

export interface SketchTangentInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
}

type TangentCandidate =
  | { id: CadSketchEntityId; type: 'line'; from: CadPoint2; to: CadPoint2 }
  | { id: CadSketchEntityId; type: 'circle'; center: CadPoint2; radius: number };

/** Transient first-slice Tangent picker: exactly one Line and one Circle. */
export function SketchTangentInteractionLayer(props: SketchTangentInteractionLayerProps) {
  const commit = useSketchTangentCommit();
  const [first, setFirst] = useState<TangentCandidate | null>(null);
  useEffect(() => setFirst(null), [props.active, props.model?.sketchId]);
  const candidates = tangentCandidates(props.model);
  const pickRadius = props.frame.width * 0.025;

  const onPoint = async (point: CadPoint2) => {
    const candidate = nearestCandidate(candidates, point, pickRadius);
    if (!candidate) return;
    if (!first) { setFirst(candidate); return; }
    if (first.id === candidate.id) { setFirst(null); return; }
    if (first.type === candidate.type) { setFirst(candidate); return; }
    if (await commit(first.id, candidate.id)) setFirst(null);
  };

  return (
    <SketchInteractionSurface
      frame={props.frame}
      viewportState={props.viewportState}
      onViewportStateChange={props.onViewportStateChange}
      active={props.active}
      tool="constraint.tangent"
      ariaLabel="Касательность отрезка и окружности"
      dataAttributes={{
        'data-tangent-first': first ? `${first.type}:${first.id}` : '',
        'data-tangent-line-count': String(candidates.filter((item) => item.type === 'line').length),
        'data-tangent-circle-count': String(candidates.filter((item) => item.type === 'circle').length),
      }}
      onPoint={onPoint}
    >
      {candidates.map((candidate) => {
        const selected = first?.id === candidate.id;
        if (candidate.type === 'line') return (
          <line
            key={candidate.id}
            data-tangent-line-id={candidate.id}
            data-tangent-selected={selected ? 'true' : 'false'}
            x1={candidate.from[0]} y1={-candidate.from[1]} x2={candidate.to[0]} y2={-candidate.to[1]}
            vectorEffect="non-scaling-stroke"
            style={{ stroke: 'var(--cad-accent, #3467d6)', strokeWidth: selected ? 3 : 2, opacity: selected ? 1 : 0.35, pointerEvents: 'none' }}
          />
        );
        return (
          <circle
            key={candidate.id}
            data-tangent-circle-id={candidate.id}
            data-tangent-selected={selected ? 'true' : 'false'}
            cx={candidate.center[0]} cy={-candidate.center[1]} r={candidate.radius}
            vectorEffect="non-scaling-stroke"
            style={{ fill: 'none', stroke: 'var(--cad-accent, #3467d6)', strokeWidth: selected ? 3 : 2, opacity: selected ? 1 : 0.35, pointerEvents: 'none' }}
          />
        );
      })}
    </SketchInteractionSurface>
  );
}

function tangentCandidates(model: SketchOverlayModel | null): TangentCandidate[] {
  if (!model) return [];
  return model.entities.flatMap((entity): TangentCandidate[] => {
    if (entity.type === 'line') return [{ id: entity.id, type: 'line', from: entity.data.from, to: entity.data.to }];
    if (entity.type === 'circle') return [{ id: entity.id, type: 'circle', center: entity.data.center, radius: entity.data.diameter / 2 }];
    return [];
  });
}

function nearestCandidate(candidates: readonly TangentCandidate[], point: CadPoint2, radius: number): TangentCandidate | null {
  let best: TangentCandidate | null = null;
  let distance = radius;
  for (const candidate of candidates) {
    const next = candidate.type === 'line'
      ? pointSegmentDistance(point, candidate.from, candidate.to)
      : Math.abs(Math.hypot(point[0] - candidate.center[0], point[1] - candidate.center[1]) - candidate.radius);
    if (next <= distance) { best = candidate; distance = next; }
  }
  return best;
}

function pointSegmentDistance(point: CadPoint2, a: CadPoint2, b: CadPoint2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}
