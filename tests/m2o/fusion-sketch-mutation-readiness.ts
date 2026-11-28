// A05 v3: readiness gate — registry, gate, dispatcher, gateAll (11 constraints), cancel, alignment.
import assert from 'node:assert/strict';
import { registerSketchMutationReadiness as reg, isSketchMutationReady } from '../../src/web/SketchMutationReadiness';
import { cancelCmd, dispatchCmd, gateAll, guardSketchMutation, sketchGate } from '../../src/web/SketchWorkspaceMutationBindings';
import { alignedWithFrame, normalBasisScale } from '../../src/web/fusion/SketchCameraAlignment';
import type { SketchCameraMappingReady } from '../../src/web/fusion/SketchCameraMapping';
import { sketchDisplayFrame } from '../../src/web/viewport/SketchViewportGeometry';

const notices: string[] = [];
const calls: string[] = [];
const reject = (m: string) => notices.push(m);
const q = (d: string | null, s: string | null) => isSketchMutationReady(d, s);
const rA = () => q('docA', 'sk1');
const cb = (n: string) => () => { calls.push(n); return true; };
const fn = (n: string) => () => { calls.push(n); return n; };
const ck = ['Horizontal', 'Vertical', 'Fixed', 'Coincident', 'Parallel', 'Perpendicular', 'Tangent',
  'Concentric', 'Equal', 'Symmetry', 'PointOnCurve'].map(s => `apply${s}Constraint`);

let live = true;
const unA = reg('docA', 'sk1', () => live);
assert.equal(rA(), true, 'live getter');
assert.deepEqual([q('docB', 'sk1'), q('docA', 'sk2'), q(null, 'sk1'), q('docA', null), q('docA', 'sk-none')],
  [false, false, false, false, false], 'keying');
live = false;
assert.equal(rA(), false, 'attempt time');
live = true;
const o1 = reg('docA', 'sk1', () => false);
const o2 = reg('docA', 'sk1', () => true);
o1();
assert.equal(rA(), true, 'stale keeps newer');
o2();
assert.equal(rA(), false, 'own cleanup');
unA();
assert.equal(rA(), false, 'first inert');

const gid = { documentId: 'docA', sketchId: 'sk1' };
const compas = sketchGate({ fusionActive: false, ...gid, reject });
const gK = guardSketchMutation(compas, (v: number) => { calls.push('c'); return v * 2; });
assert.deepEqual([gK(21), calls, notices.length], [42, ['c'], 0], 'KOMPAS');
const fusion = sketchGate({ fusionActive: true, ...gid, reject });
const gF = guardSketchMutation(fusion, (v: number) => { calls.push('c2'); return v * 2; });
assert.equal(fusion.isReady(), false, 'no reg');
assert.deepEqual([gF(5), calls, notices.length], [undefined, ['c'], 1], 'gated');
assert.match(notices[0], /Камера не готова/);
const un1 = reg('docA', 'sk1', () => true);
assert.deepEqual([fusion.isReady(), gF(5)], [true, 10], 'ready');
un1();
assert.equal(fusion.isReady(), false, 'detach');
const un2 = reg('docA', 'sk1', () => true);
assert.equal(fusion.isReady(), true, 'reopen');
un2();
const mkCtx = (command: string | null, mode: string | null) => ({
  activeCommand: command,
  commitLinePreview: cb('l'), commitArcPreview: cb('a'), commitCreateSketch: cb('cr'),
  commitRectanglePreview: cb('rp'), commitRectangle: cb('rc'),
  commitCirclePreview: cb('cp'), commitCircle: cb('c'),
  hasRectangleDraft: true, hasCircleDraft: true,
  commitExtrude: cb('ex'), commitCut: cb('ct'), commitFillet: cb('fi'),
  dimensionCreationMode: mode, commitDimensionCreation: cb('dc'), commitDimensionEdit: cb('de'),
});
for (const [command, ok, exp, rej, mode, noDraft] of [
  ['sketch.line', 0, [], true, null], ['sketch.arc', 1, ['a'], false, null],
  ['sketch.rectangle', 0, [], true, null], ['part.sketch.create', 0, ['cr'], false, null],
  ['part.extrude', 0, ['ex'], false, null], ['part.cutExtrude', 0, ['ct'], false, null],
  ['part.fillet', 0, ['fi'], false, null], [null, 0, [], true, 'diameter'],
  [null, 1, ['dc'], false, 'diameter'], ['dimension.edit', 0, [], true, null],
  [null, 1, [], false, null], ['sketch.circle', 1, ['c'], false, null, true],
] as [string | null, number, string[], boolean, string | null, boolean?][]) {
  calls.length = 0;
  const before = notices.length;
  const ctx = mkCtx(command, mode);
  if (noDraft) ctx.hasCircleDraft = false;
  const un = reg('docA', 'sk1', () => true);
  if (!ok) un();
  await dispatchCmd(fusion, ctx);
  un();
  assert.deepEqual([...calls], exp, String(command));
  assert.equal(notices.length > before, rej, `${command} notice`);
}
{
  calls.length = 0;
  const editing: Record<string, unknown> = {
    ...Object.fromEntries([['commitRectangle', 'er'], ['commitCircle', 'cc'], ['commitLinePreview', 'elp'],
      ['commitRectanglePreview', 'erp'], ['commitCirclePreview', 'ecp'], ['commitArcPreview', 'eap'],
      ['handleSketchLinePoint', 'lp'], ['handleSketchRectanglePoint', 'rp'],
      ['handleSketchCirclePoint', 'cp'], ['handleSketchArcPoint', 'ap']].map(([k, n]) => [k, fn(n)] as const)),
    lineInput: { enter: fn('le'), value: '12' }, arcInput: { enter: fn('ae') }, circleInput: { enter: fn('ce') },
  };
  const constraints = Object.fromEntries(ck.map(k => [k, fn(k)] as const));
  const entityMutations = { translateSketchEntity: fn('tr') };
  const dimensions = { commitDimensionEdit: fn('de') };
  const creation = { dimensionCreation: { commit: fn('dc'), cancel: fn('dcan') } };
  const out = gateAll(fusion, editing, constraints, entityMutations, dimensions, creation);
  const before = notices.length;
  [out.commitCircle, (out.lineInput as { enter: () => unknown }).enter, out.translateSketchEntity,
    out.applyFixedConstraint, out.commitDimensionEdit, (out.dimensionCreation as { commit: () => unknown }).commit,
    (out.arcInput as { enter: () => unknown }).enter].forEach((f) => (f as () => unknown)());
  assert.deepEqual(calls, [], 'gated');
  assert.equal(notices.length, before + 7, '7 notice-only');
  assert.equal((out.lineInput as { value: string }).value, '12', 'input');
  assert.equal((out.dimensionCreation as { cancel: () => unknown }).cancel, creation.dimensionCreation.cancel, 'sibling');
  const b1 = notices.length;
  ck.forEach(k => (out[k] as () => unknown)());
  assert.deepEqual(calls, [], 'gated11');
  assert.equal(notices.length, b1 + 11, '11 notice-only');
  const un = reg('docA', 'sk1', () => true);
  assert.deepEqual([(out.commitCircle as () => unknown)(), (out.circleInput as { enter: () => unknown }).enter(),
    (out.handleSketchLinePoint as () => unknown)()], ['cc', 'ce', 'lp'], 'ready');
  assert.deepEqual(ck.map(k => (out[k] as () => unknown)()), ck, 'ready11');
  un();
  calls.length = 0;
  const b2 = notices.length;
  const outK = gateAll(compas, editing, constraints, entityMutations, dimensions, creation);
  ck.forEach(k => (outK[k] as () => unknown)());
  assert.equal(calls.length, 11, 'KOMPAS11 once');
  assert.equal(notices.length, b2, 'KOMPAS11 no notice');
}
{
  const acts: string[] = [];
  const A = (n: string) => () => { acts.push(n); };
  const base = {
    cancelDimensionCreation: A('cd'), resetActiveTool: A('rs'), resetExtrude: A('re'),
    clearDimensionEdit: A('ce'), clearTransientSelection: A('cs'), setActiveCommand: A('sc'),
    setPanel: A('pl'), setActiveWorkspace: A('ws'), notice: A('nt'),
    documentKind: 'part' as const,
  };
  const C = (c: string | null, m: string | null) => cancelCmd({ ...base, activeCommand: c, dimensionCreationMode: m });
  C('sketch.circle', null);
  assert.deepEqual(acts, ['rs', 'sc', 'ce', 'pl', 'cs', 'ws', 'nt'], 'sketch');
  acts.length = 0;
  C('part.extrude', null);
  assert.deepEqual(acts, ['rs', 're', 'sc', 'ce', 'pl', 'cs', 'ws', 'nt'], 'extrude');
  acts.length = 0;
  C(null, 'diameter');
  assert.deepEqual(acts, ['cd'], 'dimension');
}
{
  const rect = { left: 100, top: 50, width: 800, height: 800 };
  const frame = sketchDisplayFrame({ center: [0, 0], span: 100 });
  const basis = { origin: { x: 500, y: 450 }, u: { x: 508, y: 450 }, v: { x: 500, y: 442 } };
  const mk = (b: typeof basis, rev: number) => ({ ready: true, revision: rev, basis: b }) as SketchCameraMappingReady;
  assert.deepEqual([alignedWithFrame(mk(basis, 3), frame, rect), normalBasisScale(mk(basis, 3))], [true, 8], 'aligned');
  assert.equal(alignedWithFrame(mk({ origin: { x: 502, y: 450 }, u: basis.u, v: basis.v }, 4), frame, rect), false, 'shift');
  assert.equal(normalBasisScale(mk({ origin: basis.origin, u: { x: 508, y: 451 }, v: basis.v }, 5)), null, 'non-normal');
}

console.log('M2O A05 v3 gate PASS');
