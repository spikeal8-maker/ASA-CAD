import assert from 'node:assert/strict';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  CadDocumentFutureVersionError,
  CadDocumentMigrationMissingError,
  createEmptyCadDocument,
  migrateCadDocument,
} from '../../src';

const current = createEmptyCadDocument('part');
assert.deepEqual(migrateCadDocument(current), current);

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

console.log('ASA-CAD M1 migration contract PASS');
