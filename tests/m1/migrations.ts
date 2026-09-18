import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  CadDocumentFutureVersionError,
  CadDocumentMigrationMissingError,
  createEmptyCadDocument,
  migrateCadDocument,
} from '../../src';

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
if (migratedV1.kind !== 'part') throw new Error('Expected Part fixture');
assert.deepEqual(
  migratedV1.dimensions.map((dimension) => dimension.type),
  ['linear', 'horizontal', 'vertical', 'diameter'],
  'schema-v1 fixture must preserve the frozen Dimension grammar through migration/open',
);

const unknownSameVersion = structuredClone(v1Fixture);
unknownSameVersion.dimensions[0].type = 'angular';
assert.throws(
  () => migrateCadDocument(unknownSameVersion),
  /dimensions\[0\]\.type is unsupported: angular/,
  'same-version unknown persisted discriminant must be rejected explicitly',
);

assert.throws(
  () => migrateCadDocument({ ...current, schemaVersion: CAD_DOCUMENT_SCHEMA_VERSION + 1 }),
  (error: unknown) => {
    assert.ok(error instanceof CadDocumentFutureVersionError);
    assert.equal(error.documentVersion, CAD_DOCUMENT_SCHEMA_VERSION + 1);
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

// Future-proof guard: every declared older-schema fixture above is always opened
// through migrateCadDocument(). If current becomes v2+ without the required
// sequential migration registration, that fixture loop fails in CI.
console.log('ASA-CAD M1 migration contract PASS (declared schema fixtures + exact grammar rejection)');
