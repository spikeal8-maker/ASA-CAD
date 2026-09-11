import assert from 'node:assert/strict';
import {
  CadEditorPersistence,
  CadProjectSession,
  LocalStorageCadProjectHost,
  LocalStorageCadRevisionConflictError,
  MemoryCadRecoveryStore,
  createEmptyCadDocument,
  parseCadDocument,
  type CadDocument,
} from '../../src';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
const initial = createEmptyCadDocument('part', { title: 'Initial Part' });
const host = new LocalStorageCadProjectHost({ initialDocument: initial, storage });
const recovery = new MemoryCadRecoveryStore();
let mutation = 0;
const session = new CadProjectSession({
  projectKey: 'm2o-o3',
  host,
  recovery,
  mutationIdFactory: () => `mutation-${++mutation}`,
  now: () => new Date('2026-09-11T18:00:00Z'),
});

let currentDocument: CadDocument = initial;
const application = {
  getDocument: () => currentDocument,
  replaceDocument: async (document: CadDocument) => { currentDocument = document; },
};
const persistence = new CadEditorPersistence(application, session, host);

assert.equal(await persistence.hasPersistedDocument(), false);
currentDocument = createEmptyCadDocument('part', { title: 'Saved Part' });
const firstSave = await persistence.save();
assert.equal(firstSave.revision, 1);
assert.equal(session.getRevision(), 1);
assert.equal(await persistence.hasPersistedDocument(), true);
assert.equal(await recovery.load('m2o-o3'), null, 'successful save must clear recovery');

const legacyRaw = storage.getItem('asa-cad-m2-shell-document');
assert.ok(legacyRaw, 'legacy raw JSON compatibility mirror must remain available');
assert.equal(parseCadDocument(legacyRaw).title, 'Saved Part');

currentDocument = createEmptyCadDocument('part', { title: 'Unsaved replacement' });
const reopened = await persistence.open();
assert.equal(reopened.revision, 1);
assert.equal(currentDocument.title, 'Saved Part');

const idempotent = await host.save({
  document: currentDocument,
  baseRevision: 1,
  mutationId: 'idempotent-direct',
});
assert.equal(idempotent.revision, 2);
const idempotentRetry = await host.save({
  document: createEmptyCadDocument('part', { title: 'Must not overwrite' }),
  baseRevision: 1,
  mutationId: 'idempotent-direct',
});
assert.equal(idempotentRetry.revision, 2);
assert.equal((await host.load()).document.title, 'Saved Part');

await assert.rejects(
  () => host.save({
    document: currentDocument,
    baseRevision: 0,
    mutationId: 'conflict',
  }),
  (error: unknown) => error instanceof LocalStorageCadRevisionConflictError
    && error.baseRevision === 0
    && error.currentRevision === 2,
);

console.log('M2O O3 persistence session PASS (session boundary + revision + mutation + legacy mirror)');
