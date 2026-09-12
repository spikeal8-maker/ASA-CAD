import React, { useRef } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import {
  panSketchViewport,
  screenPointToSketchPoint,
  sketchDisplayFrame,
  zoomSketchViewport,
  type SketchDisplayFrame,
  type SketchScreenRect,
  type SketchViewportState,
} from './SketchViewportGeometry';

export interface SketchInteractionSurfaceProps {
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  active: boolean;
  committing?: boolean;
  tool: string;
  phase?: string;
  ariaLabel: string;
  onPointMove?(point: CadPoint2): void;
  onPoint(point: CadPoint2): void | Promise<void>;
  children?: React.ReactNode;
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
 * Shared pointer/touch/navigation substrate for direct Sketch tools.
 *
 * Tool-specific layers own only their draft/ghost semantics. This surface owns
 * coordinate conversion, mouse taps, touch tap arbitration, two-finger
 * pan/pinch and wheel zoom so Line/Circle/Arc/Rectangle cannot drift into
 * separate input implementations.
 */
export function SketchInteractionSurface(props: SketchInteractionSurfaceProps) {
  const touchesRef = useRef(new Map<number, ActiveTouch>());
  const gestureRef = useRef<GestureState>({
    multiTouch: false,
    previousMidpoint: null,
    previousDistance: null,
  });

  if (!props.active) return null;

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
      const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
      if (point) props.onPointMove?.(point);
      return;
    }

    if (event.buttons !== 0) return;
    const point = pointFromClient(event.currentTarget, event.clientX, event.clientY);
    if (point) props.onPointMove?.(point);
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
      data-tool={props.tool}
      data-tool-phase={props.phase ?? ''}
      viewBox={props.frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label={props.ariaLabel}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
    >
      {props.children}
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
