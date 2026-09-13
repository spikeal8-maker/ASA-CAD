import type { CadPoint2, CadSketchEntity } from '../contracts/document';

export type CadSketchTranslationDelta = readonly [number, number];

/**
 * Pure rigid translation for the current persisted Sketch entity DTO surface.
 * Stable entity identity and metadata/role are preserved exactly.
 */
export function translateSketchEntity(
  entity: Readonly<CadSketchEntity>,
  delta: CadSketchTranslationDelta,
): CadSketchEntity {
  const [dx, dy] = delta;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new Error('Sketch translation delta must be finite');
  }

  switch (entity.type) {
    case 'line':
      return {
        ...entity,
        data: {
          ...entity.data,
          from: translatePoint(entity.data.from, delta),
          to: translatePoint(entity.data.to, delta),
        },
      };
    case 'circle':
      return {
        ...entity,
        data: {
          ...entity.data,
          center: translatePoint(entity.data.center, delta),
        },
      };
    case 'arc':
      return {
        ...entity,
        data: {
          ...entity.data,
          center: translatePoint(entity.data.center, delta),
        },
      };
  }
}

export function translateSketchEntitiesCandidate(
  entities: readonly CadSketchEntity[],
  entityId: CadSketchEntity['id'],
  delta: CadSketchTranslationDelta,
): CadSketchEntity[] {
  let found = false;
  const translated = entities.map((entity) => {
    if (entity.id !== entityId) return structuredClone(entity);
    found = true;
    return translateSketchEntity(entity, delta);
  });
  if (!found) throw new Error(`Unknown sketch entity: ${entityId}`);
  return translated;
}

export function isZeroSketchTranslation(delta: CadSketchTranslationDelta, tolerance = 1e-9): boolean {
  return Math.abs(delta[0]) <= tolerance && Math.abs(delta[1]) <= tolerance;
}

function translatePoint(point: CadPoint2, delta: CadSketchTranslationDelta): CadPoint2 {
  return [point[0] + delta[0], point[1] + delta[1]];
}
