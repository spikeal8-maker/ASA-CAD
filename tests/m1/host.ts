import assert from 'node:assert/strict';
import {
  CadRevisionConflictError,
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

console.log('ASA-CAD M1 MemoryCadProjectHost PASS');
