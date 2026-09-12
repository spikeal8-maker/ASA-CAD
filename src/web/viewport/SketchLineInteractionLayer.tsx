import React, { useRef } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchLineDraft } from '../useSketchLineTool';
import type { SketchOverlayModel } from './SketchOverlayModel';
import {
  panSketchViewport,
  screenPointToSketchPoint,
  sketchDisplayFrame,
  zoomSketchViewport,
  type SketchDisplayFrame,
  type SketchScreenRect,
  type SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchLineInteractionLayerProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  draft: SketchLineDraft;
  committing?: boolean;
  onPointMove(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
}

interface ActiveTouch {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

interface GestureState {
  multiTouch: boolean;
  previousMidpoint: readonly [number, number] | null;
  previousDistance: number | null;
}

const TOUCH_TAP_THRESHOLD = 10;

/**
 * M3.2 central Sketch pointer surface for the direct Line vertical slice.
 *
 * Mouse uses direct click/hover semantics. Touch is arbitrated here: a single
 * tap is geometry input, while two or more contacts are navigation only. This
 * prevents pinch/pan contacts from becoming accidental Line endpoints while
 * keeping one Pointer Events path for the Sketch workplane.
 */
export function SketchLineInteractionLayer(props: SketchLineInteractionLayerProps) {
  const touchesRef = useRef(new Map<number, ActiveTouch>());
  const gestureRef = useRef<GestureState>({
    multiTouch: false,
    previousMidpoint: null,
    previousDistance: null,
  });
  if (!props.active || !props.model) return null;
  const phase = props.draft.from ? 'anchored' : 'awaiting-start';

  const screenRect = (node: SVGSVGElement): SketchScreenRect => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  const pointFromClient = (node: SVGSVGElement, clientX: number, clientY: number): CadPoint2 | null => (
    screenPointToSketchPoint(props.frame, screenRect(node), clientX, clientY)
  );

  const applyTouchNavigation = (node: SVGSVGElement) => {
    const points = [...touchesRef.current.values()];
    if (points.length < 2) return;
    const midpoint = averagePoint(points);
    const distance = touchDistance(points[0], points[1]);
    const previousMidpoint = gestureRef.current.previousMidpoint;
    const previousDistance = gestureRef.current.previousDistance;
    gestureRef.current.multiTouch = true;
    gestureRef.current.previousMidpoint = midpoint;
    gestureRef.current.previousDistance = distance;
    if (!previousMidpoint || !previousDistance || !(distance > 0)) return;

    const rect = screenRect(node);
    const deltaX = midpoint[0] - previousMidpoint[0];
    const deltaY = midpoint[1] - previousMidpoint[1];
    const zoomFactor = previousDistance / distance;

    props.onViewportStateChange((current) => {
      const panned = panSketchViewport(current, rect, deltaX, deltaY);
      const pannedFrame = sketchDisplayFrame(panned);
      const anchor = screenPointToSketchPoint(pannedFrame, rect, midpoint[0], midpoint[1]) ?? panned.center;
      return zoomSketchViewport(panned, zoomFactor, anchor);
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (props.committing) return;
    if (event.pointerType === 'touch') {
      const active = touchesRef.current.get(event.pointerId);
      if (!active) return;
      touchesRef.current.set(event.pointerId, { ...active, x: event.clientX, y: event.clientY });
      if (touchesRef.current.size >= 2) {
        event.preventDefault();
        applyTouchNavigation(event.currentTarget);
        return;
      }
      if (!props.draft.from) return;
      const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
      if (point) props.onPointMove(point);
      return;
    }

    if (!props.draft.from || event.buttons !== 0) return;
    const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
    if (point) props.onPointMove(point);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (props.committing) return;
    if (event.pointerType === 'touch') {
      touchesRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (touchesRef.current.size >= 2) {
        const points = [...touchesRef.current.values()];
        gestureRef.current = {
          multiTouch: true,
          previousMidpoint: averagePoint(points),
          previousDistance: touchDistance(points[0], points[1]),
        };
        event.preventDefault();
      }
      return;
    }

    if (event.button !== 0) return;
    const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.focus();
    void props.onPoint(point);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch') return;
    const active = touchesRef.current.get(event.pointerId);
    const wasMultiTouch = gestureRef.current.multiTouch;
    touchesRef.current.delete(event.pointerId);
    if (touchesRef.current.size < 2) {
      gestureRef.current.previousMidpoint = null;
      gestureRef.current.previousDistance = null;
    }
    if (touchesRef.current.size === 0) gestureRef.current.multiTouch = false;
    if (!active || wasMultiTouch || props.committing) return;

    const travel = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
    if (travel > TOUCH_TAP_THRESHOLD) return;
    const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
    if (point) void props.onPoint(point);
  };

  const handlePointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch') return;
    touchesRef.current.delete(event.pointerId);
    if (touchesRef.current.size === 0) {
      gestureRef.current = { multiTouch: false, previousMidpoint: null, previousDistance: null };
    }
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    const rect = screenRect(event.currentTarget);
    const anchor = screenPointToSketchPoint(props.frame, rect, event.clientX, event.clientY);
    if (!anchor) return;
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.0015);
    props.onViewportStateChange((current) => zoomSketchViewport(current, factor, anchor));
  };

  return (
    <svg
      className="cad-sketch-interaction"
      data-testid="cad-sketch-interaction"
      data-tool="line"
      data-line-phase={phase}
      data-sketch-id={props.model.sketchId}
      data-view-span={props.viewportState.span}
      data-view-center={props.viewportState.center.join(',')}
      viewBox={props.frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Построение отрезка"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
    >
      {props.draft.from && (
        <circle
          className="cad-sketch-line-anchor"
          data-testid="sketch-line-anchor"
          cx={props.draft.from[0]}
          cy={-props.draft.from[1]}
          r={0.9}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {props.draft.from && props.draft.to && (
        <line
          className="cad-sketch-line-ghost"
          data-testid="sketch-line-ghost"
          x1={props.draft.from[0]}
          y1={-props.draft.from[1]}
          x2={props.draft.to[0]}
          y2={-props.draft.to[1]}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function averagePoint(points: readonly ActiveTouch[]): readonly [number, number] {
  const sum = points.reduce((value, point) => [value[0] + point.x, value[1] + point.y] as const, [0, 0] as const);
  return [sum[0] / points.length, sum[1] / points.length];
}

function touchDistance(a: ActiveTouch, b: ActiveTouch): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
