import type { CadPlaneName } from './commands';
import type {
  CadConstraintId,
  CadDimensionId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from './ids';

export type CadPoint2 = readonly [number, number];
export type CadSketchSupport = CadPlaneName | CadStableReferenceId;

export interface CadSketchLineData {
  from: CadPoint2;
  to: CadPoint2;
  role?: string;
}

export interface CadSketchCircleData {
  center: CadPoint2;
  diameter: number;
}

export interface CadSketchLineEntity {
  id: CadSketchEntityId;
  type: 'line';
  data: CadSketchLineData;
}

export interface CadSketchCircleEntity {
  id: CadSketchEntityId;
  type: 'circle';
  data: CadSketchCircleData;
}

/** Current persisted M3-ready Sketch entity surface. Extend this union explicitly. */
export type CadSketchEntity = CadSketchLineEntity | CadSketchCircleEntity;

export interface CadSketch {
  id: CadSketchId;
  name: string;
  support: CadSketchSupport;
  entities: CadSketchEntity[];
  constraintIds: CadConstraintId[];
  dimensionIds: CadDimensionId[];
}

export type CadSketchPointSelector = 'a' | 'b' | 'c';

export interface CadConstraintPointReference {
  entityId: CadSketchEntityId;
  point?: CadSketchPointSelector;
}

interface CadConstraintBase<T extends string> {
  id: CadConstraintId;
  type: T;
}

export interface CadHorizontalConstraint extends CadConstraintBase<'horizontal'> {
  entityIds: [CadSketchEntityId];
  data?: undefined;
}

export interface CadVerticalConstraint extends CadConstraintBase<'vertical'> {
  entityIds: [CadSketchEntityId];
  data?: undefined;
}

export interface CadFixedConstraint extends CadConstraintBase<'fixed'> {
  entityIds: [CadSketchEntityId];
  data?: undefined;
}

export interface CadCoincidentConstraint extends CadConstraintBase<'coincident'> {
  entityIds: [CadSketchEntityId, CadSketchEntityId];
  data: {
    refs: [CadConstraintPointReference, CadConstraintPointReference];
  };
}

/** Current M3-ready constraint surface. Add new constraint kinds explicitly. */
export type CadConstraint =
  | CadHorizontalConstraint
  | CadVerticalConstraint
  | CadFixedConstraint
  | CadCoincidentConstraint;

interface CadDimensionBase<T extends string> {
  id: CadDimensionId;
  type: T;
  value: number;
  driving: boolean;
  name?: string;
}

export interface CadLinearDimension extends CadDimensionBase<'linear'> {
  entityIds: [CadSketchEntityId, ...CadSketchEntityId[]];
}

export interface CadDiameterDimension extends CadDimensionBase<'diameter'> {
  entityIds: [CadSketchEntityId];
}

/** Current M3-ready dimension surface. Add new dimension kinds explicitly. */
export type CadDimension = CadLinearDimension | CadDiameterDimension;

export interface CadPartSketchCollections {
  sketches: CadSketch[];
  constraints: CadConstraint[];
  dimensions: CadDimension[];
}

/**
 * Runtime validator for the persisted M3 Sketch surface.
 *
 * This intentionally validates only entities/constraints/dimensions that ASA
 * currently persists. Future kinds must be added to the discriminated unions
 * and this validator together; arbitrary `type`/`Record<string, unknown>` data
 * is rejected rather than silently entering project history. Stable-reference
 * existence/ownership is a semantic document check layered above this shape
 * validator; this function only validates the support token form.
 */
export function validateCadPartSketchCollections(value: unknown): asserts value is CadPartSketchCollections {
  const record = expectRecord(value, 'CadPartDocument');
  if (!Array.isArray(record.sketches)) throw new Error('CadPartDocument.sketches must be an array');
  if (!Array.isArray(record.constraints)) throw new Error('CadPartDocument.constraints must be an array');
  if (!Array.isArray(record.dimensions)) throw new Error('CadPartDocument.dimensions must be an array');

  record.sketches.forEach((sketch, index) => validateSketch(sketch, `sketches[${index}]`));
  record.constraints.forEach((constraint, index) => validateConstraint(constraint, `constraints[${index}]`));
  record.dimensions.forEach((dimension, index) => validateDimension(dimension, `dimensions[${index}]`));
}

function validateSketch(value: unknown, path: string): asserts value is CadSketch {
  const sketch = expectRecord(value, path);
  expectId(sketch.id, `${path}.id`);
  if (typeof sketch.name !== 'string') throw new Error(`${path}.name must be a string`);
  validateSketchSupport(sketch.support, `${path}.support`);
  if (!Array.isArray(sketch.entities)) throw new Error(`${path}.entities must be an array`);
  if (!Array.isArray(sketch.constraintIds)) throw new Error(`${path}.constraintIds must be an array`);
  if (!Array.isArray(sketch.dimensionIds)) throw new Error(`${path}.dimensionIds must be an array`);
  sketch.entities.forEach((entity, index) => validateEntity(entity, `${path}.entities[${index}]`));
  sketch.constraintIds.forEach((id, index) => expectId(id, `${path}.constraintIds[${index}]`));
  sketch.dimensionIds.forEach((id, index) => expectId(id, `${path}.dimensionIds[${index}]`));
}

function validateSketchSupport(value: unknown, path: string): asserts value is CadSketchSupport {
  if (value === 'XY' || value === 'XZ' || value === 'YZ') return;
  if (typeof value === 'string' && value.startsWith('ref_') && value.length > 4) return;
  throw new Error(`${path} must be XY, XZ, YZ or a stable reference id`);
}

function validateEntity(value: unknown, path: string): asserts value is CadSketchEntity {
  const entity = expectRecord(value, path);
  expectId(entity.id, `${path}.id`);
  const data = expectRecord(entity.data, `${path}.data`);

  switch (entity.type) {
    case 'line':
      expectPoint2(data.from, `${path}.data.from`);
      expectPoint2(data.to, `${path}.data.to`);
      if (data.role !== undefined && typeof data.role !== 'string') {
        throw new Error(`${path}.data.role must be a string when provided`);
      }
      return;
    case 'circle':
      expectPoint2(data.center, `${path}.data.center`);
      expectPositiveFinite(data.diameter, `${path}.data.diameter`);
      return;
    default:
      throw new Error(`${path}.type is unsupported: ${String(entity.type)}`);
  }
}

function validateConstraint(value: unknown, path: string): asserts value is CadConstraint {
  const constraint = expectRecord(value, path);
  expectId(constraint.id, `${path}.id`);
  if (!Array.isArray(constraint.entityIds)) throw new Error(`${path}.entityIds must be an array`);
  constraint.entityIds.forEach((id, index) => expectId(id, `${path}.entityIds[${index}]`));

  switch (constraint.type) {
    case 'horizontal':
    case 'vertical':
    case 'fixed':
      if (constraint.entityIds.length !== 1) throw new Error(`${path}.${String(constraint.type)} requires exactly one entity`);
      if (constraint.data !== undefined) throw new Error(`${path}.${String(constraint.type)} must not contain data`);
      return;
    case 'coincident': {
      if (constraint.entityIds.length !== 2) throw new Error(`${path}.coincident requires exactly two entity ids`);
      const data = expectRecord(constraint.data, `${path}.data`);
      if (!Array.isArray(data.refs) || data.refs.length !== 2) {
        throw new Error(`${path}.data.refs must contain exactly two references`);
      }
      data.refs.forEach((ref, index) => validateConstraintReference(ref, `${path}.data.refs[${index}]`));
      return;
    }
    default:
      throw new Error(`${path}.type is unsupported: ${String(constraint.type)}`);
  }
}

function validateConstraintReference(value: unknown, path: string): asserts value is CadConstraintPointReference {
  const ref = expectRecord(value, path);
  expectId(ref.entityId, `${path}.entityId`);
  if (ref.point !== undefined && !['a', 'b', 'c'].includes(String(ref.point))) {
    throw new Error(`${path}.point must be a, b or c when provided`);
  }
}

function validateDimension(value: unknown, path: string): asserts value is CadDimension {
  const dimension = expectRecord(value, path);
  expectId(dimension.id, `${path}.id`);
  if (!Array.isArray(dimension.entityIds)) throw new Error(`${path}.entityIds must be an array`);
  dimension.entityIds.forEach((id, index) => expectId(id, `${path}.entityIds[${index}]`));
  expectPositiveFinite(dimension.value, `${path}.value`);
  if (typeof dimension.driving !== 'boolean') throw new Error(`${path}.driving must be boolean`);
  if (dimension.name !== undefined && typeof dimension.name !== 'string') throw new Error(`${path}.name must be a string when provided`);

  switch (dimension.type) {
    case 'linear':
      if (dimension.entityIds.length < 1) throw new Error(`${path}.linear requires at least one entity id`);
      return;
    case 'diameter':
      if (dimension.entityIds.length !== 1) throw new Error(`${path}.diameter requires exactly one entity id`);
      return;
    default:
      throw new Error(`${path}.type is unsupported: ${String(dimension.type)}`);
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function expectId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value) throw new Error(`${path} must be a non-empty string`);
}

function expectPoint2(value: unknown, path: string): asserts value is CadPoint2 {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${path} must be [x,y]`);
  expectFinite(value[0], `${path}[0]`);
  expectFinite(value[1], `${path}[1]`);
}

function expectPositiveFinite(value: unknown, path: string): asserts value is number {
  expectFinite(value, path);
  if (value <= 0) throw new Error(`${path} must be positive`);
}

function expectFinite(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be finite`);
}
