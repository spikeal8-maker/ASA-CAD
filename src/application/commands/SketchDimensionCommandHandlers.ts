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
  'dimension.horizontal',
  'dimension.vertical',
  'dimension.diameter',
  'dimension.radius',
  'dimension.angular',
  'part.dimension.setValue',
] as const satisfies readonly CadCommandId[];

export type SketchDimensionCommandId = typeof SKETCH_DIMENSION_COMMAND_IDS[number];

export const sketchDimensionCommandHandlers = {
  'dimension.linear': defineSketchCommandHandler<'dimension.linear'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Linear dimension value must be positive finite');
      }
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

  'dimension.horizontal': defineSketchCommandHandler<'dimension.horizontal'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const entity = requireSketchEntity(sketch, command.payload.entityId);
      if (entity.type !== 'line') {
        throw new Error(`Horizontal dimension requires a Line entity, got ${entity.type}`);
      }
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Horizontal dimension value must be positive');
      }
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'horizontal',
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

  'dimension.vertical': defineSketchCommandHandler<'dimension.vertical'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const entity = requireSketchEntity(sketch, command.payload.entityId);
      if (entity.type !== 'line') {
        throw new Error(`Vertical dimension requires a Line entity, got ${entity.type}`);
      }
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Vertical dimension value must be positive');
      }
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'vertical',
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

  'dimension.diameter': defineSketchCommandHandler<'dimension.diameter'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const entity = requireSketchEntity(sketch, command.payload.entityId);
      if (entity.type !== 'circle') {
        throw new Error(`Diameter dimension requires a Circle entity, got ${entity.type}`);
      }
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Diameter must be positive finite');
      }
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

  'dimension.radius': defineSketchCommandHandler<'dimension.radius'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const entity = requireSketchEntity(sketch, command.payload.entityId);
      if (entity.type !== 'circle' && entity.type !== 'arc') {
        throw new Error(`Radius dimension requires a Circle or Arc entity, got ${entity.type}`);
      }
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Radius dimension value must be positive finite');
      }
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'radius',
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

  'dimension.angular': defineSketchCommandHandler<'dimension.angular'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.aEntityId === command.payload.bEntityId) {
        throw new Error('Angular dimension requires two distinct Line entities');
      }
      const a = requireSketchEntity(sketch, command.payload.aEntityId);
      const b = requireSketchEntity(sketch, command.payload.bEntityId);
      if (a.type !== 'line' || b.type !== 'line') {
        throw new Error(`Angular dimension requires two Line entities, got ${a.type} and ${b.type}`);
      }
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0 || command.payload.value >= 180) {
        throw new Error('Angular dimension value must be finite and between 0 and 180 degrees');
      }
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'angular',
        entityIds: [command.payload.aEntityId, command.payload.bEntityId],
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
      const dimension = part.dimensions.find((item) => item.id === command.payload.dimensionId);
      if (!dimension) throw new Error(`Unknown dimension: ${command.payload.dimensionId}`);
      if (!dimension.driving) throw new Error(`Dimension is not driving: ${command.payload.dimensionId}`);
      if (!Number.isFinite(command.payload.value) || command.payload.value <= 0) {
        throw new Error('Driving dimension value must be positive finite');
      }
      if (dimension.type === 'angular' && command.payload.value >= 180) {
        throw new Error('Angular dimension value must be less than 180 degrees');
      }
      dimension.value = command.payload.value;
      return { ok: true, changed: true };
    },
  }),
} satisfies SketchCommandHandlerMap<SketchDimensionCommandId>;
