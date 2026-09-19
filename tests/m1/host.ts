import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  CadRevisionConflictError,
  LocalStorageCadProjectHost,
  MemoryCadProjectHost,
  createEmptyCadDocument,
} from '../../src';

const initial = createEmptyCadDocument('part', { title: 'Standalone project' });
const host = new MemoryCadProjectHost(initial, 3);

const loaded = await host.load();
assert.equal(loaded.revision, 3);
assert.deepEqual(loaded.document, initial);

const edited = structuredClone(initial);
edited.title = 'Standalone project edited';

const saved = await host.save({
  document: edited,
  baseRevision: 3,
  mutationId: 'mutation-1',
});
assert.equal(saved.revision, 4);

const retried = await host.save({
  document: edited,
  baseRevision: 3,
  mutationId: 'mutation-1',
});
assert.equal(retried.revision, 4, 'same mutationId must be idempotent');

const reopened = await host.load();
assert.equal(reopened.revision, 4);
assert.equal(reopened.document.title, 'Standalone project edited');
assert.notEqual(reopened.document, edited, 'host load must return serialized/parsed data, not original object identity');

await assert.rejects(
  () => host.save({ document: initial, baseRevision: 3, mutationId: 'mutation-2' }),
  (error: unknown) => {
    assert.ok(error instanceof CadRevisionConflictError);
    assert.equal(error.baseRevision, 3);
    assert.equal(error.currentRevision, 4);
    return true;
  },
);

const v2Raw = fs.readFileSync('tests/fixtures/schema/v2-part-radius.json', 'utf8');
const storageValues = new Map<string, string>([['schema-v2-host', v2Raw]]);
let storageWrites = 0;
const storage = {
  get length() { return storageValues.size; },
  clear() { storageValues.clear(); },
  getItem(key: string) { return storageValues.get(key) ?? null; },
  key(index: number) { return [...storageValues.keys()][index] ?? null; },
  removeItem(key: string) { storageValues.delete(key); },
  setItem(key: string, value: string) { storageWrites += 1; storageValues.set(key, value); },
} satisfies Storage;

const localHost = new LocalStorageCadProjectHost({
  initialDocument: createEmptyCadDocument('part'),
  storage,
  storageKey: 'schema-v2-host',
});
const migratedLocal = await localHost.load();
assert.equal(migratedLocal.document.schemaVersion, CAD_DOCUMENT_SCHEMA_VERSION);
assert.equal(CAD_DOCUMENT_SCHEMA_VERSION, 3);
assert.equal(storageWrites, 0, 'LocalStorage load must not rewrite migrated schema-v2 content');
assert.equal(storageValues.get('schema-v2-host'), v2Raw, 'stored raw v2 document must remain byte-identical after load');

console.log('ASA-CAD M1 host PASS (Memory host + LocalStorage v2->v3 ingress without rewrite)');
