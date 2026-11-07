import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import esbuild from '../../vendor/toubkal/node_modules/esbuild/lib/main.js';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

async function exerciseRecoveryStore() {
  const { IndexedDbCadRecoveryStore: Store, createEmptyCadDocument, serializeCadDocument } = globalThis.recoveryApi;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const dbName = 'asa-recovery-test-' + crypto.randomUUID();
  const first = new Store(indexedDB, dbName), second = new Store(indexedDB, dbName);
  const record = (key, id, title) => ({
    projectKey: key, pendingMutationId: id, baseRevision: 0,
    savedAt: '2026-11-07T00:00:00.000Z', document: createEmptyCadDocument('part', { title }),
  });
  // close() can remain pending until its readonly transaction completes.
  // A blocked event is diagnostic; only delete success proves cleanup.
  function deleteDatabaseAfterClose(name, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const state = { blockedEvents: 0, deleted: false };
      const request = indexedDB.deleteDatabase(name);
      const deadline = setTimeout(() => reject(new Error(
        'test DB deletion did not complete within ' + timeoutMs + 'ms (blocked=' + state.blockedEvents + ')',
      )), timeoutMs);
      request.onsuccess = () => { clearTimeout(deadline); state.deleted = true; resolve(state); };
      request.onerror = () => { clearTimeout(deadline); reject(request.error ?? new Error('test DB deletion failed')); };
      request.onblocked = () => { state.blockedEvents += 1; };
    });
  }
  const cases = [];
  let cleanup;
  try {
    const original = record('snapshot', 'snapshot-id', 'Before open');
    original.document.metadata.note = 'before';
    const save = first.save(original);
    original.document.title = 'After call';
    original.document.metadata.note = 'after';
    original.pendingMutationId = 'changed-id';
    original.baseRevision = 99;
    await save;
    const snapshot = await second.load('snapshot');
    check(snapshot.document.title === 'Before open' && snapshot.document.metadata.note === 'before', 'IndexedDB input snapshot changed during open');
    check(snapshot.pendingMutationId === 'snapshot-id' && snapshot.baseRevision === 0, 'record identity/base changed across await');
    cases.push('snapshot-before-open');

    await first.clearAcknowledged('absent', 'old');
    await first.save(record('identity', undefined, 'Legacy'));
    await second.clearAcknowledged('identity', 'old');
    check((await first.load('identity')).document.title === 'Legacy', 'ACK must preserve legacy record without mutation ID');
    await first.save(record('identity', 'new', 'Newer'));
    await second.clearAcknowledged('identity', 'old');
    check((await first.load('identity')).pendingMutationId === 'new', 'mismatching ACK must preserve newer recovery');
    let rejected = false;
    try { await first.clearAcknowledged('identity', ''); } catch (error) { rejected = /mutationId/.test(error.message); }
    check(rejected, 'empty acknowledgement identity must reject');
    await second.clearAcknowledged('identity', 'new');
    check(await first.load('identity') === null, 'matching ACK must clear recovery');
    await first.save(record('identity', 'pending', 'Discard'));
    await second.clear('identity');
    check(await first.load('identity') === null, 'explicit discard must remain unconditional');
    cases.push('identity-match-mismatch-legacy-discard');

    // Queue the competing writer exactly when ACK reads A. Both connections and
    // transactions are native IndexedDB. A split readonly-load/delete loses B.
    await first.save(record('atomic', 'A', 'A'));
    const writer = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const readObserved = deferred(), writerDone = deferred();
    let injected = false;
    const observedFactory = {
      open(name, version) {
        const request = indexedDB.open(name, version);
        request.addEventListener('success', () => {
          const db = request.result, transaction = db.transaction.bind(db);
          db.transaction = (...args) => {
            const tx = transaction(...args), objectStore = tx.objectStore.bind(tx);
            tx.objectStore = (...names) => {
              const store = objectStore(...names), get = store.get.bind(store);
              store.get = (...keys) => {
                const read = get(...keys);
                read.addEventListener('success', () => {
                  if (injected) return;
                  injected = true;
                  const newer = record('atomic', 'B', 'B');
                  const competing = writer.transaction('projects', 'readwrite');
                  competing.oncomplete = writerDone.resolve;
                  competing.onerror = () => writerDone.reject(competing.error);
                  competing.onabort = () => writerDone.reject(competing.error);
                  competing.objectStore('projects').put({
                    projectKey: newer.projectKey, serializedDocument: serializeCadDocument(newer.document),
                    baseRevision: newer.baseRevision, savedAt: newer.savedAt, pendingMutationId: newer.pendingMutationId,
                  });
                  readObserved.resolve();
                });
                return read;
              };
              return store;
            };
            return tx;
          };
        });
        return request;
      },
    };
    try {
      const cleared = new Store(observedFactory, dbName).clearAcknowledged('atomic', 'A');
      await readObserved.promise;
      await Promise.all([cleared, writerDone.promise]);
      check((await second.load('atomic')).pendingMutationId === 'B', 'concurrent writer B must survive A ACK compare/delete');
    } finally {
      writer.close();
    }
    cases.push('atomic-two-connection-interleave');


  } finally {
    cleanup = await deleteDatabaseAfterClose(dbName);
  }
  return { cases, cleanup };
}

const bundled = await esbuild.build({
  stdin: {
    contents: [
      "export { IndexedDbCadRecoveryStore } from './src/host/CadRecoveryStore';",
      "export { createEmptyCadDocument, serializeCadDocument } from './src/contracts/document';",
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'recoveryApi',
}).finally(() => esbuild.stop());
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/recovery.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundled.outputFiles[0].contents);
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><script src="/recovery.js"></script>');
  }
});
let browser, context, result, timer;
const errors = [];
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  assert.ok(![8094, 8098, 8099].includes(port));
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    ...(process.env.ASA_CAD_BROWSER_EXECUTABLE ? { executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE } : {}),
  });
  context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + port, { waitUntil: 'load', timeout: 15000 });
  result = await Promise.race([
    page.evaluate(exerciseRecoveryStore),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('IndexedDB timeout')), 20000); }),
  ]);
  assert.deepEqual(errors, []);
  assert.equal(result.cases.length, 3);
  assert.equal(result.cleanup.deleted, true);
} finally {
  clearTimeout(timer);
  try { await context?.close(); }
  finally {
    try { await browser?.close(); }
    finally {
      if (server.listening) await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  }
}
assert.equal(server.listening, false);
assert.equal(browser.isConnected(), false);
console.log(JSON.stringify({ status: 'PASS', cases: result.cases, databaseCleanup: result.cleanup, ownedServerClosed: true, ownedBrowserClosed: true }));
