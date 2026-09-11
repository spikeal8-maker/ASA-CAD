import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
  CadSketchCommandReference,
} from '../../contracts/commands';
import type {
  CadConstraint,
  CadDimension,
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
} from '../../contracts/document';
import type {
  CadConstraintId,
  CadDimensionId,
  CadSketchEntityId,
  CadSketchId,
} from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';

export const SKETCH_GROWTH_COMMAND_IDS = [
  'sketch.create',
  'sketch.line',
  'sketch.rectangle',
  'sketch.circle',
  'sketch.finish',
  'constraint.coincident',
  'constraint.horizontal',
  'constraint.vertical',
  'constraint.fixed',
  'dimension.linear',
  'dimension.diameter',
  'part.dimension.setValue',
] as const satisfies readonly CadCommandId[];

export type SketchGrowthCommandId = typeof SKETCH_GROWTH_COMMAND_IDS[number];
export type SketchGrowthCommand = Extract<CadCommand, { id: SketchGrowthCommandId }>;

type CommandFor<K extends SketchGrowthCommandId> = Extract<CadCommand, { id: K }>;

interface SketchGrowthCommandHandler<K extends SketchGrowthCommandId> {
  availability(part: CadPartDocument): CadCommandAvailability;
  execute(part: CadPartDocument, command: CommandFor<K>): CadCommandResult;
}

type SketchGrowthHandlerRegistry = {
  [K in SketchGrowthCommandId]: SketchGrowthCommandHandler<K>;
};

function handler<K extends SketchGrowthCommandId>(
  definition: SketchGrowthCommandHandler<K>,
): SketchGrowthCommandHandler<K> {
  return definition;
}

const ENABLED: CadCommandAvailability = { enabled: true };
const CREATE_SKETCH_FIRST: CadCommandAvailability = { enabled: false, reason: 'Create a sketch first' };
const NO_DRIVING_DIMENSIONS: CadCommandAvailability = { enabled: false, reason: 'No driving dimensions exist' };

function requireSketchAvailability(part: CadPartDocument): CadCommandAvailability {
  return part.sketches.length > 0 ? ENABLED : CREATE_SKETCH_FIRST;
}

const HANDLERS = {
  'sketch.create': handler<'sketch.create'>({
    availability: () => ENABLED,
    execute: (part, command) => {
      const id = createCadId<CadSketchId>('sketch');
      const sketch: CadSketch = {
        id,
        name: command.payload.name ?? `Эскиз ${part.sketches.length + 1}`,
        support: String(command.payload.support),
        entities: [],
        constraintIds: [],
        dimensionIds: [],
      };
      part.sketches.push(sketch);
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.line': handler<'sketch.line'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'line',
        data: { from: command.payload.from, to: command.payload.to },
      });
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.rectangle': handler<'sketch.rectangle'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const { origin: [x, y], width, height } = command.payload;
      if (width <= 0 || height <= 0) throw new Error('Rectangle width/height must be positive');
      const points = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ] as const;
      const ids: CadSketchEntityId[] = [];
      for (let index = 0; index < 4; index++) {
        const id = createCadId<CadSketchEntityId>('entity');
        const entity: CadSketchEntity = {
          id,
          type: 'line',
          data: { from: points[index], to: points[(index + 1) % 4], role: `rectangle-edge-${index}` },
        };
        sketch.entities.push(entity);
        ids.push(id);
      }
      return { ok: true, changed: true, createdIds: ids };
    },
  }),

  'sketch.circle': handler<'sketch.circle'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.diameter <= 0) throw new Error('Circle diameter must be positive');
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'circle',
        data: { center: command.payload.center, diameter: command.payload.diameter },
      });
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.finish': handler<'sketch.finish'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      requireSketch(part, command.payload.sketchId);
      return { ok: true, changed: false };
    },
  }),

  'constraint.horizontal': handler<'constraint.horizontal'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addUnaryConstraint(
      part,
      command.payload.sketchId,
      'horizontal',
      command.payload.entityId,
    ),
  }),

  'constraint.vertical': handler<'constraint.vertical'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addUnaryConstraint(
      part,
      command.payload.sketchId,
      'vertical',
      command.payload.entityId,
    ),
  }),

  'constraint.fixed': handler<'constraint.fixed'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addUnaryConstraint(
      part,
      command.payload.sketchId,
      'fixed',
      command.payload.entityId,
    ),
  }),

  'constraint.coincident': handler<'constraint.coincident'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addCoincidentConstraint(
      part,
      command.payload.sketchId,
      [command.payload.a, command.payload.b],
    ),
  }),

  'dimension.linear': handler<'dimension.linear'>({
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

  'dimension.diameter': handler<'dimension.diameter'>({
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

  'part.dimension.setValue': handler<'part.dimension.setValue'>({
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
} satisfies SketchGrowthHandlerRegistry;

const COMMAND_IDS = new Set<string>(SKETCH_GROWTH_COMMAND_IDS);

export function isSketchGrowthCommandId(id: CadCommandId): id is SketchGrowthCommandId {
  return COMMAND_IDS.has(id);
}

export function isSketchGrowthCommand(command: CadCommand): command is SketchGrowthCommand {
  return isSketchGrowthCommandId(command.id);
}

export function getSketchGrowthCommandAvailability(
  part: CadPartDocument,
  id: SketchGrowthCommandId,
): CadCommandAvailability {
  return HANDLERS[id].availability(part);
}

export function applySketchGrowthCommand(
  part: CadPartDocument,
  command: SketchGrowthCommand,
): CadCommandResult {
  switch (command.id) {
    case 'sketch.create':
      return HANDLERS['sketch.create'].execute(part, command);
    case 'sketch.line':
      return HANDLERS['sketch.line'].execute(part, command);
    case 'sketch.rectangle':
      return HANDLERS['sketch.rectangle'].execute(part, command);
    case 'sketch.circle':
      return HANDLERS['sketch.circle'].execute(part, command);
    case 'sketch.finish':
      return HANDLERS['sketch.finish'].execute(part, command);
    case 'constraint.coincident':
      return HANDLERS['constraint.coincident'].execute(part, command);
    case 'constraint.horizontal':
      return HANDLERS['constraint.horizontal'].execute(part, command);
    case 'constraint.vertical':
      return HANDLERS['constraint.vertical'].execute(part, command);
    case 'constraint.fixed':
      return HANDLERS['constraint.fixed'].execute(part, command);
    case 'dimension.linear':
      return HANDLERS['dimension.linear'].execute(part, command);
    case 'dimension.diameter':
      return HANDLERS['dimension.diameter'].execute(part, command);
    case 'part.dimension.setValue':
      return HANDLERS['part.dimension.setValue'].execute(part, command);
  }

  const exhaustive: never = command;
  return exhaustive;
}

function addUnaryConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  type: 'horizontal' | 'vertical' | 'fixed',
  entityId: CadSketchEntityId,
): CadCommandResult {
  const id = createCadId<CadConstraintId>('constraint');
  let constraint: CadConstraint;
  switch (type) {
    case 'horizontal':
      constraint = { id, type, entityIds: [entityId] };
      break;
    case 'vertical':
      constraint = { id, type, entityIds: [entityId] };
      break;
    case 'fixed':
      constraint = { id, type, entityIds: [entityId] };
      break;
  }
  return persistConstraint(part, sketchId, constraint);
}

function addCoincidentConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  refs: [CadSketchCommandReference, CadSketchCommandReference],
): CadCommandResult {
  const id = createCadId<CadConstraintId>('constraint');
  const constraint: CadConstraint = {
    id,
    type: 'coincident',
    entityIds: [refs[0].entityId, refs[1].entityId],
    data: {
      refs: [{ ...refs[0] }, { ...refs[1] }],
    },
  };
  return persistConstraint(part, sketchId, constraint);
}

function persistConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  constraint: CadConstraint,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  for (const entityId of constraint.entityIds) requireSketchEntity(sketch, entityId);
  part.constraints.push(constraint);
  sketch.constraintIds.push(constraint.id);
  return { ok: true, changed: true, createdIds: [constraint.id] };
}

function requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {
  const sketch = part.sketches.find((item) => item.id === id);
  if (!sketch) throw new Error(`Unknown sketch: ${id}`);
  return sketch;
}

function requireSketchEntity(sketch: CadSketch, id: CadSketchEntityId): CadSketchEntity {
  const entity = sketch.entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Unknown sketch entity: ${id}`);
  return entity;
}
