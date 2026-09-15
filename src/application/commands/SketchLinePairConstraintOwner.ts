import type { CadCommandResult } from '../../contracts/commands';
import type { CadPartDocument } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

export type CadLinePairConstraintType = 'parallel' | 'perpendicular';

/** Focused application owner for symmetric Line↔Line geometric constraints. */
export function addLinePairConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  type: CadLinePairConstraintType,
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const a = requireSketchEntity(sketch, aEntityId);
  const b = requireSketchEntity(sketch, bEntityId);
  const label = type === 'parallel' ? 'Parallel' : 'Perpendicular';
  if (a.type !== 'line' || b.type !== 'line') throw new Error(`${label} requires two Line entities`);
  if (aEntityId === bEntityId) throw new Error(`${label} requires two distinct Lines`);

  const sketchConstraintIds = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    sketchConstraintIds.has(constraint.id)
    && constraint.type === type
    && sameUnorderedEntityPair(constraint.entityIds, [aEntityId, bEntityId])
  ));
  if (duplicate) throw new Error(`${label} constraint already exists for the selected Lines`);

  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push(type === 'parallel'
    ? { id, type: 'parallel', entityIds: [aEntityId, bEntityId] }
    : { id, type: 'perpendicular', entityIds: [aEntityId, bEntityId] });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}

export function sameUnorderedEntityPair(
  left: readonly CadSketchEntityId[],
  right: readonly CadSketchEntityId[],
): boolean {
  if (left.length !== 2 || right.length !== 2) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a[0] === b[0] && a[1] === b[1];
}
