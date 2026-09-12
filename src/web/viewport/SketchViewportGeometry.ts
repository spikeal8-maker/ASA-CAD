import type { CadPoint2 } from '../../contracts/document';

export interface SketchViewportState {
  center: CadPoint2;
  /** Visible Sketch width/height in local units. Kept square for deterministic SVG mapping. */
  span: number;
}

export interface SketchDisplayFrame {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  viewBox: string;
}

export interface SketchScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const DEFAULT_SKETCH_VIEWPORT_STATE: SketchViewportState = {
  center: [0, 0],
  span: 100,
};

const MIN_SPAN = 2;
const MAX_SPAN = 100_000;

/**
 * Stable transient Sketch camera. Geometry commits never refit this frame, so
 * direct drawing can extend beyond existing entity bounds without view jumps.
 */
export function sketchDisplayFrame(state: SketchViewportState): SketchDisplayFrame {
  const span = clampSpan(state.span);
  const minX = state.center[0] - span / 2;
  const minY = -state.center[1] - span / 2;
  return {
    minX,
    minY,
    maxX: minX + span,
    maxY: minY + span,
    width: span,
    height: span,
    viewBox: [minX, minY, span, span].join(' '),
  };
}

/**
 * Converts a browser pointer to local Sketch coordinates for SVG
 * preserveAspectRatio="xMidYMid meet". Returns null for letterbox space.
 */
export function screenPointToSketchPoint(
  frame: SketchDisplayFrame,
  rect: SketchScreenRect,
  clientX: number,
  clientY: number,
): CadPoint2 | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const scale = Math.min(rect.width / frame.width, rect.height / frame.height);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;

  const renderedWidth = frame.width * scale;
  const renderedHeight = frame.height * scale;
  const offsetX = rect.left + (rect.width - renderedWidth) / 2;
  const offsetY = rect.top + (rect.height - renderedHeight) / 2;
  const localX = clientX - offsetX;
  const localY = clientY - offsetY;
  if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) return null;

  const svgX = frame.minX + localX / scale;
  const svgY = frame.minY + localY / scale;
  return [normalizeSignedZero(svgX), normalizeSignedZero(-svgY)];
}

export function panSketchViewport(
  state: SketchViewportState,
  rect: SketchScreenRect,
  deltaClientX: number,
  deltaClientY: number,
): SketchViewportState {
  const frame = sketchDisplayFrame(state);
  const scale = Math.min(rect.width / frame.width, rect.height / frame.height);
  if (!(scale > 0) || !Number.isFinite(scale)) return state;
  return {
    center: [
      normalizeSignedZero(state.center[0] - deltaClientX / scale),
      normalizeSignedZero(state.center[1] + deltaClientY / scale),
    ],
    span: state.span,
  };
}

/** Zoom around a Sketch-space anchor while keeping that point visually fixed. */
export function zoomSketchViewport(
  state: SketchViewportState,
  factor: number,
  anchor: CadPoint2,
): SketchViewportState {
  if (!(factor > 0) || !Number.isFinite(factor)) return state;
  const nextSpan = clampSpan(state.span * factor);
  const applied = nextSpan / state.span;
  return {
    center: [
      normalizeSignedZero(anchor[0] + (state.center[0] - anchor[0]) * applied),
      normalizeSignedZero(anchor[1] + (state.center[1] - anchor[1]) * applied),
    ],
    span: nextSpan,
  };
}

export function resetSketchViewportState(): SketchViewportState {
  return {
    center: [...DEFAULT_SKETCH_VIEWPORT_STATE.center] as CadPoint2,
    span: DEFAULT_SKETCH_VIEWPORT_STATE.span,
  };
}

function clampSpan(value: number): number {
  return Math.min(Math.max(value, MIN_SPAN), MAX_SPAN);
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
