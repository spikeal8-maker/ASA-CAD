import { StrictMode, useEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { useSketchConstraintController } from '../../src/web/useSketchConstraintController';
import { BrowserSketchSolverAdapter } from '../../src/browser/BrowserSketchSolverAdapter';
import { createSharedBrowserSketchSolverClient, sharedBrowserSketchSolver } from '../../src/browser/SharedBrowserSketchSolver';
import { createEmptyCadDocument, parseCadDocument, serializeCadDocument, type CadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadCommand } from '../../src/contracts/commands';
import type { CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function part(owner: CadApplicationImpl): Readonly<CadPartDocument> {
  const value = owner.getDocument();
  if (value.kind !== 'part') throw new Error('Expected Part');
  return value;
}
// This fixture has Sketches only. It exercises actual PlaneGCS, and makes no B-Rep claim.
function application(document: CadDocument) {
  return new CadApplicationImpl(document, {
    async recompute(value) {
      if (value.kind !== 'part' || value.features.length) throw new Error('Unexpected B-Rep request in Sketch fixture');
      return { ok: true, diagnostics: [], runtimeRevision: 'fixed-sketch-fixture' };
    },
    async captureReference() { throw new Error('Topology is outside this fixture'); },
    dispose() {},
  });
}
async function command(owner: CadApplicationImpl, value: CadCommand) {
  const result = await owner.execute(value);
  if (!result.ok) throw new Error(result.error?.message ?? value.id + ' failed');
  return result.createdIds?.[0];
}
async function seed() {
  const owner = application(createEmptyCadDocument('part', { title: 'Fixed ownership fixture' }));
  const sketchId = await command(owner, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
  const entityId = await command(owner, { id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [20, 0] } }) as CadSketchEntityId;
  const otherEntityId = await command(owner, { id: 'sketch.line', payload: { sketchId, from: [0, 10], to: [20, 10] } }) as CadSketchEntityId;
  const otherSketchId = await command(owner, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
  const otherSketchEntityId = await command(owner, { id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 50], to: [20, 50] } }) as CadSketchEntityId;
  await owner.replaceDocument(parseCadDocument(serializeCadDocument(owner.getDocument())));
  return { owner, sketchId, entityId, otherEntityId, otherSketchId, otherSketchEntityId };
}

let app: CadApplicationImpl, root: Root | undefined, fixture: Awaited<ReturnType<typeof seed>>;
let activeSketchId: CadSketchId | null = null, selectedEntityId: CadSketchEntityId | null = null;
let controller: ReturnType<typeof useSketchConstraintController>;
let apps: CadApplicationImpl[] = [], gate: ReturnType<typeof deferred> | null = null;
let commitGate: ReturnType<typeof deferred> | null = null, commitResults = 0;
let strictMode = false, effectSetups = 0, effectCleanups = 0, initialDocument = '';
let pending: Promise<void>[] = [], returned: (boolean | null)[] = [], notices: string[] = [], thrown: string[] = [];
let commands: { owner: number; command: CadCommand }[] = [];
let mounted = false, renderToken = 0, committedToken = -1, sharedDisposals = 0;
type Observation = {
  initCalls: number;
  initCompleted: number;
  solves: { shared: boolean; detached: boolean; ok: boolean; converged: boolean; dof: number | null }[];
};
let observed: Observation = { initCalls: 0, initCompleted: 0, solves: [] };
const solvers = new Set<BrowserSketchSolverAdapter>();
const originalInit = BrowserSketchSolverAdapter.prototype.init;
const originalSolve = BrowserSketchSolverAdapter.prototype.solve;
const originalDispose = BrowserSketchSolverAdapter.prototype.dispose;

BrowserSketchSolverAdapter.prototype.init = async function (this: BrowserSketchSolverAdapter) {
  const record = observed, held = gate;
  solvers.add(this); record.initCalls++;
  if (held) await held.promise;
  await originalInit.call(this);
  record.initCompleted++;
};
BrowserSketchSolverAdapter.prototype.solve = function (this: BrowserSketchSolverAdapter, document, sketchId) {
  const detached = apps.every(owner => owner.getDocument() !== document);
  const result = originalSolve.call(this, document, sketchId);
  observed.solves.push({
    shared: this === sharedBrowserSketchSolver, detached, ok: result.ok,
    converged: result.converged, dof: result.degreesOfFreedom,
  });
  return result;
};
BrowserSketchSolverAdapter.prototype.dispose = function (this: BrowserSketchSolverAdapter) {
  if (this === sharedBrowserSketchSolver) sharedDisposals++;
  return originalDispose.call(this);
};

function start() {
  const index = returned.length;
  returned.push(null);
  pending.push(controller.applyFixedConstraint().then(value => { returned[index] = value; }, error => {
    thrown.push(error instanceof Error ? error.message : String(error));
  }));
}
function Harness({ token }: { token: number }) {
  const [, update] = useReducer((value: number) => value + 1, 0);
  const owner = app;
  useEffect(() => owner.subscribe(update), [owner]);
  controller = useSketchConstraintController({
    app: owner, activeSketchId,
    sketch: part(owner).sketches.find(item => item.id === activeSketchId) ?? null,
    selectedEntityId, setNotice: message => { notices.push(message); },
  });
  useEffect(() => { mounted = true; effectSetups++; return () => { mounted = false; effectCleanups++; }; }, []);
  useEffect(() => { committedToken = token; });
  return <div data-mounted="true">
    <button id="fixed" disabled={!controller.canApplyFixedConstraint} onClick={start}>Fixed</button>
  </div>;
}
function render() {
  root ??= createRoot(document.getElementById('root')!);
  const view = <Harness token={++renderToken} />;
  root.render(strictMode ? <StrictMode>{view}</StrictMode> : view);
}
function observeCommands(owner: CadApplicationImpl) {
  const execute = owner.execute.bind(owner);
  owner.execute = value => {
    commands.push({ owner: apps.indexOf(owner), command: structuredClone(value) });
    const result = execute(value);
    const held = commitGate;
    if (value.id === 'constraint.fixed' && held) {
      return result.then(async outcome => { commitResults++; await held.promise; return outcome; });
    }
    return result;
  };
}
function state() {
  return {
    ready: mounted && renderToken === committedToken,
    mounted, activeSketchId, selectedEntityId, effectSetups, effectCleanups, commitResults,
    returned: [...returned], notices: [...notices], thrown: [...thrown],
    commands: structuredClone(commands), observed: structuredClone(observed), sharedDisposals,
    instances: apps.map(owner => ({
      dto: serializeCadDocument(owner.getDocument()), application: structuredClone(owner.getState()),
    })),
  };
}
const harness = {
  state,
  async setup(options: { strict?: boolean; fixed?: boolean } = {}) {
    gate?.resolve(); gate = null; commitGate?.resolve(); commitGate = null; await Promise.all(pending);
    root?.unmount(); root = undefined;
    for (const owner of apps) owner.dispose();
    fixture = await seed(); app = fixture.owner; apps = [app];
    if (options.fixed) {
      await command(app, { id: 'constraint.fixed', payload: {
        sketchId: fixture.sketchId, entityId: fixture.entityId,
        frozenGeometry: { type: 'line', from: [0, 0], to: [20, 0] },
      } });
      await app.replaceDocument(parseCadDocument(serializeCadDocument(app.getDocument())));
    }
    initialDocument = serializeCadDocument(app.getDocument());
    strictMode = options.strict ?? false; effectSetups = 0; effectCleanups = 0; commitResults = 0;
    activeSketchId = fixture.sketchId; selectedEntityId = fixture.entityId;
    pending = []; returned = []; notices = []; thrown = []; commands = [];
    observed = { initCalls: 0, initCompleted: 0, solves: [] };
    observeCommands(app); render();
  },
  hold() { if (gate) throw new Error('Initialization is already held'); gate = deferred(); },
  holdCommit() { commitGate = deferred(); },
  resumeCommit() { commitGate?.resolve(); commitGate = null; },
  start,
  resume(fail = false) {
    const held = gate; gate = null;
    if (fail) held?.reject(new Error('Controlled solver initialization failure'));
    else held?.resolve();
  },
  async settle() { await Promise.all(pending); return state(); },
  async change(kind: string) {
    if (kind === 'replace') {
      const next = parseCadDocument(initialDocument) as CadPartDocument;
      next.title = 'Replacement with identical IDs';
      const line = next.sketches[0].entities[0];
      if (line.type !== 'line') throw new Error('Expected line');
      line.data.from = [100, 50]; line.data.to = [140, 50];
      await app.replaceDocument(next);
    } else if (kind === 'edit') {
      const before = app.getDocument();
      await command(app, { id: 'sketch.entity.translate', payload: { sketchId: fixture.sketchId, entityId: fixture.entityId, delta: [5, 7] } });
      if (app.getDocument() !== before) throw new Error('Expected actual in-place document edit');
    } else if (kind === 'selection') {
      selectedEntityId = fixture.otherEntityId;
    } else if (kind === 'sketch') {
      activeSketchId = fixture.otherSketchId; selectedEntityId = fixture.otherSketchEntityId;
    } else if (kind === 'cancel') {
      selectedEntityId = null; notices.push('Команда отменена');
    } else if (kind === 'app') {
      app = application(parseCadDocument(serializeCadDocument(app.getDocument())));
      await app.replaceDocument(parseCadDocument(serializeCadDocument(app.getDocument())));
      apps.push(app); observeCommands(app);
    } else if (kind === 'unmount') {
      root?.unmount(); root = undefined; return;
    } else throw new Error('Unknown change ' + kind);
    render();
  },
  async undo() {
    const result = await app.undo();
    if (!result.ok) throw new Error(result.error?.message ?? 'Undo failed');
    return state();
  },
  async clientAfterUnmount() {
    const hookUsedShared = observed.solves[0]?.shared;
    const before = serializeCadDocument(app.getDocument());
    root?.unmount(); root = undefined;
    const client = createSharedBrowserSketchSolverClient();
    await client.init();
    const first = client.solve(app.getDocument(), fixture.sketchId);
    client.dispose();
    const second = client.solve(app.getDocument(), fixture.sketchId);
    return {
      hookUsedShared, sharedDisposals, mounted,
      first: { ok: first.ok, converged: first.converged, dof: first.degreesOfFreedom },
      second: { ok: second.ok, converged: second.converged, dof: second.degreesOfFreedom },
      intentUnchanged: serializeCadDocument(app.getDocument()) === before,
    };
  },
  async close() {
    root?.unmount(); root = undefined;
    gate?.resolve(); gate = null; commitGate?.resolve(); commitGate = null; await Promise.all(pending);
    const disposalsByClients = sharedDisposals;
    for (const solver of solvers) originalDispose.call(solver);
    for (const owner of apps) owner.dispose();
    BrowserSketchSolverAdapter.prototype.init = originalInit;
    BrowserSketchSolverAdapter.prototype.solve = originalSolve;
    BrowserSketchSolverAdapter.prototype.dispose = originalDispose;
    return { mounted, sharedDisposalsByClients: disposalsByClients, pendingSettled: returned.every(value => value !== null) };
  },
};
declare global { var fixedConstraintHarness: typeof harness; }
globalThis.fixedConstraintHarness = harness;
