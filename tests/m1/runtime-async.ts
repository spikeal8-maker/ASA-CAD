import assert from 'node:assert/strict';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../../src/browser/BrowserPartRuntimeAdapter';
import { LazyCadRuntimeLoader } from '../../src/browser/LazyCadRuntimeLoader';
import { evaluateCadCapabilities } from '../../src/browser/capabilities';
import { OpenCascadePartRenderAdapter } from '../../src/runtime/OpenCascadePartRenderAdapter';
import { createEmptyCadDocument, type CadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadFeatureId, CadSketchId } from '../../src/contracts/ids';
import type { CadSketchSolverAdapter } from '../../src/contracts/sketchSolver';
import { OpenCascadePartRuntime } from '../../src/runtime/OpenCascadePartRuntime';
import { SolvedSketchPartRuntimeAdapter } from '../../src/runtime/SolvedSketchPartRuntimeAdapter';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class ScheduledSolver implements CadSketchSolverAdapter {
  gates: Array<ReturnType<typeof deferred>> = [];
  solveCount = 0;
  disposed = false;
  init() { const gate = deferred(); this.gates.push(gate); return gate.promise; }
  solve(document: Readonly<CadDocument>, sketchId: CadSketchId) {
    assert.equal(this.disposed, false, 'disposed solver must not be called after init');
    this.solveCount++;
    if (document.kind !== 'part') throw new Error('Expected Part');
    const sketch = document.sketches.find(item => item.id === sketchId);
    if (!sketch) throw new Error('Missing test Sketch');
    return {
      ok: true, converged: true, residual: 0, iterations: 0, degreesOfFreedom: null,
      entities: structuredClone(sketch.entities), diagnostics: [],
    };
  }
  dispose() { this.disposed = true; }
}
function block(): CadPartDocument {
  const document = createEmptyCadDocument('part', { title: 'Async A' });
  const sketchId = 'sketch-async' as CadSketchId;
  const corners = [[0, 0], [20, 0], [20, 10], [0, 10]];
  document.sketches.push({
    id: sketchId, name: 'Rectangle', support: 'XY', constraintIds: [], dimensionIds: [],
    entities: corners.map((point, index) => ({
      id: ('entity-async-' + index) as CadPartDocument['sketches'][number]['entities'][number]['id'],
      type: 'line', data: { from: [...point] as [number, number], to: [...corners[(index + 1) % 4]] as [number, number] },
    })),
  });
  document.features.push({
    id: 'feature-async' as CadFeatureId, type: 'extrude', name: 'Block', suppressed: false,
    parameters: { sketchId, distance: 2 }, inputReferences: [],
  });
  return document;
}
function volume(core: OpenCascadePartRuntime, expected: number, label: string) {
  const analysis = core.getLastAnalysis();
  assert.ok(analysis, label + ': real OCC analysis missing');
  assert.ok(Math.abs(analysis.volume - expected) < 1e-4,
    label + ': actual OCC volume=' + analysis.volume + ', expected=' + expected);
}
export async function runRuntimeAsyncRegression(oc: unknown) {
  const failures: string[] = [];
  let passed = 0;
  async function check(name: string, test: (core: OpenCascadePartRuntime, runtime: SolvedSketchPartRuntimeAdapter, solver: ScheduledSolver) => Promise<void>) {
    const core = new OpenCascadePartRuntime(oc);
    const solver = new ScheduledSolver();
    const runtime = new SolvedSketchPartRuntimeAdapter(core, solver);
    try { await test(core, runtime, solver); passed++; }
    catch (error) { failures.push(name + ': ' + (error instanceof Error ? error.message : String(error))); }
    finally { runtime.dispose(); }
  }
  for (const sameId of [false, true]) {
    await check('real cache / ' + (sameId ? 'same ID' : 'different ID'), async (core, runtime, solver) => {
      const a = block(), b = structuredClone(a);
      if (!sameId) b.documentId = createEmptyCadDocument('part').documentId;
      b.title = 'Async B';
      b.features[0].parameters.distance = 7;
      const old = runtime.recompute(a);
      const latest = runtime.recompute(b);
      assert.equal(solver.gates.length, 2);
      solver.gates[1].resolve();
      assert.equal((await latest).ok, true);
      volume(core, 1400, 'B before late A');
      const accepted = core.getLastAnalysis();
      solver.gates[0].resolve();
      const obsolete = await old;
      volume(core, 1400, 'B after late A');
      assert.equal(core.getLastAnalysis(), accepted, 'late A must not replace actual kernel cache');
      assert.equal(obsolete.ok, false);
      assert.equal(solver.solveCount, 1, 'invalidated A must stop before solve/OCC');
    });
  }
  await check('in-place edit invalidates pending kernel work', async (core, runtime, solver) => {
    const a = block();
    let current = true;
    const old = runtime.recompute(a, { isCurrent: () => current });
    a.features[0].parameters.distance = 7;
    current = false;
    solver.gates[0].resolve();
    assert.equal((await old).ok, false);
    assert.equal(solver.solveCount, 0);
    assert.equal(core.getLastAnalysis(), null);
  });
  await check('legacy caller input is snapshotted before solver init', async (core, runtime, solver) => {
    const a = block();
    const pending = runtime.recompute(a);
    a.features[0].parameters.distance = 7;
    solver.gates[0].resolve();
    assert.equal((await pending).ok, true);
    volume(core, 400, 'original request snapshot');
    assert.equal(a.features[0].parameters.distance, 7, 'runtime must not mutate caller intent');
  });
  await check('late reference rebuild cannot replace current kernel cache', async (core, runtime, solver) => {
    const a = block(), b = structuredClone(a);
    b.features[0].parameters.distance = 7;
    const initial = runtime.recompute(a);
    solver.gates[0].resolve();
    await initial;
    const capture = runtime.captureReference(a, {
      kind: 'face', sourceFeatureId: a.features[0].id, point: [10, 5, 2], semanticRole: 'top',
    }).then(value => ({ value }), error => ({ error }));
    const latest = runtime.recompute(b);
    solver.gates[2].resolve();
    assert.equal((await latest).ok, true);
    const accepted = core.getLastAnalysis();
    solver.gates[1].resolve();
    const result = await capture;
    volume(core, 1400, 'current cache after superseded capture');
    assert.equal(core.getLastAnalysis(), accepted);
    assert.ok('error' in result && result.error instanceof Error);
    assert.match(result.error.message, /superseded/i);
  });
  await check('late init rejection cannot disturb current cache', async (core, runtime, solver) => {
    const a = block(), b = structuredClone(a);
    b.features[0].parameters.distance = 7;
    const old = runtime.recompute(a);
    const latest = runtime.recompute(b);
    solver.gates[1].resolve();
    await latest;
    const accepted = core.getLastAnalysis();
    solver.gates[0].reject(new Error('Old init failed'));
    assert.equal((await old).ok, false);
    assert.equal(core.getLastAnalysis(), accepted);
    volume(core, 1400, 'B after rejected A');
  });
  await check('dispose while solver init is pending', async (core, runtime, solver) => {
    const pending = runtime.recompute(block());
    runtime.dispose();
    solver.gates[0].resolve();
    assert.equal((await pending).ok, false);
    assert.equal(solver.solveCount, 0);
    assert.equal(core.getLastAnalysis(), null);
  });
  const capabilities = evaluateCadCapabilities({
    webAssembly: true, sharedArrayBuffer: true, crossOriginIsolated: true, webgl: true, webgl2: true,
  });
  async function entered(solver: ScheduledSolver, count: number) {
    for (let turn = 0; turn < 30 && solver.gates.length < count; turn++) await Promise.resolve();
    assert.equal(solver.gates.length, count, 'full runtime path did not reach the controlled init gate');
  }
  for (const replacement of ['same-id', 'empty'] as const) {
    await check('application/browser/solver/OCC replacement ' + replacement, async (core, runtime, solver) => {
      const bridge = new BrowserPartRuntimeAdapter(new LazyCadRuntimeLoader(
        () => capabilities, async () => ({ runtime, render: new OpenCascadePartRenderAdapter(core) }),
      ));
      const app = new CadApplicationImpl(block(), bridge);
      const old = app.execute({ id: 'document.rebuild', payload: {} });
      await entered(solver, 1);
      const b = replacement === 'same-id' ? structuredClone(app.getDocument()) : createEmptyCadDocument('part');
      const replacementDocument = { ...b, title: 'Full chain B' };
      if (replacementDocument.kind !== 'part') throw new Error('Expected Part');
      if (replacement === 'same-id') replacementDocument.features[0].parameters.distance = 7;
      const replace = app.replaceDocument(replacementDocument);
      if (replacement === 'same-id') {
        await entered(solver, 2);
        solver.gates[1].resolve();
      }
      await replace;
      const accepted = core.getLastAnalysis();
      const model = bridge.getRenderModel(app.getDocument());
      if (replacement === 'same-id') {
        volume(core, 1400, 'full chain B');
        assert.ok(model);
        assert.equal(model.bounds.maxZ, 7);
      } else {
        assert.equal(accepted, null);
        assert.equal(model, null);
      }
      const state = structuredClone(app.getState());
      solver.gates[0].resolve();
      const result = await old;
      assert.equal(result.error?.code, 'CAD_OPERATION_SUPERSEDED');
      assert.equal(core.getLastAnalysis(), accepted);
      assert.equal(bridge.getRenderModel(app.getDocument()), model);
      assert.deepEqual(app.getState(), state);
      app.dispose();
    });
  }
  await check('rejected synchronous command keeps equivalent rollback identity valid', async (core, runtime, solver) => {
    const bridge = new BrowserPartRuntimeAdapter(new LazyCadRuntimeLoader(
      () => capabilities, async () => ({ runtime, render: new OpenCascadePartRenderAdapter(core) }),
    ));
    const app = new CadApplicationImpl(block(), bridge);
    const before = app.getDocument();
    const pending = app.execute({ id: 'document.rebuild', payload: {} });
    await entered(solver, 1);
    const invalid = await app.execute({
      id: 'sketch.rectangle', payload: { sketchId: 'sketch-async' as CadSketchId, origin: [0, 0], width: -1, height: 10 },
    });
    assert.equal(invalid.ok, false);
    assert.notEqual(app.getDocument(), before, 'existing rollback restores an equivalent clone');
    assert.deepEqual(app.getDocument(), before);
    solver.gates[0].resolve();
    assert.equal((await pending).ok, true);
    volume(core, 400, 'valid build after rejected command');
    assert.equal(app.getState().recompute.status, 'clean');
    assert.ok(bridge.getRenderModel(app.getDocument()), 'equivalent rollback must not hide the valid model');
    app.dispose();
  });
  console.log('Actual OpenCascade async ownership: ' + passed + ' PASS, ' + failures.length + ' FAIL');
  assert.equal(failures.length, 0, failures.join('\n'));
}
