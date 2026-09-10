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
