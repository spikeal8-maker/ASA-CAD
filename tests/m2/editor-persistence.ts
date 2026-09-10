import assert from 'node:assert/strict';
import { createEmptyCadDocument } from '../../src/contracts/document';
import { CadRevisionConflictError } from '../../src/host/MemoryCadProjectHost';
import { LocalStorageCadProjectHost } from '../../src/host/LocalStorageCadProjectHost';

class TestStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const storage = new TestStorage() as unknown as Storage;
const initial = createEmptyCadDocument('part', { title: 'Initial' });
const host = new LocalStorageCadProjectHost('test-part', initial, storage);

assert.equal(host.hasStoredProject(), false);
const firstLoad = await host.load();
assert.equal(firstLoad.revision, 0);
assert.equal(firstLoad.document.title, 'Initial');

const edited = structuredClone(firstLoad.document);
edited.title = 'Saved';
const firstSave = await host.save({ document: edited, baseRevision: 0, mutationId: 'mutation-1' });
assert.equal(firstSave.revision, 1);
assert.equal(host.hasStoredProject(), true);

const duplicate = await host.save({ document: edited, baseRevision: 0, mutationId: 'mutation-1' });
assert.equal(duplicate.revision, 1, 'duplicate mutationId must be idempotent');

const reopened = await host.load();
assert.equal(reopened.revision, 1);
assert.equal(reopened.document.title, 'Saved');

await assert.rejects(
  () => host.save({ document: edited, baseRevision: 0, mutationId: 'mutation-2' }),
  (error: unknown) => error instanceof CadRevisionConflictError && error.currentRevision === 1,
);

assert.match(host.getStorageKey(), /^asa-cad-project:/);
console.log('ASA-CAD standalone LocalStorageCadProjectHost PASS');
