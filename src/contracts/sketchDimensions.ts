import type { CadDimensionId, CadSketchEntityId } from './ids';
import { expectId, expectPositiveFinite, expectRecord } from './contractValidation';

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

export interface CadHorizontalDimension extends CadDimensionBase<'horizontal'> {
  entityIds: [CadSketchEntityId];
}

export interface CadVerticalDimension extends CadDimensionBase<'vertical'> {
  entityIds: [CadSketchEntityId];
}

export interface CadDiameterDimension extends CadDimensionBase<'diameter'> {
  entityIds: [CadSketchEntityId];
}

export type CadDimension =
  | CadLinearDimension
  | CadHorizontalDimension
  | CadVerticalDimension
  | CadDiameterDimension;

export function validateCadDimension(value: unknown, path: string): asserts value is CadDimension {
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
    case 'horizontal':
    case 'vertical':
      if (dimension.entityIds.length !== 1) throw new Error(`${path}.${dimension.type} requires exactly one entity id`);
      return;
    case 'diameter':
      if (dimension.entityIds.length !== 1) throw new Error(`${path}.diameter requires exactly one entity id`);
      return;
    default:
      throw new Error(`${path}.type is unsupported: ${String(dimension.type)}`);
  }
}
