import assert from 'node:assert/strict';
import {
  createCadId,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadConstraintId,
  type CadDimensionId,
  type CadSketchEntityId,
  type CadSketchId,
  type CadStableReferenceId,
} from '../../src';

function validDocument() {
  const part = createEmptyCadDocument('part', { title: 'Semantic validation' });
  const sketchA = createCadId<CadSketchId>('sketch');
  const sketchB = createCadId<CadSketchId>('sketch');
  const lineId = createCadId<CadSketchEntityId>('entity');
  const circleId = createCadId<CadSketchEntityId>('entity');
  const constraintId = createCadId<CadConstraintId>('constraint');
  const widthId = createCadId<CadDimensionId>('dimension');
  const diameterId = createCadId<CadDimensionId>('dimension');
  const supportRef = createCadId<CadStableReferenceId>('ref');

  part.stableReferences.push({
    id: supportRef,
    semanticRole: 'sketch-support-face',
    locator: { kind: 'face', signature: 'semantic-test' },
  });
  part.sketches.push(
    {
      id: sketchA,
      name: 'Sketch A',
      support: 'XY',
      entities: [{ id: lineId, type: 'line', data: { from: [0, 0], to: [20, 0] } }],
      constraintIds: [constraintId],
      dimensionIds: [widthId],
    },
    {
      id: sketchB,
      name: 'Sketch B',
      support: supportRef,
      entities: [{ id: circleId, type: 'circle', data: { center: [0, 0], diameter: 10 } }],
      constraintIds: [],
      dimensionIds: [diameterId],
    },
  );
  part.constraints.push({ id: constraintId, type: 'horizontal', entityIds: [lineId] });
  part.dimensions.push(
    { id: widthId, type: 'linear', entityIds: [lineId], value: 20, driving: true },
    { id: diameterId, type: 'diameter', entityIds: [circleId], value: 10, driving: true },
  );

  return { part, ids: { sketchA, sketchB, lineId, circleId, constraintId, widthId, diameterId, supportRef } };
}

const { part, ids } = validDocument();
const serialized = serializeCadDocument(part);
assert.deepEqual(parseCadDocument(serialized), part, 'valid semantic references must round-trip');

function rejectMutation(mutator: (value: any) => void, pattern: RegExp): void {
  const value = JSON.parse(serialized);
  mutator(value);
  assert.throws(() => parseCadDocument(JSON.stringify(value)), pattern);
}

rejectMutation(
  (value) => { value.stableReferences = []; },
  /support reference .* does not exist/,
);
rejectMutation(
  (value) => { value.sketches[0].constraintIds[0] = 'constraint_missing'; },
  /references unknown constraint constraint_missing/,
);
rejectMutation(
  (value) => { value.sketches[0].constraintIds = []; },
  /Constraint .* is not owned by any sketch/,
);
rejectMutation(
  (value) => { value.constraints[0].entityIds = [ids.circleId]; },
  /references entity .* owned by sketch .* not/,
);
rejectMutation(
  (value) => { value.dimensions[0].entityIds = [ids.circleId]; },
  /Dimension .* references entity .* owned by sketch .* not/,
);
rejectMutation(
  (value) => { value.sketches[1].entities[0].id = ids.lineId; },
  /belongs to multiple sketches/,
);
rejectMutation(
  (value) => { value.sketches[1].constraintIds = [ids.constraintId]; },
  /Constraint .* is owned by multiple sketches/,
);
rejectMutation(
  (value) => { value.sketches[0].dimensionIds.push(ids.widthId); },
  /dimensionIds contains duplicate id/,
);

console.log('M2O Part semantic validation PASS (ownership + dangling IDs + StableRef support)');
