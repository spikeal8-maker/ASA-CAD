import assert from 'node:assert/strict';
import {
  createCadId,
  createEmptyCadDocument,
  migrateCadDocument,
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
  (value) => { value.stableReferences.push(structuredClone(value.stableReferences[0])); },
  /Duplicate stable reference id/,
);
rejectMutation(
  (value) => { value.sketches[0].constraintIds[0] = 'constraint_missing'; },
  /references unknown constraint constraint_missing/,
);
rejectMutation(
  (value) => { value.sketches[0].dimensionIds[0] = 'dimension_missing'; },
  /references unknown dimension dimension_missing/,
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
  (value) => { value.dimensions[0].entityIds = ['entity_missing']; },
  /Dimension .* references unknown entity entity_missing/,
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

type ReferenceConstraintType = 'pointOnCurve' | 'symmetric' | 'coincident';

function referenceDocument(type: ReferenceConstraintType) {
  const part = createEmptyCadDocument('part', { title: `Semantic ${type} references` });
  const source = createCadId<CadSketchEntityId>('entity');
  const target = createCadId<CadSketchEntityId>('entity');
  const alternate = createCadId<CadSketchEntityId>('entity');
  const foreign = createCadId<CadSketchEntityId>('entity');
  const constraintId = createCadId<CadConstraintId>('constraint');
  const data = type === 'symmetric'
    ? [{ from: [-3, 4], to: [-1, 4] }, { from: [3, 5], to: [5, 5] }, { from: [0, -20], to: [0, 20] }] as const
    : [{ from: [1, 6], to: [2, 6] }, { from: [0, 0], to: [10, 0] }, { from: [5, 9], to: [8, 9] }] as const;
  part.sketches.push({
    id: createCadId<CadSketchId>('sketch'), name: 'Reference owner', support: 'XY',
    entities: [source, target, alternate].map((id, index) => ({ id, type: 'line', data: data[index] })),
    constraintIds: [constraintId], dimensionIds: [],
  }, {
    id: createCadId<CadSketchId>('sketch'), name: 'Foreign owner', support: 'XY',
    entities: [{ id: foreign, type: 'line', data: { from: [0, 0], to: [5, 0] } }],
    constraintIds: [], dimensionIds: [],
  });
  if (type === 'pointOnCurve') {
    part.constraints.push({ id: constraintId, type, entityIds: [source, target], data: { source: { entityId: source, point: 'a' } } });
  } else if (type === 'symmetric') {
    part.constraints.push({
      id: constraintId, type, entityIds: [source, target, alternate],
      data: { refs: [{ entityId: source, point: 'a' }, { entityId: target, point: 'a' }] },
    });
  } else {
    part.constraints.push({
      id: constraintId, type, entityIds: [source, target],
      data: { refs: [{ entityId: source, point: 'b' }, { entityId: target, point: 'a' }] },
    });
  }
  return { part, alternate, foreign };
}

let invalidReferenceCases = 0;
for (const type of ['pointOnCurve', 'symmetric', 'coincident'] as const) {
  const { part: valid, alternate, foreign } = referenceDocument(type);
  const beforeValid = structuredClone(valid);
  assert.deepEqual(parseCadDocument(serializeCadDocument(valid)), valid, `${type} must round-trip exactly`);
  for (const schemaVersion of [1, 2, 3]) {
    const legacy = { ...structuredClone(valid), schemaVersion };
    const beforeLegacy = structuredClone(legacy);
    assert.deepEqual(migrateCadDocument(legacy), valid, `${type} v${schemaVersion} must preserve references`);
    assert.deepEqual(legacy, beforeLegacy, 'migration must not rewrite caller-owned data');
  }
  assert.deepEqual(valid, beforeValid, 'successful ingress must not mutate caller-owned data');

  const replacements = [
    { entityId: createCadId<CadSketchEntityId>('entity'), pattern: /references unknown entity/ },
    { entityId: foreign, pattern: /references entity .* owned by sketch .* not/ },
    { entityId: alternate, pattern: new RegExp(`${type} (?:refs|source) must match entityIds`) },
  ];
  for (let refIndex = 0; refIndex < (type === 'pointOnCurve' ? 1 : 2); refIndex += 1) {
    for (const { entityId, pattern } of replacements) {
      const invalid = structuredClone(valid);
      const constraint = invalid.constraints[0];
      if (constraint.type === 'pointOnCurve') constraint.data.source.entityId = entityId;
      else if (constraint.type === 'symmetric' || constraint.type === 'coincident') {
        constraint.data.refs[refIndex].entityId = entityId;
      } else throw new Error('Expected a point-reference constraint');
      const beforeInvalid = structuredClone(invalid);
      const label = `${type} ref ${refIndex} -> ${entityId}`;
      assert.throws(() => parseCadDocument(invalid), pattern, label);
      assert.throws(() => parseCadDocument(JSON.stringify(invalid)), pattern, label);
      assert.deepEqual(invalid, beforeInvalid, 'rejected parsing must not mutate its input');
      for (const schemaVersion of [1, 2, 3]) {
        const legacy = { ...structuredClone(invalid), schemaVersion };
        const beforeLegacy = structuredClone(legacy);
        assert.throws(() => migrateCadDocument(legacy), pattern, `${label}, v${schemaVersion}`);
        assert.deepEqual(legacy, beforeLegacy, 'rejected migration must not mutate its input');
      }
      invalidReferenceCases += 1;
    }
  }
}
assert.equal(invalidReferenceCases, 15);
console.log('M2O Part semantic validation PASS (ownership + dangling IDs + StableRef support + 15 point-reference ingress cases)');
