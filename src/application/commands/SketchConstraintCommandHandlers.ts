import type { CadCommandId, CadCommandMap, CadCommandResult } from '../../contracts/commands';
import type { CadConstraint, CadPartDocument } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { defineSketchCommandHandler, requireSketch, requireSketchAvailability, requireSketchEntity, type SketchCommandHandlerMap } from './SketchCommandHandlerShared';
import { addLinePairConstraint } from './SketchLinePairConstraintOwner';
import { addLineCircleTangentConstraint } from './SketchTangentConstraintOwner';
import { addCirclePairConcentricConstraint } from './SketchConcentricConstraintOwner';
import { addCoincidentConstraint } from './SketchCoincidentConstraintOwner';
import { addSymmetryConstraint } from './SketchSymmetryConstraintOwner';
import { addPointOnCurveConstraint } from './SketchPointOnCurveConstraintOwner';

export const SKETCH_CONSTRAINT_COMMAND_IDS = ['constraint.coincident', 'constraint.horizontal', 'constraint.vertical', 'constraint.parallel', 'constraint.perpendicular', 'constraint.tangent', 'constraint.concentric', 'constraint.equal', 'constraint.symmetric', 'constraint.pointOnCurve', 'constraint.fixed'] as const satisfies readonly CadCommandId[];
export type SketchConstraintCommandId = typeof SKETCH_CONSTRAINT_COMMAND_IDS[number];
type CadFixedFreezeGeometry = CadCommandMap['constraint.fixed']['frozenGeometry'];
const FREEZE_TOLERANCE = 1e-6;

export const sketchConstraintCommandHandlers = {
  'constraint.horizontal': defineSketchCommandHandler<'constraint.horizontal'>({ availability: requireSketchAvailability, execute: (part, command) => addLineOrientationConstraint(part, command.payload.sketchId, 'horizontal', command.payload.entityId) }),
  'constraint.vertical': defineSketchCommandHandler<'constraint.vertical'>({ availability: requireSketchAvailability, execute: (part, command) => addLineOrientationConstraint(part, command.payload.sketchId, 'vertical', command.payload.entityId) }),
  'constraint.parallel': defineSketchCommandHandler<'constraint.parallel'>({ availability: requireSketchAvailability, execute: (part, command) => addLinePairConstraint(part, command.payload.sketchId, 'parallel', command.payload.aEntityId, command.payload.bEntityId) }),
  'constraint.perpendicular': defineSketchCommandHandler<'constraint.perpendicular'>({ availability: requireSketchAvailability, execute: (part, command) => addLinePairConstraint(part, command.payload.sketchId, 'perpendicular', command.payload.aEntityId, command.payload.bEntityId) }),
  'constraint.tangent': defineSketchCommandHandler<'constraint.tangent'>({ availability: requireSketchAvailability, execute: (part, command) => addLineCircleTangentConstraint(part, command.payload.sketchId, command.payload.aEntityId, command.payload.bEntityId) }),
  'constraint.concentric': defineSketchCommandHandler<'constraint.concentric'>({ availability: requireSketchAvailability, execute: (part, command) => addCirclePairConcentricConstraint(part, command.payload.sketchId, command.payload.aEntityId, command.payload.bEntityId) }),
  'constraint.equal': defineSketchCommandHandler<'constraint.equal'>({ availability: requireSketchAvailability, execute: (part, command) => addLinePairConstraint(part, command.payload.sketchId, 'equal', command.payload.aEntityId, command.payload.bEntityId) }),
  'constraint.symmetric': defineSketchCommandHandler<'constraint.symmetric'>({ availability: requireSketchAvailability, execute: (part, command) => addSymmetryConstraint(part, command.payload.sketchId, command.payload.a, command.payload.b, command.payload.axisEntityId) }),
  'constraint.pointOnCurve': defineSketchCommandHandler<'constraint.pointOnCurve'>({ availability: requireSketchAvailability, execute: (part, command) => addPointOnCurveConstraint(part, command.payload.sketchId, command.payload.source, command.payload.targetEntityId) }),
  'constraint.fixed': defineSketchCommandHandler<'constraint.fixed'>({ availability: requireSketchAvailability, execute: (part, command) => addFixedConstraint(part, command.payload.sketchId, command.payload.entityId, command.payload.frozenGeometry) }),
  'constraint.coincident': defineSketchCommandHandler<'constraint.coincident'>({ availability: requireSketchAvailability, execute: (part, command) => addCoincidentConstraint(part, command.payload.sketchId, [command.payload.a, command.payload.b]) }),
} satisfies SketchCommandHandlerMap<SketchConstraintCommandId>;

function addLineOrientationConstraint(
  part: CadPartDocument, sketchId: CadSketchId, type: 'horizontal' | 'vertical', entityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const entity = requireSketchEntity(sketch, entityId);
  if (entity.type !== 'line') throw new Error(`${type === 'horizontal' ? 'Horizontal' : 'Vertical'} constraint requires a Line entity`);
  const unaryForEntity = unaryConstraintsForEntity(part, sketch.constraintIds, entityId);
  if (unaryForEntity.some((constraint) => constraint.type === type)) {
    throw new Error(`${type === 'horizontal' ? 'Horizontal' : 'Vertical'} constraint already exists for entity ${entityId}`);
  }
  const opposite: 'horizontal' | 'vertical' = type === 'horizontal' ? 'vertical' : 'horizontal';
  if (unaryForEntity.some((constraint) => constraint.type === opposite)) {
    throw new Error(`Cannot apply ${type} constraint: entity ${entityId} already has ${opposite} constraint`);
  }
  const id = createCadId<CadConstraintId>('constraint');
  return persistConstraint(part, sketchId, { id, type, entityIds: [entityId] });
}

function addFixedConstraint(
  part: CadPartDocument, sketchId: CadSketchId, entityId: CadSketchEntityId, frozenGeometry: CadFixedFreezeGeometry,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const entity = requireSketchEntity(sketch, entityId);
  if (entity.type !== 'line' || frozenGeometry.type !== 'line') throw new Error('M3.7B Fixed currently requires a Line entity');
  validateFrozenLineGeometry(frozenGeometry);
  const unaryForEntity = unaryConstraintsForEntity(part, sketch.constraintIds, entityId);
  if (unaryForEntity.some((constraint) => constraint.type === 'fixed')) {
    throw new Error(`Fixed constraint already exists for entity ${entityId}`);
  }
  assertFrozenGeometryMatchesOrientation(unaryForEntity, frozenGeometry, entityId);
  const entityIndex = sketch.entities.findIndex((item) => item.id === entityId);
  sketch.entities[entityIndex] = {
    ...entity,
    data: {
      ...entity.data,
      from: [frozenGeometry.from[0], frozenGeometry.from[1]],
      to: [frozenGeometry.to[0], frozenGeometry.to[1]],
    },
  };
  const id = createCadId<CadConstraintId>('constraint');
  return persistConstraint(part, sketchId, { id, type: 'fixed', entityIds: [entityId] });
}

function unaryConstraintsForEntity(
  part: CadPartDocument, constraintIds: readonly CadConstraintId[], entityId: CadSketchEntityId,
): CadConstraint[] {
  const ids = new Set(constraintIds);
  return part.constraints.filter((constraint) => ids.has(constraint.id) && constraint.entityIds.length === 1 && constraint.entityIds[0] === entityId);
}

function validateFrozenLineGeometry(geometry: CadFixedFreezeGeometry): void {
  for (const [label, point] of [['from', geometry.from], ['to', geometry.to]] as const) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error(`Fixed frozen Line ${label} must contain finite coordinates`);
  }
}

function assertFrozenGeometryMatchesOrientation(
  constraints: readonly CadConstraint[], geometry: CadFixedFreezeGeometry, entityId: CadSketchEntityId,
): void {
  if (constraints.some((constraint) => constraint.type === 'horizontal') && Math.abs(geometry.from[1] - geometry.to[1]) > FREEZE_TOLERANCE) {
    throw new Error(`Frozen geometry for ${entityId} does not satisfy its horizontal constraint`);
  }
  if (constraints.some((constraint) => constraint.type === 'vertical') && Math.abs(geometry.from[0] - geometry.to[0]) > FREEZE_TOLERANCE) {
    throw new Error(`Frozen geometry for ${entityId} does not satisfy its vertical constraint`);
  }
}

function persistConstraint(part: CadPartDocument, sketchId: CadSketchId, constraint: CadConstraint): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  for (const entityId of constraint.entityIds) requireSketchEntity(sketch, entityId);
  part.constraints.push(constraint);
  sketch.constraintIds.push(constraint.id);
  return { ok: true, changed: true, createdIds: [constraint.id] };
}
