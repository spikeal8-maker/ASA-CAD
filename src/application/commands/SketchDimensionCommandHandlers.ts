import type { CadCommandId } from '../../contracts/commands';
import type { CadDimension } from '../../contracts/document';
import type { CadDimensionId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import {
  ENABLED,
  NO_DRIVING_DIMENSIONS,
  defineSketchCommandHandler,
  requireSketch,
  requireSketchAvailability,
  requireSketchEntity,
  type SketchCommandHandlerMap,
} from './SketchCommandHandlerShared';

export const SKETCH_DIMENSION_COMMAND_IDS = [
  'dimension.linear',
  'dimension.diameter',
  'part.dimension.setValue',
] as const satisfies readonly CadCommandId[];

export type SketchDimensionCommandId = typeof SKETCH_DIMENSION_COMMAND_IDS[number];

export const sketchDimensionCommandHandlers = {
  'dimension.linear': defineSketchCommandHandler<'dimension.linear'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.value <= 0) throw new Error('Dimension value must be positive');
      const [firstEntityId, ...remainingEntityIds] = command.payload.entityIds;
      if (!firstEntityId) throw new Error('Linear dimension requires at least one entity');
      for (const entityId of command.payload.entityIds) requireSketchEntity(sketch, entityId);
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'linear',
        entityIds: [firstEntityId, ...remainingEntityIds],
        value: command.payload.value,
        driving: true,
        name: command.payload.name,
      };
      part.dimensions.push(dimension);
      sketch.dimensionIds.push(id);
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'dimension.diameter': defineSketchCommandHandler<'dimension.diameter'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.value <= 0) throw new Error('Diameter must be positive');
      requireSketchEntity(sketch, command.payload.entityId);
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'diameter',
        entityIds: [command.payload.entityId],
        value: command.payload.value,
        driving: true,
        name: command.payload.name,
      };
      part.dimensions.push(dimension);
      sketch.dimensionIds.push(id);
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'part.dimension.setValue': defineSketchCommandHandler<'part.dimension.setValue'>({
    availability: (part) => part.dimensions.length > 0 ? ENABLED : NO_DRIVING_DIMENSIONS,
    execute: (part, command) => {
      if (command.payload.value <= 0) throw new Error('Driving dimension value must be positive');
      const dimension = part.dimensions.find((item) => item.id === command.payload.dimensionId);
      if (!dimension) throw new Error(`Unknown dimension: ${command.payload.dimensionId}`);
      if (!dimension.driving) throw new Error(`Dimension is not driving: ${command.payload.dimensionId}`);
      dimension.value = command.payload.value;
      return { ok: true, changed: true };
    },
  }),
} satisfies SketchCommandHandlerMap<SketchDimensionCommandId>;
