import type { CadCommandResult } from '../../contracts/commands';
import type { CadPartDocument } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

/** Focused application owner for the first Concentric product slice: Circle ↔ Circle only. */
export function addCirclePairConcentricConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  if (aEntityId === bEntityId) throw new Error('Concentric requires two distinct Circle entities');
  const a = requireSketchEntity(sketch, aEntityId);
  const b = requireSketchEntity(sketch, bEntityId);
  if (a.type !== 'circle' || b.type !== 'circle') throw new Error('Concentric currently requires exactly two Circle entities');

  const [firstId, secondId] = [aEntityId, bEntityId].sort() as [CadSketchEntityId, CadSketchEntityId];
  const ids = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    ids.has(constraint.id)
    && constraint.type === 'concentric'
    && constraint.entityIds[0] === firstId
    && constraint.entityIds[1] === secondId
  ));
  if (duplicate) throw new Error('Concentric constraint already exists for the selected Circles');

  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push({ id, type: 'concentric', entityIds: [firstId, secondId] });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}
