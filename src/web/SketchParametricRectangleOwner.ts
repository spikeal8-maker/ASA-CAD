import type { CadApplication } from '../contracts/application';
import type { CadCommand } from '../contracts/commands';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

export interface ParametricRectangleCommitResult {
  ok: boolean;
  error?: string;
}

/**
 * Numeric/driving Rectangle composition.
 *
 * The geometry command owns the four persisted Lines. This focused owner adds
 * only the existing geometric relations and the two existing driving
 * dimensions required for that contour to solve as one rectangle.
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
  const relations: CadCommand[] = [
    { id: 'constraint.horizontal', payload: { sketchId, entityId: edges[0] } },
    { id: 'constraint.vertical', payload: { sketchId, entityId: edges[1] } },
    { id: 'constraint.horizontal', payload: { sketchId, entityId: edges[2] } },
    { id: 'constraint.vertical', payload: { sketchId, entityId: edges[3] } },
    { id: 'constraint.coincident', payload: { sketchId, a: { entityId: edges[0], point: 'b' }, b: { entityId: edges[1], point: 'a' } } },
    { id: 'constraint.coincident', payload: { sketchId, a: { entityId: edges[1], point: 'b' }, b: { entityId: edges[2], point: 'a' } } },
    { id: 'constraint.coincident', payload: { sketchId, a: { entityId: edges[2], point: 'b' }, b: { entityId: edges[3], point: 'a' } } },
    { id: 'constraint.coincident', payload: { sketchId, a: { entityId: edges[3], point: 'b' }, b: { entityId: edges[0], point: 'a' } } },
  ];
  for (const command of relations) {
    const result = await app.execute(command);
    if (!result.ok) return { ok: false, error: result.error?.message ?? 'Не удалось связать прямоугольник' };
  }

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
