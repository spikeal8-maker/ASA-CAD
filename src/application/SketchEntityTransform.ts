import type {
  CadPartDocument,
  CadPoint2,
  CadSketch,
  CadSketchEntity,
} from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

export type CadSketchDelta = readonly [number, number];

export function validateSketchDelta(delta: CadSketchDelta): void {
  if (!Number.isFinite(delta[0]) || !Number.isFinite(delta[1])) {
    throw new Error('Sketch entity translation delta must be finite');
  }
}

export function isZeroSketchDelta(delta: CadSketchDelta, epsilon = 1e-9): boolean {
  return Math.abs(delta[0]) <= epsilon && Math.abs(delta[1]) <= epsilon;
}

/** Rigidly translate one persisted Sketch entity without changing its stable ID or metadata. */
export function translateSketchEntity(
  entity: Readonly<CadSketchEntity>,
  delta: CadSketchDelta,
): CadSketchEntity {
  validateSketchDelta(delta);
  const translate = (point: CadPoint2): CadPoint2 => [point[0] + delta[0], point[1] + delta[1]];

  switch (entity.type) {
    case 'line':
      return {
        id: entity.id,
        type: 'line',
        data: {
          ...entity.data,
          from: translate(entity.data.from),
          to: translate(entity.data.to),
        },
      };
    case 'circle':
      return {
        id: entity.id,
        type: 'circle',
        data: {
          ...entity.data,
          center: translate(entity.data.center),
        },
      };
    case 'arc':
      return {
        id: entity.id,
        type: 'arc',
        data: {
          ...entity.data,
          center: translate(entity.data.center),
        },
      };
  }
}

/**
 * Build a transient Part candidate for PlaneGCS preview.
 * Unchanged document collections remain shared read-only inputs; only the
 * selected Sketch/entity path is copied and translated.
 */
export function buildSketchTranslationCandidate(
  part: Readonly<CadPartDocument>,
  sketchId: CadSketchId,
  entityId: CadSketchEntityId,
  delta: CadSketchDelta,
): CadPartDocument {
  validateSketchDelta(delta);
  let foundSketch = false;
  let foundEntity = false;

  const sketches = part.sketches.map((sketch): CadSketch => {
    if (sketch.id !== sketchId) return sketch;
    foundSketch = true;
    const entities = sketch.entities.map((entity) => {
      if (entity.id !== entityId) return entity;
      foundEntity = true;
      return translateSketchEntity(entity, delta);
    });
    return { ...sketch, entities };
  });

  if (!foundSketch) throw new Error(`Unknown sketch: ${sketchId}`);
  if (!foundEntity) throw new Error(`Unknown sketch entity: ${entityId}`);

  return {
    ...part,
    sketches,
  };
}
