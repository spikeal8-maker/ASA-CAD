import assert from 'node:assert/strict';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDocumentKind,
} from '../../src/contracts';

const kinds: CadDocumentKind[] = [
  'part',
  'assembly',
  'drawing',
  'fragment',
  'specification',
  'text',
];

for (const kind of kinds) {
  const document = createEmptyCadDocument(kind, { title: `Test ${kind}` });
  assert.equal(document.kind, kind);
  assert.equal(document.schemaVersion, CAD_DOCUMENT_SCHEMA_VERSION);
  assert.equal(document.units, 'mm');
  assert.ok(document.documentId.startsWith('doc_'));

  const serialized = serializeCadDocument(document);
  const reopened = parseCadDocument(serialized);
  assert.deepEqual(reopened, document, `${kind} changed after serialize/parse`);
}

const part = createEmptyCadDocument('part');
assert.deepEqual(part.origin.planes, ['XY', 'XZ', 'YZ']);
assert.deepEqual(part.features, []);
assert.deepEqual(part.stableReferences, []);

const assembly = createEmptyCadDocument('assembly');
assert.deepEqual(assembly.occurrences, []);
assert.deepEqual(assembly.mates, []);

assert.throws(
  () => parseCadDocument({ kind: 'mesh', schemaVersion: 1 }),
  /Unsupported CadDocument kind/,
);
assert.throws(
  () => parseCadDocument({ ...part, schemaVersion: 999 }),
  /Unsupported CadDocument schemaVersion/,
);

console.log('ASA-CAD M1 public document contract PASS');
