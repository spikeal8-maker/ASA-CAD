import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { createEmptyCadDocument, parseCadDocument, serializeCadDocument, type CadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadRuntimeAdapter } from '../../src/contracts/runtime';
import type { CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import { LocalCadProjects } from '../../src/host/LocalCadProjects';
import { DEFAULT_STANDALONE_CAD_STORAGE_KEY as LEGACY_KEY, LocalStorageCadProjectHost, LocalStorageCadRevisionConflictError } from '../../src/host/LocalStorageCadProjectHost';
import { collectLocalCadBackup, downloadLocalCadBackup } from '../../src/web/launcher/backup';
import type { CadEditorMode } from '../../src/browser/editorModes';

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();
  get length(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); }
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  key(index: number): string | null { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string): void { this.entries.delete(key); }
  setItem(key: string, value: string): void { this.entries.set(key, String(value)); }
  snapshot(): Array<[string, string]> { return [...this.entries].sort(([a], [b]) => a.localeCompare(b)); }
}

// These tests prove document intent and storage. They deliberately cannot report
// a successful B-Rep rebuild: browser/OpenCascade proof belongs to its own gate.
const noKernel: CadRuntimeAdapter = {
  async recompute(): Promise<never> { throw new Error('This persistence test must not simulate a kernel rebuild'); },
  async captureReference(): Promise<never> { throw new Error('No runtime reference capture in a persistence test'); },
  dispose() {},
};

function part(app: CadApplicationImpl): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

function snapshot(document: Readonly<CadDocument>): CadDocument {
  return parseCadDocument(serializeCadDocument(document));
}

function seedLegacy(storage: MemoryStorage) {
  const oldDocument = createEmptyCadDocument('part', { title: 'Прежняя деталь' });
  const raw = `\n${JSON.stringify(oldDocument, null, 2)}\n`;
  const authoritative = { ...oldDocument, title: 'Сохранённая прежняя деталь' };
  const envelope = `${JSON.stringify({ serializedDocument: serializeCadDocument(authoritative), revision: 7, mutations: { 'old-save': 7 } }, null, '\t')}\n`;
  storage.setItem(LEGACY_KEY, raw);
  storage.setItem(`${LEGACY_KEY}:state`, envelope);
  return { raw, envelope, authoritative };
}

await test('new projects in both modes cannot overwrite either legacy document slot', async () => {
  const storage = new MemoryStorage();
  const legacy = seedLegacy(storage);
  const projects = new LocalCadProjects(storage);
  const kompas = projects.create('kompas', '  Компас — новая деталь  ');
  const fusion = projects.create('fusion', 'Fusion — новая деталь');
  assert.notEqual(kompas, fusion);
  const a = projects.host(kompas, 'kompas'), b = projects.host(fusion, 'fusion');
  const [first, second] = await Promise.all([a.load(), b.load()]);
  assert.notEqual(first.document.documentId, second.document.documentId);
  assert.equal(first.document.title, 'Компас — новая деталь');
  await a.save({ document: { ...first.document, title: 'Компас сохранён' }, baseRevision: first.revision, mutationId: 'new-kompas' });
  await b.save({ document: { ...second.document, title: 'Fusion сохранён' }, baseRevision: second.revision, mutationId: 'new-fusion' });
  assert.equal((await a.load()).document.title, 'Компас сохранён');
  assert.equal((await b.load()).document.title, 'Fusion сохранён');
  assert.equal(storage.getItem(LEGACY_KEY), legacy.raw);
  assert.equal(storage.getItem(`${LEGACY_KEY}:state`), legacy.envelope);
  const beforeRead = storage.snapshot();
  assert.deepEqual((await projects.host('legacy', 'fusion').load()).document, legacy.authoritative,
    'the canonical envelope must win over a stale raw mirror');
  assert.equal(projects.list().find(project => project.id === 'legacy')?.updatedAt, undefined,
    'historical projects without metadata must not acquire an invented date');
  assert.deepEqual(storage.snapshot(), beforeRead, 'opening/listing cannot migrate storage silently');
});

await test('an unreadable project cannot hide healthy projects and catalog reads retain all raw bytes', async () => {
  const storage = new MemoryStorage();
  const projects = new LocalCadProjects(storage);
  const healthy = projects.create('fusion', 'Доступная модель');
  const broken = projects.create('kompas', 'Повреждённая модель');
  storage.setItem(`asa-cad-local-project:${broken}:state`, '{broken envelope');
  storage.setItem(LEGACY_KEY, '{broken legacy');
  const before = storage.snapshot();
  assert.throws(() => projects.list(), 'strict callers must not silently ignore corruption');
  const unreadable: string[] = [];
  assert.deepEqual(projects.list(id => unreadable.push(id)).map(project => project.id), [healthy]);
  assert.deepEqual(unreadable.sort(), [broken, 'legacy'].sort());
  assert.equal((await projects.host(healthy, 'fusion').load()).document.title, 'Доступная модель');
  assert.throws(() => projects.host(broken, 'kompas'));
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(projects.backup().entries[`asa-cad-local-project:${broken}:state`], '{broken envelope');
  const metadataOnly = projects.create('kompas', 'Модель с повреждённой датой');
  const metadataKey = `asa-cad-local-project:${metadataOnly}:state`;
  const envelope = JSON.parse(storage.getItem(metadataKey)!);
  for (const updatedAt of [42, null, [], {}, 'not a date']) {
    const raw = JSON.stringify({ ...envelope, launcher: { mode: 'kompas', updatedAt } });
    storage.setItem(metadataKey, raw);
    const listed = projects.list(() => {});
    assert.equal(listed.length, 2);
    assert.equal(listed.find(project => project.id === metadataOnly)?.updatedAt, undefined);
    assert.equal(storage.getItem(metadataKey), raw);
  }
});

await test('real sketch commands remain editable after save and reopen in the other shell', async () => {
  const storage = new MemoryStorage();
  const projects = new LocalCadProjects(storage);
  const id = projects.create('kompas', 'Эскиз для двух редакторов');
  const kompas = projects.host(id, 'kompas');
  const opened = await kompas.load();
  const first = new CadApplicationImpl(opened.document, noKernel);
  const created = await first.execute({ id: 'sketch.create', payload: { support: 'XY' } });
  assert.equal(created.ok, true, created.error?.message);
  const sketchId = created.createdIds?.[0] as CadSketchId;
  assert.ok(sketchId);
  const rectangle = await first.execute({ id: 'sketch.rectangle', payload: { sketchId, origin: [0, 0], width: 60, height: 40 } });
  assert.equal(rectangle.ok, true, rectangle.error?.message);
  assert.equal(rectangle.createdIds?.length, 4);
  const saved = snapshot(first.getDocument());
  await kompas.save({ document: saved, baseRevision: opened.revision, mutationId: 'rectangle-save' });
  first.dispose();

  const reloadedCatalog = new LocalCadProjects(storage);
  const fusion = reloadedCatalog.host(id, 'fusion');
  const reopened = await fusion.load();
  assert.equal(reopened.revision, 1);
  assert.deepEqual(reopened.document, saved, 'all geometry, IDs and document fields survive reopening');
  const second = new CadApplicationImpl(reopened.document, noKernel);
  const originalEdges = structuredClone(part(second).sketches[0].entities);
  const circle = await second.execute({ id: 'sketch.circle', payload: { sketchId, center: [80, 20], diameter: 14 } });
  assert.equal(circle.ok, true, circle.error?.message);
  const circleId = circle.createdIds?.[0] as CadSketchEntityId;
  assert.ok(circleId);
  const moved = await second.execute({ id: 'sketch.entity.translate', payload: { sketchId, entityId: circleId, delta: [5, -2] } });
  assert.equal(moved.ok, true, moved.error?.message);
  const editedSketch = part(second).sketches.find(sketch => sketch.id === sketchId)!;
  assert.deepEqual(editedSketch.entities.slice(0, 4), originalEdges, 'editing retains existing geometry and stable IDs');
  const editedCircle = editedSketch.entities.find(entity => entity.id === circleId);
  assert.ok(editedCircle?.type === 'circle');
  assert.deepEqual(editedCircle.data.center, [85, 18]);
  assert.equal(editedCircle.data.diameter, 14);
  assert.equal(second.getDocument().documentId, saved.documentId);
  assert.equal(second.getState().canUndo, true, 'reopened documents accept real history-producing commands');
  await fusion.save({ document: snapshot(second.getDocument()), baseRevision: reopened.revision, mutationId: 'fusion-edit' });
  assert.deepEqual((await kompas.load()).document, second.getDocument(), 'the first shell sees the same saved document');
  assert.equal((await kompas.load()).revision, 2);
  assert.deepEqual(projects.ids(), [id], 'switching shells must not create a second project');
  second.dispose();
});

await test('two hosts reject stale saves and retain idempotency without prototype collisions', async () => {
  const storage = new MemoryStorage();
  const catalog = new LocalCadProjects(storage);
  const id = catalog.create('kompas', 'Общий проект');
  const a = catalog.host(id, 'kompas'), b = catalog.host(id, 'fusion');
  const [left, right] = await Promise.all([a.load(), b.load()]);
  const winner = { ...left.document, title: 'Сохранено в первой вкладке' };
  assert.equal((await a.save({ document: winner, baseRevision: left.revision, mutationId: 'first' })).revision, 1);
  const storedWinner = storage.snapshot();
  await assert.rejects(() => b.save({ document: { ...right.document, title: 'Устаревшая вкладка' }, baseRevision: right.revision, mutationId: 'stale' }),
    (error: unknown) => error instanceof LocalStorageCadRevisionConflictError && error.baseRevision === 0 && error.currentRevision === 1);
  assert.deepEqual(storage.snapshot(), storedWinner, 'a conflict cannot replace the winner or its metadata');
  assert.equal((await a.save({ document: right.document, baseRevision: 0, mutationId: 'first' })).revision, 1);
  assert.deepEqual(storage.snapshot(), storedWinner, 'retrying an acknowledged mutation cannot write again');
  for (const [mutationId, baseRevision] of [['toString', 1], ['__proto__', 2]] as const) {
    assert.equal((await b.save({ document: winner, baseRevision, mutationId })).revision, baseRevision + 1);
    assert.equal((await b.save({ document: right.document, baseRevision, mutationId })).revision, baseRevision + 1);
  }
  assert.equal((await a.load()).revision, 3);
  assert.equal((await a.load()).document.title, winner.title);
});

await test('malformed envelopes fail closed and remain recoverable as exact backup bytes', async context => {
  const document = createEmptyCadDocument('part', { title: 'Не перезаписывать' });
  const valid = { serializedDocument: serializeCadDocument(document), revision: 2, mutations: {} };
  const cases: Record<string, string> = {
    empty: '', invalidJson: '{', null: 'null',
    missingDocument: JSON.stringify({ revision: 2, mutations: {} }),
    invalidDocument: JSON.stringify({ ...valid, serializedDocument: '{}' }),
    negativeRevision: JSON.stringify({ ...valid, revision: -1 }),
    fractionalRevision: JSON.stringify({ ...valid, revision: 1.5 }),
    arrayMutations: JSON.stringify({ ...valid, mutations: [] }),
    invalidMutationRevision: JSON.stringify({ ...valid, mutations: { saved: '2' } }),
    futureMutationRevision: JSON.stringify({ ...valid, mutations: { saved: 3 } }),
  };
  for (const [name, envelope] of Object.entries(cases)) await context.test(name, () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, serializeCadDocument(document));
    storage.setItem(`${LEGACY_KEY}:state`, envelope);
    const before = storage.snapshot();
    const catalog = new LocalCadProjects(storage);
    assert.throws(() => catalog.host('legacy', 'kompas'));
    assert.throws(() => catalog.list());
    assert.equal(catalog.backup().entries[`${LEGACY_KEY}:state`], envelope);
    assert.deepEqual(storage.snapshot(), before);
  });
});

await test('an existing host cannot fall back to a mirror after its envelope is corrupted', async context => {
  for (const operation of ['load', 'save'] as const) await context.test(operation, async () => {
    const storage = new MemoryStorage();
    const legacy = seedLegacy(storage);
    const host = new LocalCadProjects(storage).host('legacy', 'fusion');
    storage.setItem(`${LEGACY_KEY}:state`, '');
    const before = storage.snapshot();
    await assert.rejects(() => operation === 'load' ? host.load()
      : host.save({ document: legacy.authoritative, baseRevision: 0, mutationId: 'must-not-repair' }));
    assert.deepEqual(storage.snapshot(), before, 'corruption is preserved, never silently repaired by Save');
  });
});

await test('existing hosts preserve corrupt document bytes before save and acknowledged retries', async context => {
  const valid = createEmptyCadDocument('part');
  const danglingSupport = JSON.stringify({ ...valid, sketches: [{
    id: 'sketch_corrupt', name: 'Dangling support', support: 'ref_missing', entities: [], constraintIds: [], dimensionIds: [],
  }] });
  assert.throws(() => parseCadDocument(danglingSupport), /support reference ref_missing does not exist/);
  const contents = { invalidJson: '{', missingFields: '{}', null: 'null', danglingSupport,
    futureSchema: JSON.stringify({ ...valid, schemaVersion: valid.schemaVersion + 1 }) };
  for (const source of ['envelope', 'raw'] as const) for (const [name, bytes] of Object.entries(contents)) {
    await context.test(`${source}: ${name}`, async () => {
      const storage = new MemoryStorage();
      seedLegacy(storage);
      if (source === 'raw') storage.removeItem(`${LEGACY_KEY}:state`);
      const catalog = new LocalCadProjects(storage), host = catalog.host('legacy', 'kompas');
      const opened = await host.load();
      const key = source === 'envelope' ? `${LEGACY_KEY}:state` : LEGACY_KEY;
      storage.setItem(key, source === 'envelope' ? JSON.stringify({
        ...JSON.parse(storage.getItem(key)!), serializedDocument: bytes,
      }) : bytes);
      const before = storage.snapshot();
      await assert.rejects(() => host.load());
      await assert.rejects(() => host.save({ document: opened.document,
        baseRevision: opened.revision, mutationId: 'must-not-replace-corruption' }));
      if (source === 'envelope') await assert.rejects(() => host.save({
        document: opened.document, baseRevision: opened.revision, mutationId: 'old-save',
      }), 'an old acknowledgement cannot hide corruption in the current canonical document');
      assert.deepEqual(storage.snapshot(), before, 'rejection must preserve every original slot byte for backup');
      assert.equal(catalog.backup().entries[key], before.find(([name]) => name === key)![1]);
    });
  }
});

await test('valid older schemas remain readable without storage migration and save through the same host', async context => {
  for (const [schema, fixture] of [[1, 'v1-part-dimensions.json'], [2, 'v2-part-radius.json']] as const) {
    const raw = readFileSync(new URL(`../fixtures/schema/${fixture}`, import.meta.url), 'utf8');
    for (const source of ['raw', 'envelope'] as const) await context.test(`v${schema} ${source}`, async () => {
      const storage = new MemoryStorage();
      storage.setItem(LEGACY_KEY, raw);
      if (source === 'envelope') storage.setItem(`${LEGACY_KEY}:state`, JSON.stringify({
        serializedDocument: raw, revision: 4, mutations: { acknowledged: 4 },
      }, null, 2));
      const before = storage.snapshot();
      const host = new LocalCadProjects(storage).host('legacy', 'fusion');
      const loaded = await host.load();
      assert.equal(loaded.document.documentId, JSON.parse(raw).documentId);
      assert.equal(loaded.document.schemaVersion, createEmptyCadDocument('part').schemaVersion);
      assert.deepEqual(storage.snapshot(), before, 'validation/load cannot rewrite the older serialized format');
      const saved = await host.save({ document: loaded.document, baseRevision: loaded.revision, mutationId: 'explicit-save' });
      assert.equal(saved.revision, loaded.revision + 1);
      assert.deepEqual((await host.load()).document, loaded.document);
    });
  }
});

await test('a legitimate empty initial document can save and a corrupt mirror cannot defeat its valid envelope', async () => {
  const storage = new MemoryStorage(), initialDocument = createEmptyCadDocument('part');
  const host = new LocalStorageCadProjectHost({ storage, initialDocument });
  const opened = await host.load();
  assert.deepEqual(opened.document, initialDocument);
  assert.equal(opened.revision, 0);
  assert.equal(storage.length, 0, 'opening a fresh host must not write an envelope');
  assert.deepEqual(await host.save({ document: opened.document, baseRevision: 0, mutationId: 'first-empty-save' }), { revision: 1 });
  storage.setItem(LEGACY_KEY, 'broken non-authoritative mirror');
  assert.deepEqual((await host.load()).document, initialDocument);
  assert.deepEqual(await host.save({ document: initialDocument, baseRevision: 1, mutationId: 'second-empty-save' }), { revision: 2 });
  const beforeConflict = storage.snapshot();
  await assert.rejects(() => host.save({ document: initialDocument, baseRevision: 0, mutationId: 'stale-empty-save' }),
    (error: unknown) => error instanceof LocalStorageCadRevisionConflictError && error.currentRevision === 2);
  assert.deepEqual(storage.snapshot(), beforeConflict);
});

await test('backup exports only document slots and import restores into a fresh project', async () => {
  const storage = new MemoryStorage();
  const legacy = seedLegacy(storage);
  storage.setItem('auth.access_token', 'private-auth-test-value');
  storage.setItem('session', 'private-session-test-value');
  storage.setItem('asa-cad-ui-scale', '125');
  const catalog = new LocalCadProjects(storage);
  const id = catalog.create('fusion', 'Новый проект');
  const document = (await catalog.host(id, 'fusion').load()).document;
  const before = storage.snapshot();
  const backup = catalog.backup();
  assert.equal(backup.format, 'asa-cad-local-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.entries[LEGACY_KEY], legacy.raw);
  assert.equal(backup.entries[`${LEGACY_KEY}:state`], legacy.envelope);
  assert.equal(Object.keys(backup.entries).length, 3, 'two legacy slots and one newly created project envelope');
  for (const key of ['auth.access_token', 'session', 'asa-cad-ui-scale']) assert.equal(Object.hasOwn(backup.entries, key), false);
  assert.equal(JSON.stringify(backup).includes('private-auth-test-value'), false);
  assert.deepEqual(storage.snapshot(), before, 'export must not write to browser storage');
  const imported = catalog.importDocument(document, 'kompas');
  assert.notEqual(imported, id);
  assert.deepEqual((await catalog.host(imported, 'kompas').load()).document, document);
  for (const [key, bytes] of before) assert.equal(storage.getItem(key), bytes, 'import must preserve all existing entries');
});

await test('one stable host records the current shell only when a new save is committed', async () => {
  const storage = new MemoryStorage();
  const catalog = new LocalCadProjects(storage);
  const id = catalog.create('kompas', 'Одна история для двух оболочек');
  let mode: CadEditorMode = 'kompas';
  let modeReads = 0;
  const host = catalog.host(id, () => { modeReads += 1; return mode; });
  const opened = await host.load();
  assert.equal(modeReads, 0, 'opening the host must not rewrite presentation metadata');
  mode = 'fusion';
  await host.save({ document: opened.document, baseRevision: 0, mutationId: 'fusion-save' });
  assert.equal(catalog.list()[0].mode, 'fusion');
  assert.equal(modeReads, 1);
  mode = 'kompas';
  const beforeReplay = storage.snapshot();
  await host.save({ document: opened.document, baseRevision: 0, mutationId: 'fusion-save' });
  assert.deepEqual(storage.snapshot(), beforeReplay, 'an acknowledged retry cannot rewrite the current shell');
  assert.equal(modeReads, 1);
  await host.save({ document: opened.document, baseRevision: 1, mutationId: 'kompas-save' });
  assert.equal(catalog.list()[0].mode, 'kompas');
  assert.equal((await host.load()).revision, 2, 'the same host keeps its revision contract across shell changes');
  assert.equal(modeReads, 2);
  assert.deepEqual(catalog.ids(), [id]);
});

await test('raw backup retains readable slots when enumeration or an individual read fails', () => {
  class FailingStorage extends MemoryStorage {
    override getItem(key: string): string | null {
      if (key === `${LEGACY_KEY}:state`) throw new Error('denied envelope');
      return super.getItem(key);
    }
    override key(index: number): string | null {
      if (index === 0) throw new Error('denied slot name');
      return super.key(index);
    }
  }
  const storage = new FailingStorage();
  storage.setItem(LEGACY_KEY, 'malformed legacy bytes remain valuable');
  storage.setItem(`${LEGACY_KEY}:state`, 'unreadable envelope');
  storage.setItem('asa-cad-local-project:orphan:state', '\n{"not":"a valid document"}\n');
  storage.setItem('asa-cad-local-project:legacy:state', 'a raw namespaced orphan, not the standalone slot');
  storage.setItem('session', 'not part of this export');
  const before = storage.snapshot();
  const backup = new LocalCadProjects(storage).backup();
  assert.equal(backup.complete, false);
  assert.equal(backup.errors.length, 2);
  assert.ok(backup.errors.some(error => error.key === `${LEGACY_KEY}:state`));
  assert.equal(backup.entries[LEGACY_KEY], 'malformed legacy bytes remain valuable');
  assert.equal(backup.entries['asa-cad-local-project:orphan:state'], '\n{"not":"a valid document"}\n');
  assert.equal(backup.entries['asa-cad-local-project:legacy:state'], 'a raw namespaced orphan, not the standalone slot');
  assert.equal(Object.hasOwn(backup.entries, 'session'), false);
  assert.deepEqual(storage.snapshot(), before);
});

type RawRecoveryEntry = { key: string; value: unknown };
/** Event-driven IndexedDB boundary double: no browser, no migration or simulated persistence success. */
function recoveryReader(entries: RawRecoveryEntry[], options: { absent?: boolean; disappeared?: boolean; failAt?: number } = {}) {
  const calls = { open: 0, abort: 0, close: 0, transactions: [] as string[] };
  const factory = {
    async databases() { return options.absent ? [] : [{ name: 'asa-cad-recovery', version: 1 }]; },
    open(name: string, version?: number) {
      calls.open += 1;
      assert.equal(name, 'asa-cad-recovery');
      assert.equal(version, undefined, 'export cannot request a schema upgrade');
      const request = {} as IDBOpenDBRequest;
      const database = {
        objectStoreNames: { contains: (store: string) => store === 'projects' },
        close() { calls.close += 1; },
        transaction(store: string, mode: IDBTransactionMode) {
          assert.equal(store, 'projects');
          assert.equal(mode, 'readonly', 'backup must never open a write transaction');
          calls.transactions.push(mode);
          const transaction = {} as IDBTransaction;
          const objectStore = {
            openCursor() {
              const cursorRequest = {} as IDBRequest<IDBCursorWithValue | null>;
              let index = 0;
              const next = () => queueMicrotask(() => {
                if (options.failAt === index) {
                  Object.defineProperty(cursorRequest, 'error', { value: new Error('cursor read failed') });
                  cursorRequest.onerror?.call(cursorRequest, new Event('error'));
                  return;
                }
                const entry = entries[index++];
                Object.defineProperty(cursorRequest, 'result', { configurable: true, value: entry ? {
                  primaryKey: entry.key, value: structuredClone(entry.value), continue: next,
                } : null });
                cursorRequest.onsuccess?.call(cursorRequest, new Event('success'));
                if (!entry) queueMicrotask(() => transaction.oncomplete?.call(transaction, new Event('complete')));
              });
              next();
              return cursorRequest;
            },
          };
          Object.defineProperty(transaction, 'objectStore', { value: () => objectStore });
          return transaction;
        },
      };
      Object.defineProperty(request, 'result', { value: database });
      Object.defineProperty(request, 'transaction', { value: { abort() { calls.abort += 1; } } });
      queueMicrotask(() => {
        if (options.disappeared) request.onupgradeneeded?.call(request, new Event('upgradeneeded') as IDBVersionChangeEvent);
        else request.onsuccess?.call(request, new Event('success'));
      });
      return request;
    },
  } as unknown as IDBFactory;
  return { factory, calls };
}

await test('full backup exports every raw recovery record including server and orphan keys without migrating documents', async () => {
  const storage = new MemoryStorage();
  const legacy = seedLegacy(storage);
  const records = [
    { key: 'asa-cad:standalone', value: { projectKey: 'asa-cad:standalone', serializedDocument: '\n{broken-document\n', baseRevision: 2 } },
    { key: 'asa-cad:remote-project-id', value: { projectKey: 'asa-cad:remote-project-id', serializedDocument: 'server recovery bytes', pendingMutationId: 'pending', savedAt: 'raw timestamp' } },
    { key: 'asa-cad:local:orphan', value: { projectKey: 'asa-cad:local:orphan', serializedDocument: 'orphan recovery bytes', extra: { retained: true } } },
  ];
  const originalRecords = structuredClone(records), before = storage.snapshot();
  const { factory, calls } = recoveryReader(records);
  const backup = await collectLocalCadBackup(new LocalCadProjects(storage), { indexedDb: factory, origin: 'http://127.0.0.1:8099' });
  assert.equal(backup.version, 2);
  assert.equal(backup.complete, true);
  assert.deepEqual(backup.errors, []);
  assert.equal(backup.recovery.status, 'read');
  assert.deepEqual(backup.recovery.records, records);
  assert.equal(backup.entries[LEGACY_KEY], legacy.raw);
  assert.equal(backup.entries[`${LEGACY_KEY}:state`], legacy.envelope);
  assert.deepEqual(records, originalRecords);
  assert.deepEqual(storage.snapshot(), before);
  assert.deepEqual(calls, { open: 1, abort: 0, close: 1, transactions: ['readonly'] });
});

await test('missing recovery is not opened and a database disappearing during export is never created', async () => {
  const catalog = new LocalCadProjects(new MemoryStorage());
  const absent = recoveryReader([], { absent: true });
  const empty = await collectLocalCadBackup(catalog, { indexedDb: absent.factory });
  assert.equal(empty.complete, true);
  assert.equal(empty.recovery.status, 'absent');
  assert.equal(absent.calls.open, 0, 'opening a missing database would create an empty replacement');
  const disappeared = recoveryReader([], { disappeared: true });
  const partial = await collectLocalCadBackup(catalog, { indexedDb: disappeared.factory });
  assert.equal(partial.complete, false);
  assert.equal(disappeared.calls.abort, 1, 'abort the upgrade transaction before it can create a new database');
  assert.deepEqual(disappeared.calls.transactions, []);
  const unsupported = recoveryReader([]);
  Object.defineProperty(unsupported.factory, 'databases', { value: undefined });
  const unavailable = await collectLocalCadBackup(catalog, { indexedDb: unsupported.factory });
  assert.equal(unavailable.complete, false);
  assert.equal(unsupported.calls.open, 0, 'unknown database existence is not permission to create a database');
});

await test('cursor failure and non-JSON corruption retain other raw records and report an incomplete backup', async () => {
  const storage = new MemoryStorage();
  const legacy = seedLegacy(storage);
  const catalog = new LocalCadProjects(storage);
  const records = [{ key: 'readable', value: { serializedDocument: 'raw bytes' } }, { key: 'failed', value: {} }];
  const interrupted = recoveryReader(records, { failAt: 1 });
  const partial = await collectLocalCadBackup(catalog, { indexedDb: interrupted.factory });
  assert.equal(partial.complete, false);
  assert.equal(partial.recovery.status, 'partial');
  assert.deepEqual(partial.recovery.records, records.slice(0, 1));
  assert.equal(partial.entries[LEGACY_KEY], legacy.raw);
  assert.match(partial.errors[0].message, /cursor read failed/);
  const corrupted = recoveryReader([
    { key: 'bad', value: { unexpected: undefined } },
    { key: 'date', value: { unexpected: new Date('2026-01-01T00:00:00Z') } },
    records[0],
  ]);
  const preserved = await collectLocalCadBackup(catalog, { indexedDb: corrupted.factory });
  assert.equal(preserved.complete, false, 'JSON must not silently turn Dates into strings');
  assert.deepEqual(preserved.errors.map(error => error.key), ['date']);
  assert.deepEqual(preserved.recovery.records, [
    { key: 'bad', value: { unexpected: undefined }, undefinedPaths: [['unexpected']] }, records[0],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(preserved)).recovery.records[0], {
    key: 'bad', value: {}, undefinedPaths: [['unexpected']],
  }, 'optional undefined fields remain recoverable through explicit paths rather than silently disappearing');
  const optional = await collectLocalCadBackup(catalog, { indexedDb: recoveryReader([
    { key: 'legacy-optional', value: { serializedDocument: 'raw', pendingMutationId: undefined } },
  ]).factory });
  assert.equal(optional.complete, true, 'a valid optional field stored as undefined must not make the export partial');
});

await test('partial backup still requests a download with an explicit partial filename and manifest', async context => {
  const storage = new MemoryStorage();
  const legacy = seedLegacy(storage);
  let clicked = false, removed = false, captured: Blob | undefined;
  const link = { href: '', download: '', click() { clicked = true; }, remove() { removed = true; } };
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: (tag: string) => { assert.equal(tag, 'a'); return link; },
    body: { appendChild: (element: unknown) => assert.equal(element, link) },
  } });
  context.mock.method(URL, 'createObjectURL', (blob: Blob) => { captured = blob; return 'blob:backup-test'; });
  context.mock.method(URL, 'revokeObjectURL', () => {});
  const originalTimeout = globalThis.setTimeout;
  context.mock.method(globalThis, 'setTimeout', (callback: () => void, delay?: number) => originalTimeout(callback, delay === 60000 ? 0 : delay));
  try {
    const result = await downloadLocalCadBackup(new LocalCadProjects(storage), { indexedDb: null });
    assert.equal(result.complete, false);
    assert.ok(result.errors.some(error => error.source === 'indexedDB'));
    assert.match(result.fileName, /-partial\.json$/);
    assert.equal(link.download, result.fileName);
    assert.ok(clicked && removed && captured);
    const bytes = Buffer.from(await captured.arrayBuffer());
    const manifest = JSON.parse(bytes.toString('utf8'));
    assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'), 'checksum covers the exact UTF-8 download bytes');
    assert.equal(result.localEntries, 2);
    assert.equal(result.recoveryRecords, 0);
    assert.equal(manifest.complete, false);
    assert.equal(manifest.entries[LEGACY_KEY], legacy.raw);
    assert.equal(manifest.entries[`${LEGACY_KEY}:state`], legacy.envelope);
    context.mock.method(globalThis.crypto.subtle, 'digest', async () => { throw new Error('checksum unavailable'); });
    const withoutChecksum = await downloadLocalCadBackup(new LocalCadProjects(storage), { indexedDb: recoveryReader([], { absent: true }).factory });
    assert.equal(withoutChecksum.complete, true, 'checksum availability is separate from completeness of source reads');
    assert.deepEqual(withoutChecksum.errors, []);
    assert.equal(withoutChecksum.sha256, undefined);
    assert.match(withoutChecksum.checksumError ?? '', /checksum unavailable/);
    assert.equal(withoutChecksum.fileName.includes('-partial'), false);
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
