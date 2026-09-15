import type { CadCommandResult } from '../../contracts/commands';
import type { CadPartDocument } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

/** Focused application owner for the first Tangent product slice: Line ↔ Circle only. */
export function addLineCircleTangentConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  if (aEntityId === bEntityId) throw new Error('Tangent requires two distinct entities');
  const a = requireSketchEntity(sketch, aEntityId);
  const b = requireSketchEntity(sketch, bEntityId);

  const lineId = a.type === 'line' && b.type === 'circle' ? aEntityId
    : b.type === 'line' && a.type === 'circle' ? bEntityId
      : null;
  const circleId = a.type === 'circle' && b.type === 'line' ? aEntityId
    : b.type === 'circle' && a.type === 'line' ? bEntityId
      : null;
  if (!lineId || !circleId) throw new Error('Tangent currently requires exactly one Line and one Circle');

  const ids = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    ids.has(constraint.id)
    && constraint.type === 'tangent'
    && constraint.entityIds[0] === lineId
    && constraint.entityIds[1] === circleId
  ));
  if (duplicate) throw new Error('Tangent constraint already exists for the selected Line and Circle');

  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push({ id, type: 'tangent', entityIds: [lineId, circleId] });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}
