import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import {
  CadApplicationImpl,
  OpenCascadePartRuntime,
  PlaneGCSSketchSolverRuntime,
  SolvedSketchPartRuntimeAdapter,
  createEmptyCadDocument,
  type CadFeatureId,
  type CadPlaneName,
  type CadSketchId,
  type CadStableReferenceId,
} from '../../src';

// K1: Sketch solver -> one profile analysis -> OpenCascade, on every origin plane.
console.log('\nASA-CAD K1 kernel profiles through CadApplication + PlaneGCS + OpenCascade');
const oc = await initOpenCascade();
const EPS = 1e-6;

type P = readonly [number, number];
type Bounds = [number, number, number, number, number, number];

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}

async function part(title: string) {
  const core = new OpenCascadePartRuntime(oc);
  const app = new CadApplicationImpl(
    createEmptyCadDocument('part', { title }),
    new SolvedSketchPartRuntimeAdapter(core, new PlaneGCSSketchSolverRuntime()),
  );
  const run = async (command: Parameters<typeof app.execute>[0]) => {
    const result = await app.execute(command);
    assert.equal(result.ok, true, `${command.id}: ${result.error?.message}`);
    return result.createdIds ?? [];
  };
  const sketch = async (support: CadPlaneName | CadStableReferenceId) =>
    (await run({ id: 'sketch.create', payload: { support } }))[0] as CadSketchId;
  const polygon = async (sketchId: CadSketchId, points: P[]) => {
    for (let i = 0; i < points.length; i += 1) {
      await run({ id: 'sketch.line', payload: { sketchId, from: points[i], to: points[(i + 1) % points.length] } });
    }
  };
  const rebuild = async () => {
    const result = await app.execute({ id: 'document.rebuild', payload: {} });
    return result;
  };
  const analysis = async () => {
    const result = await rebuild();
    assert.equal(result.ok, true, result.error?.message);
    const value = core.getLastAnalysis();
    assert.ok(value);
    return value;
  };
  const assertBounds = (bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }, expected: Bounds, label: string) => {
    const actual = [bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ];
    actual.forEach((value, index) => near(value, expected[index], 1e-4, `${label}[${index}]`));
  };
  return { app, run, sketch, polygon, rebuild, analysis, assertBounds, dispose: () => app.dispose() };
}

{
  const p = await part('L-контур');
  const s = await p.sketch('XY');
  await p.polygon(s, [[0, 0], [40, 0], [40, 10], [10, 10], [10, 30], [0, 30]]);
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 10 } });
  const a = await p.analysis();
  near(a.volume, 6000, 1e-3, 'L volume');
  p.assertBounds(a.bounds, [0, 0, 0, 40, 30, 10], 'L bounds');
  console.log('  ✓ closed line contour (L-shape) on XY extrudes from solved geometry');
  p.dispose();
}

for (const [plane, expected] of [
  ['XZ', [-30, -10, -20, 30, 0, 20]],
  ['YZ', [0, -30, -20, 10, 30, 20]],
] as const) {
  const p = await part(`Прямоугольник ${plane}`);
  const s = await p.sketch(plane);
  await p.run({ id: 'sketch.rectangle', payload: { sketchId: s, origin: [-30, -20], width: 60, height: 40 } });
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 10 } });
  const a = await p.analysis();
  near(a.volume, 24000, 1e-3, `${plane} volume`);
  p.assertBounds(a.bounds, expected as Bounds, `${plane} bounds`);
  console.log(`  ✓ rectangle on ${plane} extrudes along the shared frame normal`);
  p.dispose();
}

{
  const p = await part('Окружность');
  const s = await p.sketch('XY');
  await p.run({ id: 'sketch.circle', payload: { sketchId: s, center: [5, 5], diameter: 20 } });
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 5, symmetric: true } });
  const a = await p.analysis();
  near(a.volume, Math.PI * 100 * 5, 1e-2, 'cylinder volume');
  p.assertBounds(a.bounds, [-5, -5, -2.5, 15, 15, 2.5], 'cylinder bounds');
  console.log('  ✓ circle profile → cylinder (symmetric extrude)');
  p.dispose();
}

{
  const p = await part('Паз');
  const s = await p.sketch('XY');
  await p.run({ id: 'sketch.line', payload: { sketchId: s, from: [0, -5], to: [20, -5] } });
  await p.run({ id: 'sketch.arc', payload: { sketchId: s, center: [20, 0], start: [20, -5], end: [20, 5] } });
  await p.run({ id: 'sketch.line', payload: { sketchId: s, from: [20, 5], to: [0, 5] } });
  await p.run({ id: 'sketch.arc', payload: { sketchId: s, center: [0, 0], start: [0, 5], end: [0, -5] } });
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 4, reverse: true } });
  const a = await p.analysis();
  near(a.volume, (200 + Math.PI * 25) * 4, 1e-2, 'slot volume');
  p.assertBounds(a.bounds, [-5, -5, -4, 25, 5, 0], 'slot bounds');
  console.log('  ✓ lines + arcs contour (slot) → exact B-Rep arcs, reverse direction');
  p.dispose();
}

{
  const p = await part('Пластина с отверстием');
  const s = await p.sketch('XY');
  await p.run({ id: 'sketch.rectangle', payload: { sketchId: s, origin: [-30, -20], width: 60, height: 40 } });
  await p.run({ id: 'sketch.circle', payload: { sketchId: s, center: [0, 0], diameter: 12 } });
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 10 } });
  const a = await p.analysis();
  near(a.volume, (2400 - Math.PI * 36) * 10, 1e-2, 'plate volume');
  console.log('  ✓ outer contour + inner circle → plate with a through hole');

  const [extrudeId] = p.app.getDocument().kind === 'part'
    ? (p.app.getDocument() as { features: Array<{ id: CadFeatureId }> }).features.map((item) => item.id)
    : [];
  const top = await p.app.captureReference({ kind: 'face', sourceFeatureId: extrudeId, point: [20, 10, 10], semanticRole: 'top-face' });
  const s2 = await p.sketch(top);
  await p.polygon(s2, [[15, 5], [25, 5], [25, 15], [15, 15]]);
  await p.run({ id: 'feature.cutExtrude', payload: { sketchId: s2, end: 'blind', distance: 4 } });
  const cut = await p.analysis();
  near(cut.volume, (2400 - Math.PI * 36) * 10 - 10 * 10 * 4, 1e-2, 'blind square pocket volume');
  console.log('  ✓ square blind pocket on a captured top face cuts against the outward normal');
  p.dispose();
}

{
  const p = await part('Открытый контур');
  const s = await p.sketch('XY');
  await p.run({ id: 'sketch.line', payload: { sketchId: s, from: [0, 0], to: [10, 0] } });
  await p.run({ id: 'sketch.line', payload: { sketchId: s, from: [10, 0], to: [10, 10] } });
  await p.run({ id: 'feature.extrude', payload: { sketchId: s, distance: 5 } });
  const result = await p.rebuild();
  assert.equal(result.ok, false, 'open contour must not build a body');
  assert.match(result.error?.message ?? JSON.stringify(result), /контур не замкнут/);
  console.log('  ✓ open contour fails closed with the same reason the UI shows');
  p.dispose();
}

void EPS;
console.log('ASA-CAD K1 kernel profiles PASS');
