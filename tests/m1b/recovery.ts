import assert from 'node:assert/strict';
import {
  CadHostNetworkError,
  CadProjectSession,
  MemoryCadProjectHost,
  MemoryCadRecoveryStore,
  createEmptyCadDocument,
  type CadDocument,
  type CadProjectHost,
} from '../../src';

class FlakyHost implements CadProjectHost {
  failNextSave = true;
  readonly inner: MemoryCadProjectHost;

  constructor(document: CadDocument, revision: number) {
    this.inner = new MemoryCadProjectHost(document, revision);
  }

  load() {
    return this.inner.load();
  }

  async save(input: Parameters<CadProjectHost['save']>[0]) {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new CadHostNetworkError('simulated offline');
    }
    return this.inner.save(input);
  }
}

const initial = createEmptyCadDocument('part', { title: 'Before offline edit' });
const host = new FlakyHost(initial, 2);
const recovery = new MemoryCadRecoveryStore();
let mutationCounter = 0;
const session = new CadProjectSession({
  projectKey: 'project-1',
  host,
  recovery,
  mutationIdFactory: () => `mutation-${++mutationCounter}`,
  now: () => new Date('2026-09-10T10:00:00.000Z'),
});

const opened = await session.open();
assert.equal(opened.revision, 2);
assert.equal(opened.recovery, null);

const edited = structuredClone(opened.document);
edited.title = 'Edited while network fails';

await assert.rejects(() => session.save(edited), CadHostNetworkError);
assert.equal(session.getRevision(), 2, 'failed server save must not advance authoritative revision');

const pending = await recovery.load('project-1');
assert.ok(pending, 'failed save must retain local recovery');
assert.equal(pending.baseRevision, 2);
assert.equal(pending.pendingMutationId, 'mutation-1');
assert.equal(pending.document.title, 'Edited while network fails');
assert.equal(pending.savedAt, '2026-09-10T10:00:00.000Z');

const retried = await session.retryRecovery();
assert.equal(retried?.revision, 3);
assert.equal(session.getRevision(), 3);
assert.equal(await recovery.load('project-1'), null, 'recovery is cleared only after server acknowledgement');

const remote = await host.load();
assert.equal(remote.revision, 3);
assert.equal(remote.document.title, 'Edited while network fails');

console.log('ASA-CAD M1B recovery/save session PASS');


function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

async function scenario(name: string, run: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      run(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(name + ' timed out')), 5000); }),
    ]);
    console.log('Recovery concurrency PASS: ' + name);
  } finally {
    clearTimeout(timer);
  }
}

function fixture(host: CadProjectHost) {
  const recovery = new MemoryCadRecoveryStore();
  let mutation = 0;
  const session = new CadProjectSession({
    projectKey: 'concurrent-project', host, recovery,
    mutationIdFactory: () => 'save-' + ++mutation,
  });
  return { session, recovery, key: 'concurrent-project' };
}
const document = (title: string) => createEmptyCadDocument('part', { title });
const isConflict = (error: unknown) => error instanceof Error
  && 'code' in error && error.code === 'CAD_REVISION_CONFLICT';

await scenario('older ACK preserves newer conflicted recovery without queueing network saves', async () => {
  const inner = new MemoryCadProjectHost(document('Initial'));
  const appliedA = deferred<void>(), acknowledgeA = deferred<void>();
  const host: CadProjectHost = {
    load: () => inner.load(),
    async save(input) {
      const result = await inner.save(input);
      if (input.mutationId === 'save-1') {
        appliedA.resolve();
        await acknowledgeA.promise;
      }
      return result;
    },
  };
  const { session, recovery, key } = fixture(host);
  await session.open();
  const saveA = session.save(document('Saved A'));
  await appliedA.promise;
  await assert.rejects(session.save(document('Unsaved B')), isConflict);
  const newer = await recovery.load(key);
  assert.equal(newer?.document.title, 'Unsaved B', 'B must be durable while A ACK is still pending');
  assert.equal(newer?.pendingMutationId, 'save-2');
  assert.equal(newer?.baseRevision, 0);
  acknowledgeA.resolve();
  assert.equal((await saveA).revision, 1);
  assert.deepEqual(await recovery.load(key), newer, 'A ACK must not clear B recovery');
  assert.equal(session.getRevision(), 1);
  await assert.rejects(session.retryRecovery(), isConflict, 'conflict retry must not silently rebase/overwrite');
  assert.deepEqual(await recovery.load(key), newer);
  assert.equal((await inner.load()).document.title, 'Saved A');
  await session.discardRecovery();
  assert.equal(await recovery.load(key), null, 'explicit discard remains unconditional');
});

await scenario('late idempotent retry cannot clear latest recovery or regress the current revision', async () => {
  const inner = new MemoryCadProjectHost(document('Initial'));
  const retryApplied = deferred<void>(), acknowledgeRetry = deferred<void>();
  let loseFirstAck = true, failLatest = true;
  const host: CadProjectHost = {
    load: () => inner.load(),
    async save(input) {
      if (input.mutationId === 'save-3' && failLatest) {
        failLatest = false;
        throw new CadHostNetworkError('C is offline');
      }
      const result = await inner.save(input);
      if (input.mutationId === 'save-1') {
        if (loseFirstAck) {
          loseFirstAck = false;
          throw new CadHostNetworkError('A was applied but its ACK was lost');
        }
        retryApplied.resolve();
        await acknowledgeRetry.promise;
      }
      return result;
    },
  };
  const { session, recovery, key } = fixture(host);
  await session.open();
  await assert.rejects(session.save(document('A')), CadHostNetworkError);
  assert.equal((await session.open()).revision, 1);
  const retryA = session.retryRecovery();
  await retryApplied.promise;
  assert.equal((await session.save(document('B'))).revision, 2);
  await assert.rejects(session.save(document('Latest C')), CadHostNetworkError);
  const latest = await recovery.load(key);
  assert.equal(latest?.pendingMutationId, 'save-3');
  acknowledgeRetry.resolve();
  assert.equal((await retryA)?.revision, 1, 'idempotent retry returns its original host ACK');
  assert.equal(session.getRevision(), 2, 'old retry ACK must not lower current session revision');
  assert.deepEqual(await recovery.load(key), latest, 'old retry ACK must not delete C');
  assert.equal((await inner.load()).revision, 2, 'retry must not append another host revision');
  assert.equal((await session.retryRecovery())?.revision, 3);
  assert.equal(await recovery.load(key), null);
  assert.equal((await inner.load()).document.title, 'Latest C');
});

await scenario('save snapshots nested caller input before its first await', async () => {
  const inner = new MemoryCadProjectHost(document('Initial'));
  const { session, recovery, key } = fixture({
    load: () => inner.load(),
    async save(input) {
      assert.deepEqual(input.document, (await recovery.load(key))?.document, 'host and recovery must receive the same snapshot');
      return inner.save(input);
    },
  });
  await session.open();
  const input = document('Snapshot');
  input.metadata.note = 'before';
  const saved = session.save(input);
  input.title = 'Changed by caller';
  input.metadata.note = 'after';
  await saved;
  const stored = await inner.load();
  assert.equal(stored.document.title, 'Snapshot');
  assert.equal(stored.document.metadata.note, 'before');
  assert.equal(input.metadata.note, 'after', 'save must not freeze or mutate the caller document');
});

await scenario('ACK from before a completed open cannot bless that reopened snapshot', async () => {
  const inner = new MemoryCadProjectHost(document('Opened revision zero'));
  const opened = deferred<Awaited<ReturnType<CadProjectHost['load']>>>();
  const appliedA = deferred<void>(), acknowledgeA = deferred<void>();
  let delayOpen = false;
  const host: CadProjectHost = {
    load: () => delayOpen ? opened.promise : inner.load(),
    async save(input) {
      const result = await inner.save(input);
      if (input.mutationId === 'save-1') {
        appliedA.resolve();
        await acknowledgeA.promise;
      }
      return result;
    },
  };
  const { session, recovery, key } = fixture(host);
  const initial = await session.open();
  delayOpen = true;
  const reopening = session.open();
  const saving = session.save(document('Applied revision one'));
  await appliedA.promise;
  opened.resolve(initial);
  assert.equal((await reopening).revision, 0);
  acknowledgeA.resolve();
  assert.equal((await saving).revision, 1);
  assert.equal(session.getRevision(), 0, 'newly opened document keeps its own optimistic base');
  await assert.rejects(session.save(document('Edit of reopened zero')), isConflict);
  assert.equal((await recovery.load(key))?.document.title, 'Edit of reopened zero');
  assert.equal((await inner.load()).document.title, 'Applied revision one');
});

await scenario('failed open does not invalidate a valid pending acknowledgement', async () => {
  const inner = new MemoryCadProjectHost(document('Initial'));
  const applied = deferred<void>(), acknowledge = deferred<void>();
  let failOpen = false;
  const { session } = fixture({
    load: () => failOpen ? Promise.reject(new CadHostNetworkError('open failed')) : inner.load(),
    async save(input) {
      const result = await inner.save(input);
      applied.resolve();
      await acknowledge.promise;
      return result;
    },
  });
  await session.open();
  const saved = session.save(document('Saved'));
  await applied.promise;
  failOpen = true;
  await assert.rejects(session.open(), CadHostNetworkError);
  acknowledge.resolve();
  await saved;
  assert.equal(session.getRevision(), 1);
});

await scenario('Memory acknowledgement clear matches mutation identity and preserves legacy recovery', async () => {
  const recovery = new MemoryCadRecoveryStore();
  const record = { projectKey: 'identity', document: document('Pending'), baseRevision: 0, savedAt: '2026-11-07T00:00:00.000Z' };
  await recovery.clearAcknowledged(record.projectKey, 'missing');
  await recovery.save(record);
  await recovery.clearAcknowledged(record.projectKey, 'unrelated');
  assert.ok(await recovery.load(record.projectKey), 'legacy recovery without mutation ID is not acknowledged');
  await recovery.save({ ...record, pendingMutationId: 'newer' });
  await recovery.clearAcknowledged(record.projectKey, 'older');
  assert.equal((await recovery.load(record.projectKey))?.pendingMutationId, 'newer');
  await assert.rejects(recovery.clearAcknowledged(record.projectKey, ''), /mutationId/);
  await recovery.clearAcknowledged(record.projectKey, 'newer');
  assert.equal(await recovery.load(record.projectKey), null);
});

console.log('ASA-CAD M1B concurrent recovery, immutable snapshots and acknowledgement ownership PASS');
