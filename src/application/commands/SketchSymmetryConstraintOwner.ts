import type { CadCommandResult, CadSketchCommandReference } from '../../contracts/commands';
import type { CadPartDocument, CadSketch } from '../../contracts/document';
import type { CadConstraintId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import { requireSketch, requireSketchEntity } from './SketchCommandHandlerShared';

type LineEndpointRef = CadSketchCommandReference & { point: 'a' | 'b' };

/** Focused application owner for endpoint↔endpoint symmetry about a distinct Line axis. */
export function addSymmetryConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  aRef: CadSketchCommandReference,
  bRef: CadSketchCommandReference,
  axisEntityId: CadSketchEntityId,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  const a = requireLineEndpointReference(sketch, aRef, 'first');
  const b = requireLineEndpointReference(sketch, bRef, 'second');
  const axis = requireSketchEntity(sketch, axisEntityId);
  if (axis.type !== 'line') throw new Error('Symmetry axis must target a Line entity');
  if (new Set([a.entityId, b.entityId, axisEntityId]).size !== 3) {
    throw new Error('Symmetry requires two endpoint-owner Lines and a distinct axis Line');
  }

  const refs = canonicalEndpointPair(a, b);
  const ids = new Set(sketch.constraintIds);
  const duplicate = part.constraints.some((constraint) => (
    ids.has(constraint.id)
    && constraint.type === 'symmetric'
    && constraint.entityIds[2] === axisEntityId
    && sameEndpointPair(constraint.data.refs, refs)
  ));
  if (duplicate) throw new Error('Symmetry constraint already exists for the selected endpoints and axis');

  const id = createCadId<CadConstraintId>('constraint');
  part.constraints.push({
    id,
    type: 'symmetric',
    entityIds: [refs[0].entityId, refs[1].entityId, axisEntityId],
    data: { refs },
  });
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}

function requireLineEndpointReference(
  sketch: CadSketch,
  ref: CadSketchCommandReference,
  label: string,
): LineEndpointRef {
  const entity = requireSketchEntity(sketch, ref.entityId);
  if (entity.type !== 'line') throw new Error(`Symmetry ${label} reference must target a Line entity`);
  if (ref.point !== 'a' && ref.point !== 'b') throw new Error(`Symmetry ${label} Line reference must select endpoint a or b`);
  return { entityId: ref.entityId, point: ref.point };
}

function canonicalEndpointPair(a: LineEndpointRef, b: LineEndpointRef): [LineEndpointRef, LineEndpointRef] {
  return endpointKey(a) <= endpointKey(b) ? [a, b] : [b, a];
}

function sameEndpointPair(
  left: readonly CadSketchCommandReference[],
  right: readonly CadSketchCommandReference[],
): boolean {
  if (left.length !== 2 || right.length !== 2) return false;
  return endpointKey(left[0]) === endpointKey(right[0]) && endpointKey(left[1]) === endpointKey(right[1]);
}

function endpointKey(ref: CadSketchCommandReference): string {
  return `${ref.entityId}:${ref.point ?? ''}`;
}
