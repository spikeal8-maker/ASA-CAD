import type { CadPoint2, CadSketchEntity } from '../../contracts/document';

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

/** Shared viewBox policy for persisted/solver Sketch geometry and M3 interaction. */
export function sketchDisplayFrame(entities: readonly CadSketchEntity[]): SketchDisplayFrame {
  if (entities.length === 0) return frameFromBounds(-10, -10, 10, 10);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const entity of entities) {
    if (entity.type === 'line') {
      include(entity.data.from[0], -entity.data.from[1]);
      include(entity.data.to[0], -entity.data.to[1]);
      continue;
    }
    const radius = entity.data.diameter / 2;
    const x = entity.data.center[0];
    const y = -entity.data.center[1];
    include(x - radius, y - radius);
    include(x + radius, y + radius);
  }

  return frameFromBounds(minX, minY, maxX, maxY);
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

function frameFromBounds(minX: number, minY: number, maxX: number, maxY: number): SketchDisplayFrame {
  const rawWidth = Math.max(maxX - minX, 1);
  const rawHeight = Math.max(maxY - minY, 1);
  const padding = Math.max(Math.max(rawWidth, rawHeight) * 0.08, 1);
  const paddedMinX = minX - padding;
  const paddedMinY = minY - padding;
  const width = rawWidth + padding * 2;
  const height = rawHeight + padding * 2;
  return {
    minX: paddedMinX,
    minY: paddedMinY,
    maxX: paddedMinX + width,
    maxY: paddedMinY + height,
    width,
    height,
    viewBox: [paddedMinX, paddedMinY, width, height].join(' '),
  };
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
