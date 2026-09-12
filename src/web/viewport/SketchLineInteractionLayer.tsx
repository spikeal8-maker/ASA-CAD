import React, { useEffect, useState } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import {
  clientPointToSketch,
  sketchPointDistance,
  sketchPointToSvg,
  sketchWorkplaneViewBox,
} from './SketchWorkplane';

export interface SketchLineInteractionLayerProps {
  active: boolean;
  onCommit(from: CadPoint2, to: CadPoint2): Promise<boolean> | boolean;
}

/**
 * Transient direct-Line interaction. It never mutates CadDocument; the second
 * point delegates one normal typed `sketch.line` mutation back to CadApplication.
 */
export function SketchLineInteractionLayer({ active, onCommit }: SketchLineInteractionLayerProps) {
  const [start, setStart] = useState<CadPoint2 | null>(null);
  const [pointer, setPointer] = useState<CadPoint2 | null>(null);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (!active) {
      setStart(null);
      setPointer(null);
      setCommitting(false);
    }
  }, [active]);

  if (!active) return null;

  const previewEnd = pointer ?? start;
  const preview = start && previewEnd ? [sketchPointToSvg(start), sketchPointToSvg(previewEnd)] as const : null;

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>) =>
    clientPointToSketch(event.currentTarget, event.clientX, event.clientY);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!start || committing) return;
    const next = pointFromEvent(event);
    if (next) setPointer(next);
  };

  const handlePointerDown = async (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || committing) return;
    const next = pointFromEvent(event);
    if (!next) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (!start) {
      setStart(next);
      setPointer(next);
      return;
    }

    if (sketchPointDistance(start, next) < 0.01) return;
    setCommitting(true);
    try {
      const committed = await onCommit(start, next);
      if (committed) {
        setStart(null);
        setPointer(null);
      }
    } finally {
      setCommitting(false);
    }
  };

  return (
    <svg
      className="cad-sketch-interaction-layer line-tool"
      data-testid="sketch-line-interaction-layer"
      data-line-state={start ? 'awaiting-second-point' : 'awaiting-first-point'}
      viewBox={sketchWorkplaneViewBox()}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={(event) => { void handlePointerDown(event); }}
      onPointerMove={handlePointerMove}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Построение отрезка"
    >
      {preview && (
        <line
          className="cad-sketch-line-ghost"
          data-testid="sketch-line-ghost"
          x1={preview[0][0]}
          y1={preview[0][1]}
          x2={preview[1][0]}
          y2={preview[1][1]}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {start && (
        <circle
          className="cad-sketch-line-anchor"
          data-testid="sketch-line-anchor"
          cx={sketchPointToSvg(start)[0]}
          cy={sketchPointToSvg(start)[1]}
          r={1.6}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
