import type {
  CadConstraint,
  CadDimension,
  CadSketch,
} from './sketch';
import type {
  CadConstraintId,
  CadDimensionId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from './ids';

export interface CadPartSemanticCollections {
  sketches: readonly CadSketch[];
  constraints: readonly CadConstraint[];
  dimensions: readonly CadDimension[];
  stableReferences: readonly { id: CadStableReferenceId }[];
}

/**
 * Validates relationships that cannot be proven by local DTO shape checks.
 * IDs remain persisted exactly as before; this only rejects dangling,
 * duplicated or cross-Sketch references before they enter project history.
 */
export function validateCadPartSemantics(part: CadPartSemanticCollections): void {
  const sketches = uniqueById(part.sketches, 'sketch');
  const constraints = uniqueById(part.constraints, 'constraint');
  const dimensions = uniqueById(part.dimensions, 'dimension');
  const stableReferences = uniqueById(part.stableReferences, 'stable reference');

  const entityOwner = new Map<CadSketchEntityId, CadSketchId>();
  for (const sketch of part.sketches) {
    const local = new Set<CadSketchEntityId>();
    for (const entity of sketch.entities) {
      if (local.has(entity.id)) {
        throw new Error(`Sketch ${sketch.id} contains duplicate entity id ${entity.id}`);
      }
      local.add(entity.id);
      const previousOwner = entityOwner.get(entity.id);
      if (previousOwner && previousOwner !== sketch.id) {
        throw new Error(`Entity ${entity.id} belongs to multiple sketches: ${previousOwner}, ${sketch.id}`);
      }
      entityOwner.set(entity.id, sketch.id);
    }
  }

  const constraintOwner = new Map<CadConstraintId, CadSketchId>();
  const dimensionOwner = new Map<CadDimensionId, CadSketchId>();

  for (const sketch of part.sketches) {
    if (!isOriginPlane(sketch.support) && !stableReferences.has(sketch.support)) {
      throw new Error(`Sketch ${sketch.id} support reference ${sketch.support} does not exist`);
    }

    assertUniqueRefs(sketch.constraintIds, `Sketch ${sketch.id} constraintIds`);
    assertUniqueRefs(sketch.dimensionIds, `Sketch ${sketch.id} dimensionIds`);

    for (const constraintId of sketch.constraintIds) {
      const constraint = constraints.get(constraintId);
      if (!constraint) throw new Error(`Sketch ${sketch.id} references unknown constraint ${constraintId}`);
      claimOwner(constraintOwner, constraintId, sketch.id, 'Constraint');
      for (const entityId of constraint.entityIds) {
        assertEntityOwnedBySketch(entityOwner, entityId, sketch.id, `Constraint ${constraint.id}`);
      }
      if (constraint.type === 'coincident') {
        for (const ref of constraint.data.refs) {
          assertEntityOwnedBySketch(entityOwner, ref.entityId, sketch.id, `Constraint ${constraint.id} ref`);
        }
        if (
          constraint.data.refs[0].entityId !== constraint.entityIds[0]
          || constraint.data.refs[1].entityId !== constraint.entityIds[1]
        ) {
          throw new Error(`Constraint ${constraint.id} coincident refs must match entityIds`);
        }
      }
    }

    for (const dimensionId of sketch.dimensionIds) {
      const dimension = dimensions.get(dimensionId);
      if (!dimension) throw new Error(`Sketch ${sketch.id} references unknown dimension ${dimensionId}`);
      claimOwner(dimensionOwner, dimensionId, sketch.id, 'Dimension');
      for (const entityId of dimension.entityIds) {
        assertEntityOwnedBySketch(entityOwner, entityId, sketch.id, `Dimension ${dimension.id}`);
      }
    }
  }

  for (const constraint of part.constraints) {
    if (!constraintOwner.has(constraint.id)) {
      throw new Error(`Constraint ${constraint.id} is not owned by any sketch`);
    }
  }
  for (const dimension of part.dimensions) {
    if (!dimensionOwner.has(dimension.id)) {
      throw new Error(`Dimension ${dimension.id} is not owned by any sketch`);
    }
  }

  // `sketches` is intentionally read so duplicate sketch IDs are validated even
  // though ownership checks iterate the original ordered collection.
  void sketches;
}

function uniqueById<T extends { id: string }>(items: readonly T[], label: string): Map<T['id'], T> {
  const map = new Map<T['id'], T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Duplicate ${label} id ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

function assertUniqueRefs<T extends string>(ids: readonly T[], label: string): void {
  const seen = new Set<T>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${label} contains duplicate id ${id}`);
    seen.add(id);
  }
}

function claimOwner<T extends string>(
  owners: Map<T, CadSketchId>,
  id: T,
  sketchId: CadSketchId,
  label: string,
): void {
  const previous = owners.get(id);
  if (previous && previous !== sketchId) {
    throw new Error(`${label} ${id} is owned by multiple sketches: ${previous}, ${sketchId}`);
  }
  owners.set(id, sketchId);
}

function assertEntityOwnedBySketch(
  owners: ReadonlyMap<CadSketchEntityId, CadSketchId>,
  entityId: CadSketchEntityId,
  sketchId: CadSketchId,
  label: string,
): void {
  const owner = owners.get(entityId);
  if (!owner) throw new Error(`${label} references unknown entity ${entityId}`);
  if (owner !== sketchId) {
    throw new Error(`${label} references entity ${entityId} owned by sketch ${owner}, not ${sketchId}`);
  }
}

function isOriginPlane(value: string): boolean {
  return value === 'XY' || value === 'XZ' || value === 'YZ';
}
