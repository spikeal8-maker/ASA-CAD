import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  CadDocumentFutureVersionError,
  CadDocumentMigrationMissingError,
  createEmptyCadDocument,
  migrateCadDocument,
  parseCadDocument,
} from '../../src';

assert.equal(CAD_DOCUMENT_SCHEMA_VERSION, 3);

const current = createEmptyCadDocument('part');
assert.deepEqual(migrateCadDocument(current), current);

const schemaPolicy = JSON.parse(
  fs.readFileSync('spec/process/cad-document-schema-policy.v1.json', 'utf8'),
) as {
  currentCadDocumentSchemaVersion: number;
  schemas: Array<{ version: number; dimensionTypes: string[]; fixture: string }>;
};
assert.equal(schemaPolicy.currentCadDocumentSchemaVersion, CAD_DOCUMENT_SCHEMA_VERSION);

for (const schema of schemaPolicy.schemas) {
  const fixture = JSON.parse(fs.readFileSync(schema.fixture, 'utf8'));
  assert.equal(fixture.schemaVersion, schema.version);
  const migrated = migrateCadDocument(fixture);
  assert.equal(migrated.schemaVersion, CAD_DOCUMENT_SCHEMA_VERSION);
}

const fixture = (version: number) => {
  const schema = schemaPolicy.schemas.find((item) => item.version === version);
  assert.ok(schema, `Schema v${version} policy entry missing`);
  return JSON.parse(fs.readFileSync(schema.fixture, 'utf8'));
};

const v1Fixture = fixture(1);
const migratedV1 = migrateCadDocument(v1Fixture);
assert.deepEqual(
  migratedV1,
  { ...v1Fixture, schemaVersion: 3 },
  'v1 -> v2 -> v3 must preserve all persisted content except schemaVersion',
);
assert.deepEqual(
  migratedV1.kind === 'part' ? migratedV1.dimensions.map((dimension) => dimension.type) : [],
  ['linear', 'horizontal', 'vertical', 'diameter'],
);

const invalidV1Radius = structuredClone(v1Fixture);
invalidV1Radius.dimensions[0].type = 'radius';
assert.throws(
  () => migrateCadDocument(invalidV1Radius),
  /Schema v1 dimensions\[0\]\.type is unsupported: radius/,
);

const v2Fixture = fixture(2);
const migratedV2 = migrateCadDocument(v2Fixture);
assert.deepEqual(
  migratedV2,
  { ...v2Fixture, schemaVersion: 3 },
  'v2 -> v3 must preserve Radius fixture content except schemaVersion',
);
assert.equal(migratedV2.kind, 'part');
if (migratedV2.kind !== 'part') throw new Error('Expected migrated v2 Part fixture');
const radiusBefore = v2Fixture.dimensions.find((dimension: any) => dimension.type === 'radius');
const radiusAfter = migratedV2.dimensions.find((dimension) => dimension.type === 'radius');
assert.deepEqual(radiusAfter, radiusBefore, 'v2 Radius dimension must survive migration unchanged');
assert.deepEqual(migratedV2.sketches, v2Fixture.sketches, 'v2 geometry must survive migration unchanged');

const invalidV2Angular = structuredClone(v2Fixture);
invalidV2Angular.dimensions[0].type = 'angular';
invalidV2Angular.dimensions[0].entityIds = [
  invalidV2Angular.sketches[0].entities[0].id,
  invalidV2Angular.sketches[0].entities[0].id,
];
invalidV2Angular.dimensions[0].value = 60;
assert.throws(
  () => migrateCadDocument(invalidV2Angular),
  /Schema v2 dimensions\[0\]\.type is unsupported: angular/,
  'schema-v2 Angular must be rejected before the v3 version bump',
);

const v3Fixture = fixture(3);
const migratedV3 = migrateCadDocument(v3Fixture);
assert.deepEqual(migratedV3, v3Fixture, 'native schema-v3 fixture must open without semantic changes');
assert.equal(migratedV3.kind, 'part');
if (migratedV3.kind !== 'part') throw new Error('Expected v3 Part fixture');
const angular = migratedV3.dimensions.find((dimension) => dimension.type === 'angular');
assert.ok(angular);
assert.deepEqual(angular.entityIds, ['entity_line_a_v3', 'entity_line_b_v3']);
assert.equal(angular.value, 60);

assert.throws(
  () => parseCadDocument(v2Fixture),
  /Unsupported CadDocument schemaVersion: 2/,
  'raw v2 must not masquerade as native v3 outside migration ingress',
);

assert.throws(
  () => migrateCadDocument({ ...current, schemaVersion: 4 }),
  (error: unknown) => {
    assert.ok(error instanceof CadDocumentFutureVersionError);
    assert.equal(error.documentVersion, 4);
    assert.equal(error.supportedVersion, 3);
    return true;
  },
);

assert.throws(
  () => migrateCadDocument({ ...current, schemaVersion: 0 }),
  (error: unknown) => {
    assert.ok(error instanceof CadDocumentMigrationMissingError);
    assert.equal(error.fromVersion, 0);
    assert.equal(error.toVersion, 1);
    return true;
  },
);

console.log('ASA-CAD M1 migration contract PASS (v1->v3 chain + v2->v3 guard + v3 Angular fixture)');
