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

assert.equal(CAD_DOCUMENT_SCHEMA_VERSION, 2);

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

const v1 = schemaPolicy.schemas.find((schema) => schema.version === 1);
assert.ok(v1);
const v1Fixture = JSON.parse(fs.readFileSync(v1.fixture, 'utf8'));
const migratedV1 = migrateCadDocument(v1Fixture);
assert.equal(migratedV1.kind, 'part');
if (migratedV1.kind !== 'part') throw new Error('Expected migrated v1 Part fixture');
assert.equal(migratedV1.schemaVersion, 2);
assert.deepEqual(
  migratedV1,
  { ...v1Fixture, schemaVersion: 2 },
  'v1 -> v2 migration must preserve all persisted content except schemaVersion',
);
assert.deepEqual(
  migratedV1.dimensions.map((dimension) => dimension.type),
  ['linear', 'horizontal', 'vertical', 'diameter'],
);
assert.throws(
  () => parseCadDocument(v1Fixture),
  /Unsupported CadDocument schemaVersion: 1/,
  'raw v1 must not masquerade as native v2 outside the migration boundary',
);

const invalidV1Radius = structuredClone(v1Fixture);
invalidV1Radius.dimensions[0].type = 'radius';
assert.throws(
  () => migrateCadDocument(invalidV1Radius),
  /Schema v1 dimensions\[0\]\.type is unsupported: radius/,
  'schema-v1 must reject the new Radius discriminant before migration to v2',
);

const v2 = schemaPolicy.schemas.find((schema) => schema.version === 2);
assert.ok(v2);
const v2Fixture = JSON.parse(fs.readFileSync(v2.fixture, 'utf8'));
const migratedV2 = migrateCadDocument(v2Fixture);
assert.equal(migratedV2.kind, 'part');
if (migratedV2.kind !== 'part') throw new Error('Expected v2 Part fixture');
assert.equal(migratedV2.schemaVersion, 2);
assert.ok(migratedV2.dimensions.some((dimension) => dimension.type === 'radius'));
assert.ok(migratedV2.sketches[0]?.entities.some((entity) => entity.type === 'circle'));
assert.ok(migratedV2.sketches[0]?.entities.some((entity) => entity.type === 'arc'));

assert.throws(
  () => migrateCadDocument({ ...current, schemaVersion: 3 }),
  (error: unknown) => {
    assert.ok(error instanceof CadDocumentFutureVersionError);
    assert.equal(error.documentVersion, 3);
    assert.equal(error.supportedVersion, 2);
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

// Removing built-in migration 1 -> 2 makes the declared v1 fixture loop above
// fail with CadDocumentMigrationMissingError. This keeps SCHEMA-001 enforced.
console.log('ASA-CAD M1 migration contract PASS (v1->v2 identity migration + v2 Radius fixture + exact versioning)');
