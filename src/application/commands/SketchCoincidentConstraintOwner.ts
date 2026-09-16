import type { CadCommandResult, CadSketchCommandReference } from '../../contracts/commands';
import type { CadPartDocument, CadSketch } from '../../contracts/document';
import type { CadConstraintId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

/** Focused application owner for stable Line-endpoint Coincident semantics. */
export function addCoincidentConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  refs: [CadSketchCommandReference, CadSketchCommandReference],
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const a = requireLineEndpointReference(sketch, refs[0], 'first');
  const b = requireLineEndpointReference(sketch, refs[1], 'second');
  if (a.entityId === b.entityId) throw new Error('M3.7C Coincident requires endpoints from two distinct Lines');
  const ids = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    ids.has(constraint.id) && constraint.type === 'coincident' && sameUnorderedEndpointPair(constraint.data.refs, [a, b])
  ));
  if (duplicate) throw new Error('Coincident constraint already exists for the selected endpoints');
  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push({ id, type: 'coincident', entityIds: [a.entityId, b.entityId], data: { refs: [a, b] } });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}

function requireLineEndpointReference(
  sketch: CadSketch,
  ref: CadSketchCommandReference,
  label: string,
): CadSketchCommandReference & { point: 'a' | 'b' } {
  const entity = requireSketchEntity(sketch, ref.entityId);
  if (entity.type !== 'line') throw new Error(`M3.7C Coincident ${label} reference must target a Line entity`);
  if (ref.point !== 'a' && ref.point !== 'b') {
    throw new Error(`M3.7C Coincident ${label} Line reference must select endpoint a or b`);
  }
  return { entityId: ref.entityId, point: ref.point };
}

function sameUnorderedEndpointPair(
  left: readonly CadSketchCommandReference[],
  right: readonly CadSketchCommandReference[],
): boolean {
  if (left.length !== 2 || right.length !== 2) return false;
  const a = left.map(endpointKey).sort(), b = right.map(endpointKey).sort();
  return a[0] === b[0] && a[1] === b[1];
}

function endpointKey(ref: CadSketchCommandReference): string {
  return `${ref.entityId}:${ref.point ?? ''}`;
}
