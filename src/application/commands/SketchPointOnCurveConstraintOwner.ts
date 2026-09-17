import type { CadCommandResult, CadSketchCommandReference } from '../../contracts/commands';
import type { CadPartDocument, CadSketch } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

type LineEndpointRef = CadSketchCommandReference & { point: 'a' | 'b' };

/** Focused application owner for one Line endpoint constrained onto a distinct target Line. */
export function addPointOnCurveConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  sourceRef: CadSketchCommandReference,
  targetEntityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const source = requireLineEndpointReference(sketch, sourceRef);
  const target = requireSketchEntity(sketch, targetEntityId);
  if (target.type !== 'line') throw new Error('Point-on-curve target must be a Line entity');
  if (source.entityId === targetEntityId) {
    throw new Error('Point-on-curve source endpoint and target must belong to distinct Lines');
  }

  const ids = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    ids.has(constraint.id)
    && constraint.type === 'pointOnCurve'
    && endpointKey(constraint.data.source) === endpointKey(source)
    && constraint.entityIds[1] === targetEntityId
  ));
  if (duplicate) throw new Error('Point-on-curve constraint already exists for the selected endpoint and target Line');

  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push({
    id,
    type: 'pointOnCurve',
    entityIds: [source.entityId, targetEntityId],
    data: { source },
  });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}

function requireLineEndpointReference(sketch: CadSketch, ref: CadSketchCommandReference): LineEndpointRef {
  const entity = requireSketchEntity(sketch, ref.entityId);
  if (entity.type !== 'line') throw new Error('Point-on-curve source must target a Line entity');
  if (ref.point !== 'a' && ref.point !== 'b') {
    throw new Error('Point-on-curve source Line reference must select endpoint a or b');
  }
  return { entityId: ref.entityId, point: ref.point };
}

function endpointKey(ref: CadSketchCommandReference): string {
  return `${ref.entityId}:${ref.point ?? ''}`;
}
