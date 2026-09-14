import type { CadCommandId } from '../../contracts/commands';
import type { CadPartDocument, CadSketch } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import {
  isZeroSketchDelta,
  translateSketchEntity,
  validateSketchDelta,
} from '../SketchEntityTransform';
import {
  defineSketchCommandHandler,
  requireSketch,
  requireSketchAvailability,
  requireSketchEntity,
  type SketchCommandHandlerMap,
} from './SketchCommandHandlerShared';

export const SKETCH_EDIT_COMMAND_IDS = [
  'sketch.entity.delete',
  'sketch.entity.translate',
  'sketch.finish',
] as const satisfies readonly CadCommandId[];

export type SketchEditCommandId = typeof SKETCH_EDIT_COMMAND_IDS[number];

export const sketchEditCommandHandlers = {
  'sketch.entity.delete': defineSketchCommandHandler<'sketch.entity.delete'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      requireSketchEntity(sketch, command.payload.entityId);
      deleteSketchEntityWithDependencies(part, sketch, command.payload.entityId);
      return { ok: true, changed: true };
    },
  }),

  'sketch.entity.translate': defineSketchCommandHandler<'sketch.entity.translate'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      validateSketchDelta(command.payload.delta);
      const sketch = requireSketch(part, command.payload.sketchId);
      const entity = requireSketchEntity(sketch, command.payload.entityId);
      const fixed = part.constraints.some((constraint) => (
        constraint.type === 'fixed'
        && sketch.constraintIds.includes(constraint.id)
        && constraint.entityIds[0] === entity.id
      ));
      if (fixed) throw new Error('Fixed sketch entity cannot be translated');
      if (isZeroSketchDelta(command.payload.delta)) return { ok: true, changed: false };
      const index = sketch.entities.findIndex((item) => item.id === entity.id);
      sketch.entities[index] = translateSketchEntity(entity, command.payload.delta);
      return { ok: true, changed: true };
    },
  }),

  'sketch.finish': defineSketchCommandHandler<'sketch.finish'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      requireSketch(part, command.payload.sketchId);
      return { ok: true, changed: false };
    },
  }),
} satisfies SketchCommandHandlerMap<SketchEditCommandId>;

function deleteSketchEntityWithDependencies(
  part: CadPartDocument,
  sketch: CadSketch,
  entityId: CadSketchEntityId,
): void {
  const constraintIds = new Set(
    part.constraints
      .filter((constraint) => sketch.constraintIds.includes(constraint.id) && constraint.entityIds.includes(entityId))
      .map((constraint) => constraint.id),
  );
  const dimensionIds = new Set(
    part.dimensions
      .filter((dimension) => sketch.dimensionIds.includes(dimension.id) && dimension.entityIds.includes(entityId))
      .map((dimension) => dimension.id),
  );

  sketch.entities = sketch.entities.filter((entity) => entity.id !== entityId);
  sketch.constraintIds = sketch.constraintIds.filter((id) => !constraintIds.has(id));
  sketch.dimensionIds = sketch.dimensionIds.filter((id) => !dimensionIds.has(id));
  part.constraints = part.constraints.filter((constraint) => !constraintIds.has(constraint.id));
  part.dimensions = part.dimensions.filter((dimension) => !dimensionIds.has(dimension.id));
}
