import type { CadDocument, CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

export function partDocument(document: Readonly<CadDocument>): Readonly<CadPartDocument> | null {
  return document.kind === 'part' ? document : null;
}

export function findSketch(
  part: Readonly<CadPartDocument> | null,
  sketchId: CadSketchId | null,
): Readonly<CadSketch> | null {
  if (!part || !sketchId) return null;
  return part.sketches.find((item) => item.id === sketchId) ?? null;
}

export function hasRectangle(sketch: Readonly<CadSketch> | null): boolean {
  return Boolean(
    sketch?.entities.filter(
      (entity) => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'),
    ).length === 4,
  );
}

export function hasCircle(sketch: Readonly<CadSketch> | null): boolean {
  return Boolean(sketch?.entities.some((entity) => entity.type === 'circle'));
}

export { dimensionLabel } from './SketchDimensionPresentation';
