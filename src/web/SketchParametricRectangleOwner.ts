import type { CadApplication } from '../contracts/application';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

export interface ParametricRectangleCommitResult {
  ok: boolean;
  error?: string;
}

/**
 * Numeric/driving Rectangle composition.
 *
 * The geometry command owns the four persisted Lines and their geometric
 * relations. This focused owner adds only the two driving dimensions.
 */
export async function commitParametricRectangle(
  app: CadApplication,
  sketchId: CadSketchId,
  width: number,
  height: number,
): Promise<ParametricRectangleCommitResult> {
  const rectangle = await app.execute({
    id: 'sketch.rectangle',
    payload: {
      sketchId,
      origin: [-width / 2, -height / 2],
      width,
      height,
    },
  });
  if (!rectangle.ok || !rectangle.createdIds || rectangle.createdIds.length !== 4) {
    return { ok: false, error: rectangle.error?.message ?? 'Не удалось создать прямоугольник' };
  }

  const edges = rectangle.createdIds as CadSketchEntityId[];
  const widthDimension = await app.execute({
    id: 'dimension.linear',
    payload: { sketchId, entityIds: [edges[0]], value: width, name: 'width' },
  });
  const heightDimension = await app.execute({
    id: 'dimension.linear',
    payload: { sketchId, entityIds: [edges[1]], value: height, name: 'height' },
  });
  if (!widthDimension.ok || !heightDimension.ok) {
    return {
      ok: false,
      error: widthDimension.error?.message ?? heightDimension.error?.message ?? 'Не удалось создать размеры',
    };
  }
  return { ok: true };
}
