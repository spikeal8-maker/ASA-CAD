import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import { analyzeSketchProfile } from '../../src/application/SketchProfile';
import { serializeCadDocument } from '../../src/contracts/document';
import type { CadSketchId } from '../../src/contracts/ids';
import type { CadSketchSolverAdapter } from '../../src/contracts/sketchSolver';
import { PlaneGCSSketchSolverRuntime } from '../../src/runtime/PlaneGCSSketchSolverRuntime';
import { OpenCascadePartRuntime } from '../../src/runtime/OpenCascadePartRuntime';
import { SolvedSketchPartRuntimeAdapter } from '../../src/runtime/SolvedSketchPartRuntimeAdapter';
import { PartFeatureProfile, currentFeatureProfile } from '../../src/web/PartFeatureProfile';
import { extrudeAvailability, cutAvailability } from '../../src/web/PartFeatureAvailability';
import {
  profileApp, profileBasePrism, profileCircle, profileCommand, profileTriangle,
  closeProfileTriangle, requireProfilePart,
} from './solved-profile-fixtures';

const oc = await initOpenCascade();
const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
const borrowed = (): CadSketchSolverAdapter => ({
  init: () => solver.init(), solve: (document, sketchId) => solver.solve(document, sketchId), dispose() {},
});
let passed = 0, failed = 0;
async function scenario(name: string, run: () => Promise<void>) {
  try { await run(); passed += 1; console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + (error instanceof Error ? error.stack : error)); }
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-5, actual + ' != ' + expected);
}
function eligibility(app: ReturnType<typeof profileApp>, profile: PartFeatureProfile, sketchId: CadSketchId) {
  const part = requireProfilePart(app), sketch = part.sketches.find((item) => item.id === sketchId)!;
  return extrudeAvailability(part, sketch, null, profile.getSnapshot());
}
function owner(app: ReturnType<typeof profileApp>, adapter = borrowed()) {
  return new PartFeatureProfile(() => app.getDocument(), adapter);
}

await scenario('raw-gap triangle: solved admission, unchanged intent/history, actual OCC volume500', async () => {
  const core = new OpenCascadePartRuntime(oc);
  const app = profileApp(new SolvedSketchPartRuntimeAdapter(core, borrowed()));
  const profile = owner(app);
  try {
    const { sketchId, lines } = await profileTriangle(app);
    const part = requireProfilePart(app), sketch = part.sketches[0];
    assert.equal(analyzeSketchProfile(sketch).ok, false);
    const dto = serializeCadDocument(part), state = structuredClone(app.getState());
    assert.equal(eligibility(app, profile, sketchId).enabled, false, 'unsolved admission is closed');
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
    const solved = analyzeSketchProfile(profile.getSnapshot()!.sketch!);
    assert.ok(solved.ok); near(solved.profile.area, 100);
    assert.equal(serializeCadDocument(app.getDocument()), dto);
    assert.deepEqual(app.getState(), state);
    await profileCommand(app, { id: 'feature.extrude', payload: { sketchId, distance: 5 } });
    await profileCommand(app, { id: 'document.rebuild', payload: {} });
    near(core.getLastAnalysis()!.volume, 500);
    const last = requireProfilePart(app).sketches[0].entities.find((item) => item.id === lines[2]);
    assert.equal(last?.type, 'line');
    if (last?.type === 'line') assert.deepEqual(last.data.to, [0, 1]);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('Cut uses solved triangle and actual OCC removes volume500 from a12000 prism', async () => {
  const core = new OpenCascadePartRuntime(oc);
  const app = profileApp(new SolvedSketchPartRuntimeAdapter(core, borrowed()));
  const profile = owner(app);
  try {
    await profileBasePrism(app);
    await profileCommand(app, { id: 'document.rebuild', payload: {} });
    near(core.getLastAnalysis()!.volume, 12000);
    const { sketchId } = await profileTriangle(app);
    const part = requireProfilePart(app), sketch = part.sketches.at(-1)!;
    assert.equal(analyzeSketchProfile(sketch).ok, false);
    const dto = serializeCadDocument(part);
    await profile.refresh(sketchId);
    assert.equal(cutAvailability(part, sketch, profile.getSnapshot()).enabled, true);
    assert.equal(serializeCadDocument(app.getDocument()), dto);
    await profileCommand(app, { id: 'feature.cutExtrude', payload: { sketchId, end: 'through-all' } });
    await profileCommand(app, { id: 'document.rebuild', payload: {} });
    near(core.getLastAnalysis()!.volume, 11500);
  } finally { profile.dispose(); app.dispose(); }
});

for (const kind of ['open', 'degenerate'] as const) await scenario(kind + ' actual solved profile rejects UI and OCC', async () => {
  const core = new OpenCascadePartRuntime(oc);
  const app = profileApp(new SolvedSketchPartRuntimeAdapter(core, borrowed()));
  const profile = owner(app);
  try {
    let sketchId: CadSketchId;
    if (kind === 'open') sketchId = (await profileTriangle(app, false)).sketchId;
    else {
      sketchId = await profileCommand(app, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
      for (const [from, to] of [
        [[0, 0], [10, 0]], [[10, 0], [20, 0]], [[20, 0], [0, 0]],
      ] as const) await profileCommand(app, { id: 'sketch.line', payload: { sketchId, from, to } });
    }
    await profile.refresh(sketchId);
    const check = eligibility(app, profile, sketchId);
    assert.equal(check.enabled, false);
    assert.ok(check.reason && !check.reason.includes('Проверка'));
    await profileCommand(app, { id: 'feature.extrude', payload: { sketchId, distance: 5 } });
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    assert.equal(result.ok, false);
    assert.equal(core.getLastAnalysis(), null);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('constraint edits and Undo/Redo invalidate admission; profile queries add no history', async () => {
  const app = profileApp(), profile = owner(app);
  try {
    const { sketchId, lines } = await profileTriangle(app, false);
    await profile.refresh(sketchId);
    const old = profile.getSnapshot(), identity = app.getDocument();
    await closeProfileTriangle(app, sketchId, lines);
    assert.equal(app.getDocument(), identity, 'exercise actual in-place application mutation');
    assert.equal(currentFeatureProfile(old, app.getDocument(), sketchId), false);
    assert.match(eligibility(app, profile, sketchId).reason!, /Проверка/);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
    const dto = serializeCadDocument(app.getDocument()), count = requireProfilePart(app).constraints.length;
    await profile.refresh(sketchId);
    assert.equal((await app.undo()).ok, true);
    assert.equal(requireProfilePart(app).constraints.length, count - 1, 'Undo reaches the last real constraint');
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    assert.equal((await app.redo()).ok, true);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
    assert.equal(serializeCadDocument(app.getDocument()), dto);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('driving dimension changes recompute solved diameter without rewriting raw coordinates', async () => {
  const app = profileApp(), profile = owner(app);
  try {
    const { sketchId, dimensionId, entityId } = await profileCircle(app);
    await profile.refresh(sketchId);
    let entity = profile.getSnapshot()!.sketch!.entities[0];
    assert.equal(entity.type, 'circle'); if (entity.type === 'circle') near(entity.data.diameter, 20);
    await profileCommand(app, { id: 'part.dimension.setValue', payload: { dimensionId, value: 8 } });
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    await profile.refresh(sketchId);
    entity = profile.getSnapshot()!.sketch!.entities[0];
    assert.equal(entity.type, 'circle'); if (entity.type === 'circle') near(entity.data.diameter, 8);
    const persisted = requireProfilePart(app).sketches[0].entities.find((item) => item.id === entityId);
    assert.equal(persisted?.type, 'circle');
    if (persisted?.type === 'circle') assert.equal(persisted.data.diameter, 10);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('same-ID identical document replacement requires a fresh identity-bound result', async () => {
  const app = profileApp(), profile = owner(app);
  try {
    const { sketchId } = await profileTriangle(app);
    await profile.refresh(sketchId);
    const old = profile.getSnapshot(), replaced = structuredClone(app.getDocument());
    await app.replaceDocument(replaced);
    assert.equal(currentFeatureProfile(old, app.getDocument(), sketchId), false);
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
    assert.equal(profile.getSnapshot()!.source, app.getDocument());
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('late init after in-place dimension edit never solves or publishes the stale request', async () => {
  const app = profileApp(), gate = deferred(); let calls = 0;
  const profile = owner(app, { init: () => gate.promise, solve: (doc, id) => { calls += 1; return solver.solve(doc, id); }, dispose() {} });
  try {
    const { sketchId, dimensionId } = await profileCircle(app);
    const pending = profile.refresh(sketchId);
    await profileCommand(app, { id: 'part.dimension.setValue', payload: { dimensionId, value: 8 } });
    gate.resolve();
    assert.equal(await pending, null); assert.equal(calls, 0);
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    await profile.refresh(sketchId);
    assert.equal(calls, 1); assert.equal(eligibility(app, profile, sketchId).enabled, true);
  } finally { gate.resolve(); profile.dispose(); app.dispose(); }
});

await scenario('late init error cannot replace a newer same-ID document solution', async () => {
  const app = profileApp(), gate = deferred(); let initializes = 0;
  const profile = owner(app, { init: () => ++initializes === 1 ? gate.promise : Promise.resolve(), solve: (doc, id) => solver.solve(doc, id), dispose() {} });
  try {
    const { sketchId } = await profileTriangle(app);
    const old = profile.refresh(sketchId);
    await app.replaceDocument(structuredClone(app.getDocument()));
    await profile.refresh(sketchId);
    const current = profile.getSnapshot();
    gate.reject(new Error('obsolete init failure'));
    assert.equal(await old, null); assert.equal(profile.getSnapshot(), current);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
  } finally { gate.resolve(); profile.dispose(); app.dispose(); }
});

await scenario('latest Sketch request owns the result even when the older init completes last', async () => {
  const app = profileApp(), gate = deferred(); let initializes = 0, calls = 0;
  const profile = owner(app, { init: () => ++initializes === 1 ? gate.promise : Promise.resolve(), solve: (doc, id) => { calls += 1; return solver.solve(doc, id); }, dispose() {} });
  try {
    const first = await profileCircle(app), second = await profileTriangle(app);
    const old = profile.refresh(first.sketchId);
    await profile.refresh(second.sketchId);
    const current = profile.getSnapshot();
    gate.resolve(); assert.equal(await old, null);
    assert.equal(profile.getSnapshot(), current); assert.equal(calls, 1);
    assert.equal(current?.sketchId, second.sketchId);
  } finally { gate.resolve(); profile.dispose(); app.dispose(); }
});

await scenario('cancel/dispose reject pending work; cancelling a consumer permits a fresh request', async () => {
  const app = profileApp(), gate = deferred(); let calls = 0;
  const profile = owner(app, { init: () => gate.promise, solve: (doc, id) => { calls += 1; return solver.solve(doc, id); }, dispose() {} });
  try {
    const { sketchId } = await profileTriangle(app);
    const pending = profile.refresh(sketchId);
    profile.cancel(); gate.resolve();
    assert.equal(await pending, null); assert.equal(calls, 0); assert.equal(profile.getSnapshot(), null);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
    profile.dispose(); assert.equal(await profile.refresh(sketchId), null);
    const sibling = owner(app);
    try { await sibling.refresh(sketchId); assert.equal(eligibility(app, sibling, sketchId).enabled, true); }
    finally { sibling.dispose(); }
  } finally { gate.resolve(); profile.dispose(); app.dispose(); }
});

await scenario('fixed raw endpoints leave an invalid solved profile that remains unavailable', async () => {
  const app = profileApp(), profile = owner(app);
  try {
    const { sketchId, lines } = await profileTriangle(app);
    await profileCommand(app, { id: 'constraint.fixed', payload: { sketchId, entityId: lines[2], frozenGeometry: { type: 'line', from: [20, 10], to: [0, 1] } } });
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    assert.ok(eligibility(app, profile, sketchId).reason);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('current initialization failure is explicit and a fresh request can retry the same intent', async () => {
  const app = profileApp(); let initializes = 0;
  const profile = owner(app, {
    async init() { if (++initializes === 1) throw new Error('controlled initialization failure'); },
    solve: (doc, id) => solver.solve(doc, id), dispose() {},
  });
  try {
    const { sketchId } = await profileCircle(app);
    await profile.refresh(sketchId);
    assert.equal(profile.getSnapshot()?.status, 'error');
    assert.match(eligibility(app, profile, sketchId).reason!, /controlled initialization failure/);
    assert.equal(eligibility(app, profile, sketchId).enabled, false);
    await profile.refresh(sketchId);
    assert.equal(eligibility(app, profile, sketchId).enabled, true);
  } finally { profile.dispose(); app.dispose(); }
});

await scenario('dispose during initialization prevents both solving and late publication', async () => {
  const app = profileApp(), gate = deferred(); let calls = 0, disposed = 0;
  const profile = owner(app, {
    init: () => gate.promise, solve: (doc, id) => { calls += 1; return solver.solve(doc, id); },
    dispose() { disposed += 1; },
  });
  try {
    const { sketchId } = await profileCircle(app);
    const pending = profile.refresh(sketchId);
    profile.dispose(); gate.resolve();
    assert.equal(await pending, null); assert.equal(profile.getSnapshot(), null);
    assert.equal(calls, 0); assert.equal(disposed, 1);
  } finally { gate.resolve(); profile.dispose(); app.dispose(); }
});

solver.dispose();
console.log(JSON.stringify({ gate: 'solved-profile-eligibility', passed, failed, actualPlaneGCS: true, actualOpenCascade: true }));
process.exitCode = failed ? 1 : 0;
