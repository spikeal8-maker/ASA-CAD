import assert from 'node:assert/strict';
import type { CadDocument, CadPartDocument } from '../../src/contracts/document';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import type { CadRuntimeAdapter, CadRuntimeRecomputeResult } from '../../src/contracts/runtime';
import type { CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import type { CadSketchSolveResult, CadSketchSolverAdapter } from '../../src/contracts/sketchSolver';
import { createEmptyCadDocument } from '../../src/contracts/document';
import { preflightAngularDimension } from '../../src/browser/AngularDimensionPreflight';
import {
  AngularDimensionAttemptEpoch,
  isAngularDimensionAttemptCurrent,
  runAngularDimensionAttempt,
  type AngularDimensionAttemptLiveState,
  type AngularDimensionAttemptSnapshot,
} from '../../src/web/AngularDimensionAttemptLifecycle';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'angular-async-test' };
  }
  async captureReference(): Promise<never> { throw new Error('unused'); }
  dispose(): void {}
}

const sketchId = 'sketch_async' as CadSketchId;
const firstId = 'entity_first' as CadSketchEntityId;
const secondId = 'entity_second' as CadSketchEntityId;

function documentFixture(): CadPartDocument {
  const document = createEmptyCadDocument('part', { title: 'Angular async lifecycle' }) as CadPartDocument;
  document.sketches.push({
    id: sketchId,
    name: 'Async Sketch',
    support: 'XY',
    entities: [
      { id: firstId, type: 'line', data: { from: [0, 0], to: [40, 0] } },
      { id: secondId, type: 'line', data: { from: [0, 0], to: [0, 30] } },
    ],
    constraintIds: [],
    dimensionIds: [],
  });
  return document;
}

function solvedResult(): CadSketchSolveResult {
  return {
    ok: true,
    converged: true,
    residual: 0,
    iterations: 1,
    degreesOfFreedom: 0,
    entities: structuredClone(documentFixture().sketches[0].entities),
    diagnostics: [],
  };
}

class InitRejectSolver implements CadSketchSolverAdapter {
  async init(): Promise<void> { throw new Error('INIT_REJECTED'); }
  solve(): CadSketchSolveResult { throw new Error('solve must not run after init rejection'); }
  dispose(): void {}
}

class SolveThrowSolver implements CadSketchSolverAdapter {
  async init(): Promise<void> {}
  solve(): CadSketchSolveResult { throw new Error('SOLVE_THROWN'); }
  dispose(): void {}
}

class RetrySolver implements CadSketchSolverAdapter {
  private initCalls = 0;
  async init(): Promise<void> {
    this.initCalls += 1;
    if (this.initCalls === 1) throw new Error('FIRST_INIT_FAIL');
  }
  solve(): CadSketchSolveResult { return solvedResult(); }
  dispose(): void {}
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function attemptSnapshot(document: Readonly<CadDocument>, requestId: number): AngularDimensionAttemptSnapshot {
  return {
    requestId,
    appRevision: 7,
    document,
    sketchId,
    aEntityId: firstId,
    bEntityId: secondId,
    value: 60,
  };
}
function liveState(
  document: Readonly<CadDocument>,
  gate: AngularDimensionAttemptEpoch,
  requestId: number,
): AngularDimensionAttemptLiveState {
  return {
    mounted: true,
    requestCurrent: gate.owns(requestId),
    appRevision: 7,
    document,
    activeCommand: 'dimension.angular',
    activeSketchId: sketchId,
    targetSketchId: sketchId,
    aEntityId: firstId,
    bEntityId: secondId,
    value: 60,
  };
}

async function assertStaleCase(
  label: string,
  mutateLive: (live: AngularDimensionAttemptLiveState, gate: AngularDimensionAttemptEpoch) => void,
): Promise<void> {
  const document = documentFixture();
  const gate = new AngularDimensionAttemptEpoch();
  const requestId = gate.begin();
  assert.ok(requestId);
  const attempt = attemptSnapshot(document, requestId);
  const live = liveState(document, gate, requestId);
  const pending = deferred<{ ok: true }>();
  let executeCalls = 0;

  const outcomePromise = runAngularDimensionAttempt({
    preflight: () => pending.promise,
    isCurrent: () => isAngularDimensionAttemptCurrent(attempt, {
      ...live,
      requestCurrent: gate.owns(requestId),
    }),
    execute: async () => {
      executeCalls += 1;
      return { ok: true, changed: true };
    },
  });

  mutateLive(live, gate);
  pending.resolve({ ok: true });
  const outcome = await outcomePromise;
  assert.equal(outcome.status, 'stale', label);
  assert.equal(executeCalls, 0, `${label}: stale request mutated application`);
}

{
  const document = documentFixture();
  const before = JSON.stringify(document);
  const result = await preflightAngularDimension(
    document, sketchId, firstId, secondId, 60, new InitRejectSolver(),
  );
  assert.deepEqual(result, { ok: false, kind: 'solver-error', message: 'INIT_REJECTED' });
  assert.equal(JSON.stringify(document), before, 'init rejection mutated source document');
}

{
  const document = documentFixture();
  const before = JSON.stringify(document);
  const result = await preflightAngularDimension(
    document, sketchId, firstId, secondId, 60, new SolveThrowSolver(),
  );
  assert.deepEqual(result, { ok: false, kind: 'solver-error', message: 'SOLVE_THROWN' });
  assert.equal(JSON.stringify(document), before, 'solve exception mutated source document');
}
{
  const document = documentFixture();
  const solver = new RetrySolver();
  const first = await preflightAngularDimension(document, sketchId, firstId, secondId, 60, solver);
  assert.deepEqual(first, { ok: false, kind: 'solver-error', message: 'FIRST_INIT_FAIL' });
  const second = await preflightAngularDimension(document, sketchId, firstId, secondId, 60, solver);
  assert.deepEqual(second, { ok: true }, 'retry after managed failure must succeed');
}

{
  const app = new CadApplicationImpl(documentFixture(), new NoopRuntime());
  const solver = new RetrySolver();
  const before = JSON.stringify(app.getDocument());
  let executeCalls = 0;
  const execute = () => {
    executeCalls += 1;
    return app.execute({
      id: 'dimension.angular',
      payload: { sketchId, aEntityId: firstId, bEntityId: secondId, value: 60 },
    });
  };

  const failed = await runAngularDimensionAttempt({
    preflight: () => preflightAngularDimension(app.getDocument(), sketchId, firstId, secondId, 60, solver),
    isCurrent: () => true,
    execute,
  });
  assert.equal(failed.status, 'preflight-rejected');
  assert.equal(executeCalls, 0, 'managed preflight failure must not dispatch real mutation');
  assert.equal(JSON.stringify(app.getDocument()), before, 'managed failure changed document/ownership');
  assert.equal(app.getState().canUndo, false, 'managed failure created history');

  const retried = await runAngularDimensionAttempt({
    preflight: () => preflightAngularDimension(app.getDocument(), sketchId, firstId, secondId, 60, solver),
    isCurrent: () => true,
    execute,
  });
  assert.equal(retried.status, 'applied');
  assert.equal(executeCalls, 1, 'retry must dispatch exactly one mutation');
  const after = app.getDocument();
  assert.equal(after.kind, 'part');
  if (after.kind !== 'part') throw new Error('expected Part');
  assert.equal(after.dimensions.length, 1);
  assert.equal(after.dimensions[0].type, 'angular');
  assert.equal(after.dimensions[0].value, 60);
  assert.deepEqual(after.dimensions[0].entityIds, [firstId, secondId]);
  assert.ok(after.sketches[0].dimensionIds.includes(after.dimensions[0].id));
  assert.equal(app.getState().canUndo, true, 'successful retry must create one history entry');
  assert.equal((await app.undo()).ok, true);
  assert.equal((app.getDocument() as CadPartDocument).dimensions.length, 0, 'one Undo must remove retried Angular');
  app.dispose();
}

await assertStaleCase('Cancel during pending', (live, gate) => {
  gate.invalidate();
  live.activeCommand = null;
});

await assertStaleCase('New/Open/replace with same IDs', (live) => {
  live.document = structuredClone(live.document);
  live.appRevision += 1;
});

await assertStaleCase('Undo/Redo or relevant revision change', (live) => {
  live.appRevision += 1;
});

await assertStaleCase('Command change', (live) => {
  live.activeCommand = 'sketch.line';
});

await assertStaleCase('Sketch change', (live) => {
  live.activeSketchId = 'sketch_other' as CadSketchId;
});

await assertStaleCase('Input value change', (live) => {
  live.value = 45;
});

await assertStaleCase('Selected entity removed', (live) => {
  assert.equal(live.document.kind, 'part');
  if (live.document.kind !== 'part') throw new Error('expected Part');
  live.document = structuredClone(live.document);
  live.document.sketches[0].entities = live.document.sketches[0].entities.filter(
    (entity) => entity.id !== secondId,
  );
  live.appRevision += 1;
});

await assertStaleCase('Unmount during pending', (live, gate) => {
  live.mounted = false;
  gate.invalidate();
});
{
  const gate = new AngularDimensionAttemptEpoch();
  const first = gate.begin();
  assert.ok(first);
  assert.equal(gate.begin(), null, 'repeat Apply while pending must not start another request');
  assert.equal(gate.finish(first), true);
  const second = gate.begin();
  assert.ok(second && second !== first, 'retry after completion must receive a fresh request token');
}

{
  const document = documentFixture();
  const gate = new AngularDimensionAttemptEpoch();
  const oldRequest = gate.begin();
  assert.ok(oldRequest);
  const oldAttempt = attemptSnapshot(document, oldRequest);
  const oldDeferred = deferred<{ ok: true }>();
  let executeCalls = 0;

  const oldOutcome = runAngularDimensionAttempt({
    preflight: () => oldDeferred.promise,
    isCurrent: () => isAngularDimensionAttemptCurrent(oldAttempt, liveState(document, gate, oldRequest)),
    execute: async () => {
      executeCalls += 1;
      return { ok: true, changed: true };
    },
  });

  gate.invalidate();
  const newRequest = gate.begin();
  assert.ok(newRequest);
  const newAttempt = attemptSnapshot(document, newRequest);
  const newOutcome = await runAngularDimensionAttempt({
    preflight: async () => ({ ok: true }),
    isCurrent: () => isAngularDimensionAttemptCurrent(newAttempt, liveState(document, gate, newRequest)),
    execute: async () => {
      executeCalls += 1;
      return { ok: true, changed: true };
    },
  });
  assert.equal(newOutcome.status, 'applied');
  assert.equal(executeCalls, 1, 'new request must mutate exactly once');

  oldDeferred.resolve({ ok: true });
  assert.equal((await oldOutcome).status, 'stale');
  assert.equal(executeCalls, 1, 'late old success must not double-mutate');
}

{
  const document = documentFixture();
  const gate = new AngularDimensionAttemptEpoch();
  const requestId = gate.begin();
  assert.ok(requestId);
  const attempt = attemptSnapshot(document, requestId);
  let executeCalls = 0;
  const outcome = await runAngularDimensionAttempt({
    preflight: async () => ({ ok: true }),
    isCurrent: () => isAngularDimensionAttemptCurrent(attempt, liveState(document, gate, requestId)),
    execute: async () => {
      executeCalls += 1;
      return { ok: true, changed: true, createdIds: ['dimension_test'] };
    },
  });
  assert.equal(outcome.status, 'applied');
  assert.equal(executeCalls, 1, 'valid attempt must dispatch exactly one application mutation');
}

console.log('M2O Angular preflight lifecycle PASS (F1 managed failures + F2 stale request guards)');
