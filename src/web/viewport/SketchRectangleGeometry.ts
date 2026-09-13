import type { CadPoint2 } from '../../contracts/document';

const MIN_SIZE = 1e-6;

export interface SketchRectangleGeometry {
  origin: readonly [number, number];
  width: number;
  height: number;
}

/** Canonicalizes arbitrary first/opposite corner order into positive geometry. */
export function canonicalSketchRectangle(
  first: CadPoint2,
  opposite: CadPoint2,
): SketchRectangleGeometry | null {
  const width = Math.abs(opposite[0] - first[0]);
  const height = Math.abs(opposite[1] - first[1]);
  if (!(width > MIN_SIZE) || !(height > MIN_SIZE)) return null;
  return {
    origin: [Math.min(first[0], opposite[0]), Math.min(first[1], opposite[1])] as const,
    width,
    height,
  };
}
