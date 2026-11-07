import assert from 'node:assert/strict';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { createEmptyCadDocument, type CadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadFeatureId, CadSketchId } from '../../src/contracts/ids';
import type {
  CadReferenceCaptureRequest, CadRuntimeAdapter, CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../../src/contracts/runtime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const clean = (): CadRuntimeRecomputeResult => ({ ok: true, diagnostics: [] });
const failed = (message: string): CadRuntimeRecomputeResult => ({
  ok: false, diagnostics: [{ severity: 'error', code: 'TEST_FAILURE', message }],
});
class DeferredRuntime implements CadRuntimeAdapter {
  builds: Array<ReturnType<typeof deferred<CadRuntimeRecomputeResult>>> = [];
  captures: Array<ReturnType<typeof deferred<CadRuntimeReferenceCaptureResult>>> = [];
  captureStarted = deferred<void>();
  disposed = false;
  recompute(_document: Readonly<CadDocument>) {
    const gate = deferred<CadRuntimeRecomputeResult>();
    this.builds.push(gate);
    return gate.promise;
  }
  captureReference(_document: Readonly<CadDocument>, _request: CadReferenceCaptureRequest) {
    const gate = deferred<CadRuntimeReferenceCaptureResult>();
    this.captures.push(gate);
    this.captureStarted.resolve();
    return gate.promise;
  }
  dispose() { this.disposed = true; }
}
const cases: string[] = [];
const failures: string[] = [];
async function check(name: string, test: () => Promise<void>) {
  try { await test(); cases.push(name); console.log('  PASS ' + name); }
  catch (error) { failures.push(name + ': ' + (error instanceof Error ? error.message : String(error))); console.log('  FAIL ' + name); }
}
function superseded(result: Awaited<ReturnType<CadApplicationImpl['execute']>>) {
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.error?.code, 'CAD_OPERATION_SUPERSEDED');
}
function rejectCapture(result: { value?: string; error?: unknown }) {
  assert.ok(result.error instanceof Error, 'superseded reference capture must reject explicitly');
  assert.match(result.error.message, /superseded|disposed/i);
  assert.equal(result.value, undefined);
}
const settledCapture = (promise: Promise<string>): Promise<{ value?: string; error?: unknown }> => promise.then(
  value => ({ value }), error => ({ error }),
);
async function featureApp(runtime: DeferredRuntime) {
  const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Capture A' }), runtime);
  const sketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
  const sketchId = sketch.createdIds![0] as CadSketchId;
  await app.execute({ id: 'sketch.rectangle', payload: { sketchId, origin: [0, 0], width: 20, height: 10 } });
  const feature = await app.execute({ id: 'feature.extrude', payload: { sketchId, distance: 5 } });
  const request: CadReferenceCaptureRequest = {
    kind: 'edge', sourceFeatureId: feature.createdIds![0] as CadFeatureId,
    point: [0, 0, 0], semanticRole: 'audit-edge',
  };
  const pending = app.execute({ id: 'document.rebuild', payload: {} });
  runtime.builds.at(-1)!.resolve(clean());
  assert.equal((await pending).ok, true);
  return { app, request };
}
function captured(request: CadReferenceCaptureRequest): CadRuntimeReferenceCaptureResult {
  return {
    ownerFeatureId: request.sourceFeatureId, semanticRole: request.semanticRole,
    locator: { kind: request.kind, point: [...request.point] },
  };
}

for (const sameId of [false, true]) {
  for (const late of ['success', 'diagnostic', 'throw'] as const) {
    await check('replace ' + (sameId ? 'same ID' : 'different ID') + ' / late ' + late, async () => {
      const runtime = new DeferredRuntime();
      const initial = createEmptyCadDocument('part', { title: 'A' });
      const app = new CadApplicationImpl(initial, runtime);
      let notifications = 0;
      app.subscribe(() => notifications++);
      const old = app.execute({ id: 'document.rebuild', payload: {} });
      const replacement = sameId ? structuredClone(initial) : createEmptyCadDocument('part');
      replacement.title = 'B';
      const replace = app.replaceDocument(replacement);
      runtime.builds[1].resolve(late === 'success' ? failed('Current B error') : clean());
      await replace;
      const state = structuredClone(app.getState());
      const count = notifications;
      if (late === 'throw') runtime.builds[0].reject(new Error('Old A rejected'));
      else runtime.builds[0].resolve(late === 'success' ? clean() : failed('Old A error'));
      superseded(await old);
      assert.equal(app.getDocument().title, 'B');
      assert.deepEqual(app.getState(), state, 'late A must not overwrite B status/history');
      assert.equal(notifications, count, 'late A must not publish a new state');
      app.dispose();
    });
  }
}
for (const transition of ['edit', 'undo', 'redo', 'dispose'] as const) {
  await check('pending rebuild invalidated by ' + transition, async () => {
    const runtime = new DeferredRuntime();
    const app = new CadApplicationImpl(createEmptyCadDocument('part'), runtime);
    await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
    if (transition === 'redo') {
      const undo = app.undo();
      runtime.builds.at(-1)!.resolve(clean());
      await undo;
    }
    const old = app.execute({ id: 'document.rebuild', payload: {} });
    const oldGate = runtime.builds.at(-1)!;
    if (transition === 'edit') {
      const identity = app.getDocument();
      await app.execute({ id: 'sketch.create', payload: { support: 'XZ' } });
      assert.equal(app.getDocument(), identity, 'this case covers an in-place document edit');
      assert.equal(app.getState().recompute.status, 'dirty');
      assert.equal(app.getState().mode, 'idle');
    } else if (transition === 'dispose') app.dispose();
    else {
      const change = transition === 'undo' ? app.undo() : app.redo();
      runtime.builds.at(-1)!.resolve(clean());
      await change;
    }
    const state = structuredClone(app.getState());
    const document = structuredClone(app.getDocument());
    oldGate.resolve(failed('Invalidated build'));
    superseded(await old);
    assert.deepEqual(app.getState(), state);
    assert.deepEqual(app.getDocument(), document);
    app.dispose();
  });
}
await check('latest rebuild owns status even for identical document', async () => {
  const runtime = new DeferredRuntime();
  const app = new CadApplicationImpl(createEmptyCadDocument('part'), runtime);
  const first = app.execute({ id: 'document.rebuild', payload: {} });
  const second = app.execute({ id: 'document.rebuild', payload: {} });
  runtime.builds[1].resolve(failed('Latest failure'));
  assert.equal((await second).ok, false);
  const state = structuredClone(app.getState());
  runtime.builds[0].resolve(clean());
  superseded(await first);
  assert.deepEqual(app.getState(), state);
  app.dispose();
});

for (const transition of ['replace', 'same-id replace', 'edit', 'undo', 'dispose'] as const) {
  await check('reference capture invalidated by ' + transition, async () => {
    const runtime = new DeferredRuntime();
    const { app, request } = await featureApp(runtime);
    const detached = app.getDocument() as Readonly<CadPartDocument>;
    const pending = settledCapture(app.captureReference(request));
    assert.equal(runtime.captures.length, 1);
    if (transition === 'replace' || transition === 'same-id replace') {
      const next = {
        ...(transition === 'same-id replace' ? structuredClone(detached) : createEmptyCadDocument('part')),
        title: 'Capture B',
      };
      const change = app.replaceDocument(next);
      runtime.builds.at(-1)!.resolve(clean());
      await change;
      assert.equal(app.getState().canUndo, false);
      assert.equal(app.getState().dirty, false);
    } else if (transition === 'edit') {
      await app.execute({ id: 'sketch.create', payload: { support: 'XZ' } });
    } else if (transition === 'undo') {
      const change = app.undo();
      runtime.builds.at(-1)!.resolve(clean());
      await change;
    } else app.dispose();
    const state = structuredClone(app.getState());
    const document = structuredClone(app.getDocument());
    runtime.captures[0].resolve(captured(request));
    rejectCapture(await pending);
    assert.equal(detached.stableReferences.length, 0, 'no detached Part may receive a reference');
    assert.deepEqual(app.getDocument(), document);
    assert.deepEqual(app.getState(), state, 'stale capture must not add dirty/history');
    app.dispose();
  });
}
await check('replacement during prerequisite rebuild never starts capture', async () => {
  const runtime = new DeferredRuntime();
  const { app, request } = await featureApp(runtime);
  await app.execute({ id: 'sketch.create', payload: { support: 'YZ' } });
  const pending = settledCapture(app.captureReference(request));
  const oldGate = runtime.builds.at(-1)!;
  const replace = app.replaceDocument(createEmptyCadDocument('part', { title: 'B' }));
  runtime.builds.at(-1)!.resolve(clean());
  await replace;
  const state = structuredClone(app.getState());
  oldGate.resolve(clean());
  await Promise.race([pending, runtime.captureStarted.promise]);
  // Release an illegal baseline call too, so the assertion reports ownership instead of hanging.
  runtime.captures[0]?.resolve(captured(request));
  rejectCapture(await pending);
  assert.equal(runtime.captures.length, 0);
  assert.deepEqual(app.getState(), state);
  app.dispose();
});
await check('capture waits for a current rebuild when another rebuild is running', async () => {
  const runtime = new DeferredRuntime();
  const { app, request } = await featureApp(runtime);
  const old = app.execute({ id: 'document.rebuild', payload: {} });
  const oldGate = runtime.builds.at(-1)!;
  const count = runtime.builds.length;
  const pending = settledCapture(app.captureReference(request));
  assert.equal(runtime.captures.length, 0, 'running geometry is not ready for reference capture');
  assert.equal(runtime.builds.length, count + 1);
  runtime.builds.at(-1)!.resolve(clean());
  await runtime.captureStarted.promise;
  runtime.captures[0].resolve(captured(request));
  const result = await pending;
  assert.ok('value' in result && result.value);
  oldGate.resolve(failed('Old running build'));
  superseded(await old);
  assert.equal((app.getDocument() as CadPartDocument).stableReferences.length, 1);
  app.dispose();
});
await check('two captures cannot commit against one outdated history snapshot', async () => {
  const runtime = new DeferredRuntime();
  const { app, request } = await featureApp(runtime);
  const first = settledCapture(app.captureReference(request));
  const second = settledCapture(app.captureReference(request));
  runtime.captures[0].resolve(captured(request));
  assert.ok((await first).value);
  runtime.captures[1].resolve(captured(request));
  rejectCapture(await second);
  assert.equal((app.getDocument() as CadPartDocument).stableReferences.length, 1);
  const undo = app.undo();
  runtime.builds.at(-1)!.resolve(clean());
  await undo;
  assert.equal((app.getDocument() as CadPartDocument).stableReferences.length, 0, 'one Undo removes the one accepted capture');
  app.dispose();
});
console.log('CadApplication async ownership: ' + cases.length + ' PASS, ' + failures.length + ' FAIL');
assert.equal(failures.length, 0, failures.join('\n'));
