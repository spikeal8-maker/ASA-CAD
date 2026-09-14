import type {
  CadCommandId,
  CadCommandResult,
  CadSketchCommandReference,
} from '../../contracts/commands';
import type { CadConstraint, CadPartDocument } from '../../contracts/document';
import type {
  CadConstraintId,
  CadSketchEntityId,
  CadSketchId,
} from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import {
  defineSketchCommandHandler,
  requireSketch,
  requireSketchAvailability,
  requireSketchEntity,
  type SketchCommandHandlerMap,
} from './SketchCommandHandlerShared';

export const SKETCH_CONSTRAINT_COMMAND_IDS = [
  'constraint.coincident',
  'constraint.horizontal',
  'constraint.vertical',
  'constraint.fixed',
] as const satisfies readonly CadCommandId[];

export type SketchConstraintCommandId = typeof SKETCH_CONSTRAINT_COMMAND_IDS[number];

type CadOrientationConstraintType = 'horizontal' | 'vertical';

export const sketchConstraintCommandHandlers = {
  'constraint.horizontal': defineSketchCommandHandler<'constraint.horizontal'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addLineOrientationConstraint(
      part,
      command.payload.sketchId,
      'horizontal',
      command.payload.entityId,
    ),
  }),

  'constraint.vertical': defineSketchCommandHandler<'constraint.vertical'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addLineOrientationConstraint(
      part,
      command.payload.sketchId,
      'vertical',
      command.payload.entityId,
    ),
  }),

  'constraint.fixed': defineSketchCommandHandler<'constraint.fixed'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addUnaryConstraint(
      part,
      command.payload.sketchId,
      'fixed',
      command.payload.entityId,
    ),
  }),

  'constraint.coincident': defineSketchCommandHandler<'constraint.coincident'>({
    availability: requireSketchAvailability,
    execute: (part, command) => addCoincidentConstraint(
      part,
      command.payload.sketchId,
      [command.payload.a, command.payload.b],
    ),
  }),
} satisfies SketchCommandHandlerMap<SketchConstraintCommandId>;

function addLineOrientationConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  type: CadOrientationConstraintType,
  entityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const entity = requireSketchEntity(sketch, entityId);
  if (entity.type !== 'line') {
    throw new Error(`${type === 'horizontal' ? 'Horizontal' : 'Vertical'} constraint requires a Line entity`);
  }

  const sketchConstraintIds = new Set(sketch.constraintIds);
  const unaryForEntity = part.constraints.filter((constraint) => (
    sketchConstraintIds.has(constraint.id)
    && constraint.entityIds.length === 1
    && constraint.entityIds[0] === entityId
  ));
  if (unaryForEntity.some((constraint) => constraint.type === type)) {
    throw new Error(`${type === 'horizontal' ? 'Horizontal' : 'Vertical'} constraint already exists for entity ${entityId}`);
  }

  const opposite: CadOrientationConstraintType = type === 'horizontal' ? 'vertical' : 'horizontal';
  if (unaryForEntity.some((constraint) => constraint.type === opposite)) {
    throw new Error(`Cannot apply ${type} constraint: entity ${entityId} already has ${opposite} constraint`);
  }

  const id = createCadId<CadConstraintId>('constraint');
  const constraint: CadConstraint = { id, type, entityIds: [entityId] };
  return persistConstraint(part, sketchId, constraint);
}

function addUnaryConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  type: 'fixed',
  entityId: CadSketchEntityId,
): CadCommandResult {
  const id = createCadId<CadConstraintId>('constraint');
  const constraint: CadConstraint = { id, type, entityIds: [entityId] };
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
