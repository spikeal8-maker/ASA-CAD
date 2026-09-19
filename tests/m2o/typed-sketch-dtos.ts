import assert from 'node:assert/strict';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  createCadId,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadAngularDimension,
  type CadCoincidentConstraint,
  type CadDiameterDimension,
  type CadHorizontalConstraint,
  type CadHorizontalDimension,
  type CadLinearDimension,
  type CadRadiusDimension,
  type CadSketch,
  type CadSketchCircleEntity,
  type CadSketchEntityId,
  type CadSketchId,
  type CadSketchLineEntity,
  type CadVerticalDimension,
} from '../../src';
import type { CadConstraintId, CadDimensionId } from '../../src/contracts/ids';

assert.equal(CAD_DOCUMENT_SCHEMA_VERSION, 3, 'current typed Sketch DTO test must track schema v3');

const part = createEmptyCadDocument('part', { title: 'O7 typed sketch' });
const sketchId = createCadId<CadSketchId>('sketch');
const lineAId = createCadId<CadSketchEntityId>('entity');
const lineBId = createCadId<CadSketchEntityId>('entity');
const circleId = createCadId<CadSketchEntityId>('entity');

const lineA: CadSketchLineEntity = {
  id: lineAId,
  type: 'line',
  data: { from: [0, 0], to: [60, 0], role: 'typed-line-a' },
};
const lineB: CadSketchLineEntity = {
  id: lineBId,
  type: 'line',
  data: { from: [60, 0], to: [60, 40] },
};
const circle: CadSketchCircleEntity = {
  id: circleId,
  type: 'circle',
  data: { center: [30, 20], diameter: 12 },
};

const horizontalId = createCadId<CadConstraintId>('constraint');
const coincidentId = createCadId<CadConstraintId>('constraint');
const horizontal: CadHorizontalConstraint = {
  id: horizontalId,
  type: 'horizontal',
  entityIds: [lineAId],
};
const coincident: CadCoincidentConstraint = {
  id: coincidentId,
  type: 'coincident',
  entityIds: [lineAId, lineBId],
  data: {
    refs: [
      { entityId: lineAId, point: 'b' },
      { entityId: lineBId, point: 'a' },
    ],
  },
};

const linearId = createCadId<CadDimensionId>('dimension');
const diameterId = createCadId<CadDimensionId>('dimension');
const horizontalDimensionId = createCadId<CadDimensionId>('dimension');
const verticalDimensionId = createCadId<CadDimensionId>('dimension');
const radiusDimensionId = createCadId<CadDimensionId>('dimension');
const angularDimensionId = createCadId<CadDimensionId>('dimension');
const linear: CadLinearDimension = {
  id: linearId,
  type: 'linear',
  entityIds: [lineAId],
  value: 60,
  driving: true,
  name: 'width',
};
const diameter: CadDiameterDimension = {
  id: diameterId,
  type: 'diameter',
  entityIds: [circleId],
  value: 12,
  driving: true,
  name: 'diameter',
};
const horizontalDimension: CadHorizontalDimension = {
  id: horizontalDimensionId,
  type: 'horizontal',
  entityIds: [lineAId],
  value: 60,
  driving: true,
  name: 'horizontal-width',
};
const verticalDimension: CadVerticalDimension = {
  id: verticalDimensionId,
  type: 'vertical',
  entityIds: [lineBId],
  value: 40,
  driving: true,
  name: 'vertical-height',
};
const radiusDimension: CadRadiusDimension = {
  id: radiusDimensionId,
  type: 'radius',
  entityIds: [circleId],
  value: 6,
  driving: true,
  name: 'circle-radius',
};
const angularDimension: CadAngularDimension = {
  id: angularDimensionId,
  type: 'angular',
  entityIds: [lineAId, lineBId],
  value: 90,
  driving: true,
  name: 'line-angle',
};

const sketch: CadSketch = {
  id: sketchId,
  name: 'Эскиз 1',
  support: 'XY',
  entities: [lineA, lineB, circle],
  constraintIds: [horizontalId, coincidentId],
  dimensionIds: [linearId, diameterId, horizontalDimensionId, verticalDimensionId, radiusDimensionId, angularDimensionId],
};
part.sketches.push(sketch);
part.constraints.push(horizontal, coincident);
part.dimensions.push(linear, diameter, horizontalDimension, verticalDimension, radiusDimension, angularDimension);

const serialized = serializeCadDocument(part);
const parsed = parseCadDocument(serialized);
assert.deepEqual(parsed, part, 'typed schema-v3 Sketch DTO must round-trip without wire-format changes');
assert.equal(parsed.kind, 'part');
if (parsed.kind !== 'part') throw new Error('expected part');
assert.equal(parsed.sketches[0]?.entities[0]?.type, 'line');
assert.equal(parsed.sketches[0]?.entities[2]?.type, 'circle');

function mutateAndReject(mutator: (value: any) => void, pattern: RegExp): void {
  const value = JSON.parse(serialized);
  mutator(value);
  assert.throws(() => parseCadDocument(JSON.stringify(value)), pattern);
}

mutateAndReject(
  (value) => { value.sketches[0].entities[0].type = 'mystery-curve'; },
  /entities\[0\]\.type is unsupported/,
);
mutateAndReject(
  (value) => { value.sketches[0].entities[0].data.from = ['x', 0]; },
  /data\.from\[0\] must be finite/,
);
mutateAndReject(
  (value) => { value.sketches[0].support = 'freeform-plane'; },
  /support must be XY, XZ, YZ or a stable reference id/,
);
mutateAndReject(
  (value) => { value.constraints[1].data.refs = [{ entityId: lineAId }]; },
  /data\.refs must contain exactly two references/,
);
mutateAndReject(
  (value) => { value.dimensions[1].entityIds = [circleId, lineAId]; },
  /diameter requires exactly one entity id/,
);
mutateAndReject(
  (value) => { value.dimensions[0].type = 'mystery-dimension'; },
  /dimensions\[0\]\.type is unsupported/,
);
mutateAndReject(
  (value) => { value.dimensions[2].entityIds = [lineAId, lineBId]; },
  /horizontal requires exactly one entity id/,
);
mutateAndReject(
  (value) => { value.dimensions[3].entityIds = []; },
  /vertical requires exactly one entity id/,
);
mutateAndReject(
  (value) => { value.dimensions[2].value = 0; },
  /value must be positive/,
);
mutateAndReject(
  (value) => { value.dimensions[3].driving = 'yes'; },
  /driving must be boolean/,
);
mutateAndReject(
  (value) => { value.dimensions[4].entityIds = [circleId, lineAId]; },
  /radius requires exactly one entity id/,
);
mutateAndReject(
  (value) => { value.dimensions[4].value = 0; },
  /value must be positive/,
);
mutateAndReject(
  (value) => { value.dimensions[4].value = Number.POSITIVE_INFINITY; },
  /value must be finite/,
);
mutateAndReject(
  (value) => { value.dimensions[5].entityIds = [lineAId]; },
  /angular requires exactly two entity ids/,
);
mutateAndReject(
  (value) => { value.dimensions[5].entityIds = [lineAId, lineAId]; },
  /angular requires two distinct entity ids/,
);
mutateAndReject(
  (value) => { value.dimensions[5].value = 0; },
  /value must be positive/,
);
mutateAndReject(
  (value) => { value.dimensions[5].value = 180; },
  /angular value must be less than 180 degrees/,
);
mutateAndReject(
  (value) => { value.dimensions[5].value = 200; },
  /angular value must be less than 180 degrees/,
);
mutateAndReject(
  (value) => { value.dimensions[5].value = Number.POSITIVE_INFINITY; },
  /value must be finite/,
);
mutateAndReject(
  (value) => { value.dimensions[5].value = Number.NEGATIVE_INFINITY; },
  /value must be finite/,
);

const legacyCompatible = createEmptyCadDocument('part', { title: 'Legacy compatible' });
const legacySketchId = createCadId<CadSketchId>('sketch');
const legacyEntityId = createCadId<CadSketchEntityId>('entity');
const legacyJson = JSON.parse(serializeCadDocument(legacyCompatible));
legacyJson.sketches.push({
  id: legacySketchId,
  name: 'Эскиз 1',
  support: 'XY',
  entities: [{ id: legacyEntityId, type: 'line', data: { from: [0, 0], to: [10, 0] } }],
  constraintIds: [],
  dimensionIds: [],
});
const legacyParsed = parseCadDocument(JSON.stringify(legacyJson));
assert.equal(legacyParsed.kind, 'part');
assert.equal(legacyParsed.kind === 'part' ? legacyParsed.sketches.length : -1, 1);

console.log('M2O O7 typed Sketch DTO PASS (schema-v3 round-trip + Radius/Angular + strict malformed-shape rejection)');
