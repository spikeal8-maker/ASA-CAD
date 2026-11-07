import assert from 'node:assert/strict';
import { BrowserPartRuntimeAdapter } from '../../src/browser/BrowserPartRuntimeAdapter';
import { LazyCadRuntimeLoader } from '../../src/browser/LazyCadRuntimeLoader';
import { evaluateCadCapabilities } from '../../src/browser/capabilities';
import { createEmptyCadDocument, type CadDocument } from '../../src/contracts/document';
import type { CadFeatureId } from '../../src/contracts/ids';
import type { CadRenderModel } from '../../src/contracts/render';
import type {
  CadReferenceCaptureRequest, CadRuntimeAdapter, CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult, CadRuntimeRequest,
} from '../../src/contracts/runtime';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = <T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> =>
  promise.then(value => ({ value }), error => ({ error }));
const clean = (): CadRuntimeRecomputeResult => ({ ok: true, diagnostics: [] });
const capabilities = evaluateCadCapabilities({
  webAssembly: true, sharedArrayBuffer: true, crossOriginIsolated: true,
  webgl: true, webgl2: true,
});
function part(title: string) {
  const document = createEmptyCadDocument('part', { title });
  document.features.push({
    id: 'browser-feature' as CadFeatureId, type: 'extrude', name: 'Block', suppressed: false,
    parameters: { sketchId: 'browser-sketch', distance: 2 }, inputReferences: [],
  });
  return document;
}
class RecordingRuntime implements CadRuntimeAdapter {
  builds: Array<{ document: Readonly<CadDocument>; ownership?: CadRuntimeRequest; gate: ReturnType<typeof deferred<CadRuntimeRecomputeResult>> }> = [];
  captures: Array<{ document: Readonly<CadDocument>; request: CadReferenceCaptureRequest; ownership?: CadRuntimeRequest; gate: ReturnType<typeof deferred<CadRuntimeReferenceCaptureResult>> }> = [];
  disposed = 0;
  recompute(document: Readonly<CadDocument>, ownership?: CadRuntimeRequest) {
    const gate = deferred<CadRuntimeRecomputeResult>();
    this.builds.push({ document, ownership, gate });
    return gate.promise;
  }
  captureReference(document: Readonly<CadDocument>, request: CadReferenceCaptureRequest, ownership?: CadRuntimeRequest) {
    const gate = deferred<CadRuntimeReferenceCaptureResult>();
    this.captures.push({ document, request, ownership, gate });
    return gate.promise;
  }
  dispose() { this.disposed++; }
}
function harness(deferLoad = false) {
  const runtime = new RecordingRuntime();
  const loadGate = deferred<void>();
  const rendered: Readonly<CadDocument>[] = [];
  let loads = 0;
  const render = {
    getRenderModel(document: Readonly<CadDocument>): CadRenderModel {
      rendered.push(structuredClone(document));
      const height = document.kind === 'part' ? Number(document.features[0]?.parameters.distance ?? 0) : 0;
      return {
        runtimeRevision: document.title + '-' + height,
        bounds: { minX: 0, minY: 0, minZ: 0, maxX: 20, maxY: 10, maxZ: height },
        meshes: [],
      };
    },
  };
  const loader = new LazyCadRuntimeLoader(() => capabilities, async () => {
    loads++;
    if (deferLoad) await loadGate.promise;
    return { runtime, render };
  });
  return { adapter: new BrowserPartRuntimeAdapter(loader), runtime, loadGate, rendered, get loads() { return loads; } };
}
// The deferred seam uses only deterministic Promise turns, not wall-clock sleeps.
async function entered(count: () => number, expected: number) {
  for (let turn = 0; turn < 30 && count() < expected; turn++) await Promise.resolve();
  assert.equal(count(), expected, 'expected adapter invocation did not occur');
}
function rejected(outcome: { error?: unknown }) {
  assert.ok(outcome.error instanceof Error);
  assert.match(outcome.error.message, /superseded|disposed/i);
}
const failures: string[] = [];
let passed = 0;
async function check(name: string, test: () => Promise<void>) {
  try { await test(); passed++; console.log('  PASS ' + name); }
  catch (error) { failures.push(name + ': ' + (error instanceof Error ? error.message : String(error))); console.log('  FAIL ' + name); }
}
await check('empty/non-Part/suppressed documents stay lazy', async () => {
  const h = harness();
  for (const document of [createEmptyCadDocument('part'), createEmptyCadDocument('text')]) {
    assert.equal((await h.adapter.recompute(document)).ok, true);
    assert.equal(h.adapter.getRenderModel(document), null);
  }
  const suppressed = part('Suppressed');
  suppressed.features[0].suppressed = true;
  await h.adapter.recompute(suppressed);
  assert.equal(h.loads, 0);
  assert.equal(h.runtime.builds.length, 0);
  h.adapter.dispose();
});
await check('new request wins while one lazy load is shared', async () => {
  const h = harness(true);
  const a = part('A'), b = structuredClone(a); b.title = 'B';
  const old = settle(h.adapter.recompute(a));
  const latest = h.adapter.recompute(b);
  h.loadGate.resolve();
  await entered(() => h.runtime.builds.length, 1);
  assert.equal(h.runtime.builds[0].document.title, 'B');
  h.runtime.builds[0].gate.resolve(clean());
  await latest;
  rejected(await old);
  assert.equal(h.loads, 1);
  assert.equal(h.rendered.length, 1);
  assert.equal(h.adapter.getRenderModel(a), null);
  assert.equal(h.adapter.getRenderModel(b)?.runtimeRevision, 'B-2');
  h.adapter.dispose();
});
await check('parent generation invalidates loaded work', async () => {
  const h = harness(), document = part('A');
  let current = true;
  const pending = settle(h.adapter.recompute(document, { isCurrent: () => current }));
  await entered(() => h.runtime.builds.length, 1);
  current = false;
  document.features[0].parameters.distance = 9;
  assert.equal(h.runtime.builds[0].ownership?.isCurrent(), false);
  h.runtime.builds[0].gate.resolve(clean());
  rejected(await pending);
  assert.equal(h.rendered.length, 0);
  assert.equal(h.adapter.getRenderModel(document), null);
  h.adapter.dispose();
});
for (const late of ['success', 'diagnostic', 'throw'] as const) {
  await check('late ' + late + ' cannot replace B render', async () => {
    const h = harness(), a = part('A'), b = structuredClone(a); b.title = 'B';
    const old = settle(h.adapter.recompute(a));
    await entered(() => h.runtime.builds.length, 1);
    const latest = h.adapter.recompute(b);
    await entered(() => h.runtime.builds.length, 2);
    h.runtime.builds[1].gate.resolve(clean());
    await latest;
    const model = h.adapter.getRenderModel(b);
    assert.ok(model);
    assert.equal(h.runtime.builds[0].ownership?.isCurrent(), false);
    if (late === 'throw') h.runtime.builds[0].gate.reject(new Error('A failed'));
    else h.runtime.builds[0].gate.resolve(late === 'success' ? clean() : {
      ok: false, diagnostics: [{ severity: 'error', code: 'OLD_ERROR', message: 'A failed' }],
    });
    const oldResult = await old;
    assert.ok(oldResult.error instanceof Error);
    assert.equal(h.adapter.getRenderModel(b), model);
    assert.equal(h.rendered.length, 1);
    h.adapter.dispose();
  });
}
await check('same-document rebuild keeps an immutable last valid model', async () => {
  const h = harness(), document = part('Same');
  const first = h.adapter.recompute(document);
  await entered(() => h.runtime.builds.length, 1);
  h.runtime.builds[0].gate.resolve(clean()); await first;
  const original = h.adapter.getRenderModel(document);
  assert.ok(original);
  document.features[0].parameters.distance = 7;
  const second = h.adapter.recompute(document);
  await entered(() => h.runtime.builds.length, 2);
  assert.equal(h.adapter.getRenderModel(document), original);
  assert.equal(original.bounds.maxZ, 2);
  assert.equal(h.rendered.length, 1, 'pending runtime must not be read using stale metadata');
  h.runtime.builds[1].gate.resolve(clean()); await second;
  assert.equal(h.adapter.getRenderModel(document)?.bounds.maxZ, 7);
  assert.equal(original.bounds.maxZ, 2, 'published DTO must remain detached from runtime mutation');
  h.adapter.dispose();
});
await check('no-BRep replacement invalidates older loaded requests', async () => {
  const h = harness(), a = part('A'), empty = createEmptyCadDocument('part');
  const old = settle(h.adapter.recompute(a));
  await entered(() => h.runtime.builds.length, 1);
  await h.adapter.recompute(empty);
  assert.equal(h.runtime.builds[0].ownership?.isCurrent(), false);
  h.runtime.builds[0].gate.resolve(clean());
  rejected(await old);
  assert.equal(h.rendered.length, 0);
  assert.equal(h.adapter.getRenderModel(empty), null);
  h.adapter.dispose();
});
await check('dispose during shared lazy load releases exactly one instance', async () => {
  const h = harness(true), document = part('A');
  const first = settle(h.adapter.recompute(document));
  const second = settle(h.adapter.recompute(document));
  h.adapter.dispose();
  h.loadGate.resolve();
  rejected(await first); rejected(await second);
  assert.equal(h.runtime.disposed, 1);
  assert.equal(h.runtime.builds.length, 0);
  assert.equal(h.adapter.getLoadState().status, 'idle');
  assert.equal(h.adapter.getRenderModel(document), null);
});
await check('dispose during runtime wait cannot republish render', async () => {
  const h = harness(), document = part('A');
  const pending = settle(h.adapter.recompute(document));
  await entered(() => h.runtime.builds.length, 1);
  h.adapter.dispose();
  h.runtime.builds[0].gate.resolve(clean());
  rejected(await pending);
  assert.equal(h.runtime.disposed, 1);
  assert.equal(h.rendered.length, 0);
  assert.equal(h.adapter.getRenderModel(document), null);
  rejected(await settle(h.adapter.recompute(document)));
});
await check('reference completion from A cannot publish over B', async () => {
  const h = harness(), a = part('A'), b = structuredClone(a); b.title = 'B';
  const old = settle(h.adapter.captureReference(a, {
    kind: 'edge', sourceFeatureId: a.features[0].id, point: [0, 0, 0], semanticRole: 'edge',
  }));
  await entered(() => h.runtime.captures.length, 1);
  const latest = h.adapter.recompute(b);
  await entered(() => h.runtime.builds.length, 1);
  h.runtime.builds[0].gate.resolve(clean()); await latest;
  const model = h.adapter.getRenderModel(b);
  h.runtime.captures[0].gate.resolve({
    ownerFeatureId: a.features[0].id, semanticRole: 'edge', locator: { kind: 'edge' },
  });
  rejected(await old);
  assert.equal(h.adapter.getRenderModel(b), model);
  assert.equal(h.rendered.length, 1);
  h.adapter.dispose();
});
await check('capture snapshots inputs and does not cancel its own rebuild', async () => {
  const h = harness(true), document = part('Capture');
  const point: [number, number, number] = [1, 2, 3];
  const pending = h.adapter.captureReference(document, {
    kind: 'face', sourceFeatureId: document.features[0].id, point, semanticRole: 'top',
  });
  point[0] = 99;
  document.features[0].parameters.distance = 7;
  h.loadGate.resolve();
  await entered(() => h.runtime.captures.length, 1);
  const call = h.runtime.captures[0];
  assert.deepEqual(call.request.point, [1, 2, 3]);
  assert.equal(call.ownership?.isCurrent(), true);
  assert.equal(call.document.kind, 'part');
  if (call.document.kind !== 'part') throw new Error('Expected Part');
  assert.equal(call.document.features[0].parameters.distance, 2);
  call.gate.resolve({ ownerFeatureId: document.features[0].id, semanticRole: 'top', locator: { kind: 'face' } });
  assert.equal((await pending).semanticRole, 'top');
  assert.equal(h.adapter.getRenderModel(document)?.bounds.maxZ, 2);
  h.adapter.dispose();
});
console.log('Browser runtime async ownership: ' + passed + ' PASS, ' + failures.length + ' FAIL');
assert.equal(failures.length, 0, failures.join('\n'));
