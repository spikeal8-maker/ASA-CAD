import type { CadPlaneName } from './commands';
import type {
  CadConstraintId,
  CadDimensionId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from './ids';
import { expectFinite, expectId, expectPositiveFinite, expectRecord } from './contractValidation';
import { validateCadDimension } from './sketchDimensions';
import type { CadDimension } from './sketchDimensions';

export type {
  CadDiameterDimension,
  CadDimension,
  CadHorizontalDimension,
  CadLinearDimension,
  CadRadiusDimension,
  CadVerticalDimension,
} from './sketchDimensions';

export type CadPoint2 = readonly [number, number];
export type CadSketchSupport = CadPlaneName | CadStableReferenceId;

export interface CadSketchLineData { from: CadPoint2; to: CadPoint2; role?: string; construction?: boolean; }

export interface CadSketchCircleData { center: CadPoint2; diameter: number; }

export interface CadSketchArcData { center: CadPoint2; radius: number; startAngle: number; endAngle: number; }

export interface CadSketchLineEntity { id: CadSketchEntityId; type: 'line'; data: CadSketchLineData; }

export interface CadSketchCircleEntity { id: CadSketchEntityId; type: 'circle'; data: CadSketchCircleData; }

export interface CadSketchArcEntity { id: CadSketchEntityId; type: 'arc'; data: CadSketchArcData; }

export type CadSketchEntity = CadSketchLineEntity | CadSketchCircleEntity | CadSketchArcEntity;

export interface CadSketch { id: CadSketchId; name: string; support: CadSketchSupport; entities: CadSketchEntity[]; constraintIds: CadConstraintId[]; dimensionIds: CadDimensionId[]; }

export type CadSketchPointSelector = 'a' | 'b' | 'c';

export interface CadConstraintPointReference { entityId: CadSketchEntityId; point?: CadSketchPointSelector; }

interface CadConstraintBase<T extends string> { id: CadConstraintId; type: T; }

export interface CadHorizontalConstraint extends CadConstraintBase<'horizontal'> { entityIds: [CadSketchEntityId]; data?: undefined; }

export interface CadVerticalConstraint extends CadConstraintBase<'vertical'> { entityIds: [CadSketchEntityId]; data?: undefined; }

export interface CadParallelConstraint extends CadConstraintBase<'parallel'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data?: undefined; }

export interface CadPerpendicularConstraint extends CadConstraintBase<'perpendicular'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data?: undefined; }

export interface CadTangentConstraint extends CadConstraintBase<'tangent'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data?: undefined; }

export interface CadConcentricConstraint extends CadConstraintBase<'concentric'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data?: undefined; }

export interface CadEqualConstraint extends CadConstraintBase<'equal'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data?: undefined; }

export interface CadSymmetricConstraint extends CadConstraintBase<'symmetric'> { entityIds: [CadSketchEntityId, CadSketchEntityId, CadSketchEntityId]; data: { refs: [CadConstraintPointReference, CadConstraintPointReference] }; }

export interface CadPointOnCurveConstraint extends CadConstraintBase<'pointOnCurve'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data: { source: CadConstraintPointReference }; }

export interface CadFixedConstraint extends CadConstraintBase<'fixed'> { entityIds: [CadSketchEntityId]; data?: undefined; }

export interface CadCoincidentConstraint extends CadConstraintBase<'coincident'> { entityIds: [CadSketchEntityId, CadSketchEntityId]; data: { refs: [CadConstraintPointReference, CadConstraintPointReference] }; }

export type CadConstraint =
  | CadHorizontalConstraint
  | CadVerticalConstraint
  | CadParallelConstraint
  | CadPerpendicularConstraint
  | CadTangentConstraint
  | CadConcentricConstraint
  | CadEqualConstraint
  | CadSymmetricConstraint
  | CadPointOnCurveConstraint
  | CadFixedConstraint
  | CadCoincidentConstraint;

export interface CadPartSketchCollections {
  sketches: CadSketch[];
  constraints: CadConstraint[];
  dimensions: CadDimension[];
}

export function validateCadPartSketchCollections(value: unknown): asserts value is CadPartSketchCollections {
  const record = expectRecord(value, 'CadPartDocument');
  if (!Array.isArray(record.sketches)) throw new Error('CadPartDocument.sketches must be an array');
  if (!Array.isArray(record.constraints)) throw new Error('CadPartDocument.constraints must be an array');
  if (!Array.isArray(record.dimensions)) throw new Error('CadPartDocument.dimensions must be an array');

  record.sketches.forEach((sketch,index) => validateSketch(sketch,`sketches[${index}]`));
  record.constraints.forEach((constraint,index) => validateConstraint(constraint,`constraints[${index}]`));
  record.dimensions.forEach((dimension,index) => validateCadDimension(dimension,`dimensions[${index}]`));
}

function validateSketch(value: unknown,path: string): asserts value is CadSketch {
  const sketch = expectRecord(value,path);
  expectId(sketch.id,`${path}.id`);
  if (typeof sketch.name !== 'string') throw new Error(`${path}.name must be a string`);
  validateSketchSupport(sketch.support,`${path}.support`);
  if (!Array.isArray(sketch.entities)) throw new Error(`${path}.entities must be an array`);
  if (!Array.isArray(sketch.constraintIds)) throw new Error(`${path}.constraintIds must be an array`);
  if (!Array.isArray(sketch.dimensionIds)) throw new Error(`${path}.dimensionIds must be an array`);
  sketch.entities.forEach((entity,index) => validateEntity(entity, `${path}.entities[${index}]`));
  sketch.constraintIds.forEach((id, index) => expectId(id, `${path}.constraintIds[${index}]`));
  sketch.dimensionIds.forEach((id, index) => expectId(id, `${path}.dimensionIds[${index}]`));
}

function validateSketchSupport(value: unknown, path: string): asserts value is CadSketchSupport { if (value === 'XY' || value === 'XZ' || value === 'YZ') return; if (typeof value === 'string' && value.startsWith('ref_') && value.length > 4) return; throw new Error(`${path} must be XY, XZ, YZ or a stable reference id`); }

function validateEntity(value: unknown, path: string): asserts value is CadSketchEntity {
  const entity = expectRecord(value, path);
  expectId(entity.id, `${path}.id`);
  const data = expectRecord(entity.data, `${path}.data`);

  switch (entity.type) {
    case 'line': expectPoint2(data.from, `${path}.data.from`); expectPoint2(data.to, `${path}.data.to`); if (data.role !== undefined && typeof data.role !== 'string') throw new Error(`${path}.data.role must be a string when provided`); if (data.construction !== undefined && typeof data.construction !== 'boolean') throw new Error(`${path}.data.construction must be boolean when provided`); return;
    case 'circle': expectPoint2(data.center, `${path}.data.center`); expectPositiveFinite(data.diameter, `${path}.data.diameter`); return;
    case 'arc': {
      expectPoint2(data.center, `${path}.data.center`); expectPositiveFinite(data.radius, `${path}.data.radius`); expectFinite(data.startAngle, `${path}.data.startAngle`); expectFinite(data.endAngle, `${path}.data.endAngle`);
      const twoPi = Math.PI * 2;
      if (data.startAngle < 0 || data.startAngle >= twoPi) {
        throw new Error(`${path}.data.startAngle must be in [0,2π)`);
      }
      const sweep = data.endAngle - data.startAngle;
      if (!(sweep > 0) || !(sweep < twoPi)) {
        throw new Error(`${path}.data.sweep must be greater than 0 and less than 2π`);
      }
      return;
    }
    default:
      throw new Error(`${path}.type is unsupported: ${String(entity.type)}`);
  }
}

function validateConstraint(value: unknown, path: string): asserts value is CadConstraint {
  const constraint = expectRecord(value, path);
  expectId(constraint.id, `${path}.id`);
  if (!Array.isArray(constraint.entityIds)) throw new Error(`${path}.entityIds must be an array`);
  const entityIds= constraint.entityIds;
  entityIds.forEach((id, index) => expectId(id, `${path}.entityIds[${index}]`));
  const type = String(constraint.type);
  const requireCount = (count: number, label: string) => {
    if (entityIds.length !== count) throw new Error(`${path}.${type} requires exactly ${label}`);
  };
  const requireNoData = () => {
    if (constraint.data !== undefined) throw new Error(`${path}.${type} must not contain data`);
  };

  switch (constraint.type) {
    case 'horizontal': case 'vertical': case 'fixed':
      requireCount(1, 'one entity'); requireNoData(); return;
    case 'parallel': case 'perpendicular': case 'tangent': case 'concentric': case 'equal':
      requireCount(2, 'two entity ids'); requireNoData(); return;
    case 'symmetric': {
      requireCount(3, 'three entity ids');
      const data = expectRecord(constraint.data, `${path}.data`);
      if (!Array.isArray(data.refs) || data.refs.length !== 2) throw new Error(`${path}.symmetric data.refs must contain two references`);
      data.refs.forEach((ref, index) => validateConstraintReference(ref, `${path}.data.refs[${index}]`));
      return;
    }
    case 'pointOnCurve': {
      requireCount(2, 'two entity ids');
      const data = expectRecord(constraint.data, `${path}.data`);
      validateConstraintReference(data.source, `${path}.data.source`);
      return;
    }
    case 'coincident': {
      requireCount(2, 'two entity ids');
      const data = expectRecord(constraint.data, `${path}.data`);
      if (!Array.isArray(data.refs) || data.refs.length !== 2) throw new Error(`${path}.data.refs must contain exactly two references`);
      data.refs.forEach((ref, index) => validateConstraintReference(ref, `${path}.data.refs[${index}]`));
      return;
    }
    default: throw new Error(`${path}.type is unsupported: ${type}`);
  }
}

function validateConstraintReference(value: unknown, path: string): asserts value is CadConstraintPointReference {
  const ref = expectRecord(value, path);
  expectId(ref.entityId, `${path}.entityId`);
  if (ref.point !== undefined && !['a', 'b', 'c'].includes(String(ref.point))) {
    throw new Error(`${path}.point must be a, b or c when provided`);
  }
}

function expectPoint2(value: unknown, path: string): asserts value is CadPoint2 {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${path} must be [x,y]`);
  expectFinite(value[0], `${path}[0]`);
  expectFinite(value[1], `${path}[1]`);
}
