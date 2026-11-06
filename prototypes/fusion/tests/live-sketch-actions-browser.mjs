import assert from 'node:assert/strict';
import { chromium } from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tool, quick, entity, stage, near, searchAction, invoke, idle, solved, startSketch,
  screenPoint, pick, draw, select, geometry, save, reopen, setDimension,
  constraintIntent, dimensionIntent, vector, residual,
} from './live-sketch-actions-harness.mjs';

const directory = dirname(fileURLToPath(import.meta.url)), out = resolve(directory, '../evidence');
const url = new URL(process.env.ASA_FUSION_URL || 'http://127.0.0.1:8093/');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Use an isolated loopback test server');
assert.ok(!['8099', '8098'].includes(url.port), 'Do not run action tests against an installed service');
assert.ok(url.port !== '8094' || process.env.GITHUB_ACTIONS === 'true', '8094 is reserved on D2-R2; only the existing disposable GitHub CI server may use it');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceSnapshotDescriptor = process.env.ASA_FUSION_SOURCE_SNAPSHOT_DESCRIPTOR
  ? JSON.parse(process.env.ASA_FUSION_SOURCE_SNAPSHOT_DESCRIPTOR) : null;
if (sourceSnapshotDescriptor) assert.equal(hash(JSON.stringify(sourceSnapshotDescriptor)), process.env.ASA_FUSION_SOURCE_SNAPSHOT,
  'The source snapshot digest must match its exact canonical descriptor');
const testSourceSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
const helperSourceSha256 = hash(await readFile(resolve(directory, 'live-sketch-actions-harness.mjs')));
const bindingSourceSha256 = hash(await readFile(resolve(directory, '../../../src/web/M2CadUiActions.ts')));
const referenceCaptureSha256 = hash(await readFile(resolve(directory, '../reference_capture/sketch-active-ui-20261106.json')));
const browser = await chromium.launch({ headless: true, executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE });
const report = {
  schemaVersion: 2, parityRevision: 'fusion-sketch-parity-002', status: 'RUNNING',
  sourceSnapshotSha256: process.env.ASA_FUSION_SOURCE_SNAPSHOT || null, sourceSnapshotDescriptor,
  testSourceSha256, helperSourceSha256, bindingSourceSha256, referenceCaptureSha256,
  input: 'Empty public Fusion route; pointer-built geometry; ribbon/search actions; read-only persisted-document assertions',
  origin: url.origin, viewport: { width: 2048, height: 1137, dpr: 1 },
  userProfileUsed: false, visualParityAccepted: false, pageErrors: [], actions: [], screenshots: [],
};
const nativeIds = {
  coincident: 'ConstraintCoincident', tangent: 'ConstraintTangent', equal: 'ConstraintEqual',
  parallel: 'ConstraintParallel', perpendicular: 'ConstraintPerpendicular', fixed: 'ConstraintFix',
  concentric: 'ConstraintConcentric', symmetric: 'ConstraintSymmetry',
};
let phase;
async function capture(page, name) {
  const filename = 'fusion-live-sketch-actions-' + name + '.png';
  const bytes = await page.screenshot({ path: resolve(out, filename) });
  report.screenshots.push({ file: filename, sha256: hash(bytes), viewport: { width: 2048, height: 1137, dpr: 1 } });
}
async function actionCase(id, work) {
  phase = id;
  let opened;
  try {
    opened = await startSketch(browser, url.href);
    const proof = await work(opened.page);
    assert.deepEqual(opened.errors, [], 'No uncaught page errors');
    const wasm = await opened.page.evaluate(() => performance.getEntriesByType('resource')
      .map(entry => entry.name).filter(name => /\.wasm(?:$|[?#])/.test(name)));
    assert.ok(wasm.some(name => /plane[-_]?gcs/i.test(name)), 'Real PlaneGCS WASM must be loaded');
    assert.deepEqual(wasm.filter(name => !/plane[-_]?gcs/i.test(name)), [], 'Sketch-only action must load only PlaneGCS WASM');
    const { surface, undo, redo, saveReloadOpen, ...assertions } = proof;
    report.actions.push({ cadUiAction: id, status: 'PASS', inputRoute: surface, solverVerified: true, persisted: true,
      undoRedo: undo === true && redo === true, saveReopen: saveReloadOpen === true, ...assertions, pageErrors: opened.errors });
    console.log('PASS ' + id);
  } catch (error) {
    report.actions.push({ cadUiAction: id, status: 'FAIL', phase, error: error.message, pageErrors: opened?.errors || [] });
    console.error('FAIL ' + id + ' [' + phase + '] ' + error.stack);
    if (opened) await capture(opened.page, id.replaceAll('.', '-') + '-debug').catch(() => {});
  } finally {
    if (opened) await opened.page.close();
  }
}
async function disabledBeforeGeometry(page, id) {
  const control = id === 'constraint.pointOnCurve' || id.startsWith('dimension.') || id === 'sketch.entity.delete'
    ? await searchAction(page, id) : tool(page, id);
  assert.equal(await control.isEnabled(), false, id + ' must be disabled without eligible geometry');
  await page.keyboard.press('Escape');
}
async function waitConstraint(page, type, present = true) {
  await page.waitForFunction(({ type, present }) =>
    !!document.querySelector('[data-sketch-constraint-id][data-constraint-type="' + type + '"]') === present, { type, present });
}
async function chooseConstraint(page, kind, ids, firstOnly = false) {
  const [a, b, axis] = ids, selectors = kind === 'coincident'
    ? ['[data-coincident-entity-id="' + a + '"][data-coincident-point="b"]', '[data-coincident-entity-id="' + b + '"][data-coincident-point="a"]']
    : kind === 'tangent' ? ['[data-tangent-circle-id="' + b + '"]', '[data-tangent-line-id="' + a + '"]']
    : kind === 'concentric' ? ids.map(id => '[data-concentric-circle-id="' + id + '"]')
    : kind === 'symmetric' ? ['[data-symmetry-endpoint="' + a + ':b"]', '[data-symmetry-endpoint="' + b + ':a"]', '[data-symmetry-axis-id="' + axis + '"][data-symmetry-axis-valid="true"]']
    : kind === 'pointOnCurve' ? ['[data-point-on-curve-endpoint="' + a + ':a"]', '[data-point-on-curve-target-id="' + b + '"][data-point-on-curve-target-valid="true"]']
    : ids.map(id => '[data-' + kind + '-line-id="' + id + '"]');
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.' + kind + '"]');
  await surface.waitFor();
  for (const [index, selector] of selectors.entries()) {
    if (index && firstOnly) break;
    await pick(page, selector, /endpoint|coincident-point/.test(selector));
    if (index < selectors.length - 1) {
      const selected = kind === 'symmetric' ? 'symmetry' : kind === 'pointOnCurve' ? 'point-on-curve' : kind;
      await page.locator(selector + '[data-' + selected + '-selected="true"]').waitFor();
    }
  }
  if (!firstOnly) { await surface.waitFor({ state: 'detached' }); await idle(page); }
}
async function constraintGeometry(page, kind) {
  if (kind === 'concentric') return [
    await draw(page, 'circle', [[-20, 10], [-12, 10]]),
    await draw(page, 'circle', [[20, -10], [25, -10]]),
  ];
  if (kind === 'tangent') return [
    await draw(page, 'line', [[-30, 15], [20, 8]]),
    await draw(page, 'circle', [[8, -18], [16, -18]]),
  ];
  if (kind === 'pointOnCurve') return [
    await draw(page, 'line', [[-30, 20], [-12, 7]]),
    await draw(page, 'line', [[-25, -20], [28, -20]]),
  ];
  const ids = [
    await draw(page, 'line', [[-30, 15], [-10, 10]]),
    await draw(page, 'line', [[10, -15], [28, -7]]),
  ];
  if (kind === 'symmetric') ids.push(await draw(page, 'line', [[0, 30], [0, -30]]));
  return ids;
}
function assertConstraintRefs(constraint, kind, ids) {
  if (kind === 'coincident') assert.deepEqual(constraint.data.refs, [{ entityId: ids[0], point: 'b' }, { entityId: ids[1], point: 'a' }]);
  if (kind === 'pointOnCurve') assert.deepEqual(constraint.data.source, { entityId: ids[0], point: 'a' });
  if (kind === 'symmetric') {
    assert.deepEqual(constraint.data.refs.map(ref => ref.entityId + ':' + ref.point).sort(), [ids[0] + ':b', ids[1] + ':a'].sort());
    assert.equal(constraint.entityIds[2], ids[2]);
  }
}
async function constraintCase(page, kind) {
  const id = 'constraint.' + kind;
  await disabledBeforeGeometry(page, id);
  const ids = await constraintGeometry(page, kind), before = await save(page), beforeGeometry = await geometry(page, ids);
  assert.ok(residual(kind, beforeGeometry) > .1, 'Inputs must initially violate the requested relation');
  phase = id + ':cancel';
  await invoke(page, id); await chooseConstraint(page, kind, ids, true); await page.keyboard.press('Escape'); await idle(page);
  assert.deepEqual(await save(page), before, 'Cancel selection must leave document byte-equivalent');
  phase = id + ':apply';
  await invoke(page, id); await chooseConstraint(page, kind, ids); await waitConstraint(page, kind); await solved(page, ids.length);
  const saved = await save(page), constraint = constraintIntent(saved, kind, ids);
  assertConstraintRefs(constraint, kind, ids);
  const afterGeometry = await geometry(page, ids), afterResidual = residual(kind, afterGeometry);
  near(afterResidual, 0, kind + ' PlaneGCS residual');
  if (kind === 'concentric') for (let i = 0; i < 2; i++) near(afterGeometry[i][2], beforeGeometry[i][2], 'Concentric preserves radius');
  phase = id + ':undo-redo';
  await quick(page, 'system.undo').click(); await waitConstraint(page, kind, false); await solved(page, ids.length);
  assert.equal((await save(page)).constraints.filter(c => c.type === kind).length, 0);
  assert.ok(residual(kind, await geometry(page, ids)) > .1, 'Undo must restore the unconstrained relation');
  await quick(page, 'system.redo').click(); await waitConstraint(page, kind); await solved(page, ids.length);
  assert.equal(constraintIntent(await save(page), kind, ids).id, constraint.id, 'Redo preserves constraint ID');
  near(residual(kind, await geometry(page, ids)), 0, 'Redo relation');
  phase = id + ':save-open';
  await reopen(page, ids.length);
  assert.deepEqual(constraintIntent(await save(page), kind, ids), constraint, 'Open preserves constraint ID and references');
  near(residual(kind, await geometry(page, ids)), 0, 'Reopened relation');
  if (kind === 'symmetric' || kind === 'tangent') await capture(page, kind);
  return { surface: kind === 'pointOnCurve' ? 'authored-search' : 'native-ribbon', nativeCommandId: nativeIds[kind] || null,
    disabledWithoutGeometry: true, cancelWithoutMutation: true, solverResidual: afterResidual, entityIds: ids,
    constraintId: constraint.id, undo: true, redo: true, saveReloadOpen: true };
}
async function fixedCase(page) {
  const id = 'constraint.fixed'; await disabledBeforeGeometry(page, id);
  const line = await draw(page, 'line', [[-25, 15], [-5, 5]]);
  await select(page, line); await invoke(page, 'constraint.horizontal'); await waitConstraint(page, 'horizontal');
  const before = await save(page), beforeGeometry = await geometry(page, [line]);
  near(beforeGeometry[0][1], beforeGeometry[0][3], 'Horizontal solve before Fixed');
  phase = id + ':apply';
  await invoke(page, id); await waitConstraint(page, 'fixed'); await solved(page, 1);
  const saved = await save(page), fixed = constraintIntent(saved, 'fixed', [line]);
  const frozen = saved.sketches[0].entities.find(item => item.id === line);
  near(frozen.data.from[1], frozen.data.to[1], 'Fixed freezes solved rather than stale intent coordinates');
  assert.equal(await tool(page, id).isEnabled(), false, 'Duplicate Fixed must be disabled');
  const point = await screenPoint(entity(page, line));
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 35, point.y - 20, { steps: 4 }); await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.live-status')?.textContent?.includes('Зафиксированный элемент нельзя перемещать'));
  assert.equal(await stage(page).getAttribute('data-dragging-sketch-entity-id'), '');
  assert.deepEqual(await save(page), saved, 'Rejected fixed drag must not mutate document');
  phase = id + ':undo-redo';
  await quick(page, 'system.undo').click(); await waitConstraint(page, 'fixed', false); await solved(page, 1);
  assert.deepEqual(await save(page), before, 'One Undo must revert the atomic Fixed mutation');
  await select(page, line); assert.equal(await tool(page, id).isEnabled(), true);
  await quick(page, 'system.redo').click(); await waitConstraint(page, 'fixed');
  assert.deepEqual(constraintIntent(await save(page), 'fixed', [line]), fixed);
  phase = id + ':save-open'; await reopen(page, 1); await select(page, line);
  assert.equal(await tool(page, id).isEnabled(), false);
  assert.deepEqual(constraintIntent(await save(page), 'fixed', [line]), fixed);
  return { surface: 'native-ribbon', nativeCommandId: nativeIds.fixed, disabledWithoutGeometry: true,
    freezesSolvedCoordinates: true, rejectsDrag: true, duplicateDisabled: true, entityIds: [line],
    constraintId: fixed.id, undo: true, redo: true, saveReloadOpen: true };
}
async function dimensionTargets(page, kind) {
  if (kind === 'radius') return [await draw(page, 'circle', [[0, 0], [8, 0]])];
  const ids = [await draw(page, 'line', [[-30, 15], [-10, 10]])];
  if (kind === 'angular') ids.push(await draw(page, 'line', [[10, -15], [28, -7]]));
  return ids;
}
async function activateDimension(page, kind, ids) {
  if (kind !== 'angular') await select(page, ids[0]);
  await invoke(page, 'dimension.' + kind);
  if (kind === 'angular') {
    const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="dimension.angular"]'); await surface.waitFor();
    await pick(page, '[data-angular-line-id="' + ids[0] + '"]');
    await page.locator('[data-angular-line-id="' + ids[0] + '"][data-angular-selected="true"]').waitFor();
    await pick(page, '[data-angular-line-id="' + ids[1] + '"]'); await surface.waitFor({ state: 'detached' });
  }
  const input = page.getByLabel(kind === 'angular' ? 'Угол' : 'Размер', { exact: true });
  await input.waitFor(); return input;
}
async function measured(page, kind, ids) {
  const [a, b] = await geometry(page, ids);
  if (kind === 'radius') return a[2];
  const av = vector(a);
  if (kind === 'horizontal') return Math.abs(av[0]);
  if (kind === 'vertical') return Math.abs(av[1]);
  const bv = vector(b);
  return Math.abs(Math.atan2(av[0] * bv[1] - av[1] * bv[0], av[0] * bv[0] + av[1] * bv[1])) * 180 / Math.PI;
}
async function dimensionCase(page, kind) {
  const id = 'dimension.' + kind; await disabledBeforeGeometry(page, id);
  const ids = await dimensionTargets(page, kind), before = await save(page), initial = await measured(page, kind, ids);
  const value = { horizontal: 32, vertical: 24, radius: 12, angular: 60 }[kind], editedValue = { horizontal: 38, vertical: 30, radius: 15, angular: 45 }[kind];
  phase = id + ':invalid-cancel';
  let input = await activateDimension(page, kind, ids);
  await input.fill(kind === 'angular' ? '180' : '-1');
  assert.equal(await page.locator('.live-parameters .live-commit').isEnabled(), false, 'Invalid dimension cannot commit');
  assert.deepEqual(await save(page), before, 'Invalid draft must not mutate intent');
  await input.fill(String(value)); await input.press('Escape'); await idle(page);
  assert.deepEqual(await save(page), before, 'Cancelled dimension must not mutate intent');
  phase = id + ':apply';
  input = await activateDimension(page, kind, ids); await input.fill(String(value)); await page.locator('.live-parameters .live-commit').click(); await idle(page); await solved(page, ids.length);
  const created = dimensionIntent(await save(page), kind, ids, value);
  near(await measured(page, kind, ids), value, kind + ' solved dimension', .01);
  phase = id + ':undo-redo';
  await quick(page, 'system.undo').click(); await page.locator('[data-sketch-dimension-id="' + created.id + '"]').waitFor({ state: 'detached' }); await solved(page, ids.length);
  assert.equal((await save(page)).dimensions.length, 0); near(await measured(page, kind, ids), initial, 'Undo dimension', .01);
  await quick(page, 'system.redo').click(); await page.locator('[data-sketch-dimension-id="' + created.id + '"]').waitFor(); await solved(page, ids.length);
  assert.equal(dimensionIntent(await save(page), kind, ids, value).id, created.id);
  phase = id + ':save-open'; await reopen(page, ids.length);
  assert.equal(dimensionIntent(await save(page), kind, ids, value).id, created.id); near(await measured(page, kind, ids), value, 'Reopened dimension', .01);
  phase = id + ':annotation-edit';
  await page.locator('[data-sketch-dimension-id="' + created.id + '"] text').dblclick();
  await page.getByLabel('Значение', { exact: true }).fill(String(editedValue));
  await page.getByLabel('Значение', { exact: true }).press('Enter'); await idle(page); await solved(page, ids.length);
  assert.equal(dimensionIntent(await save(page), kind, ids, editedValue).id, created.id);
  near(await measured(page, kind, ids), editedValue, 'Edited governing dimension', .01);
  if (kind === 'angular') await capture(page, 'angular-edited');
  return { surface: 'authored-search', disabledWithoutGeometry: true, invalidValueRejected: true,
    cancelWithoutMutation: true, entityIds: ids, dimensionId: created.id, initial, value, editedValue,
    governingSolverGeometry: true, annotationEditPreservesId: true, undo: true, redo: true, saveReloadOpen: true };
}
async function deleteCase(page) {
  const id = 'sketch.entity.delete'; await disabledBeforeGeometry(page, id);
  const line = await draw(page, 'line', [[-30, 15], [-10, 10]]), circle = await draw(page, 'circle', [[20, -15], [27, -15]]);
  await select(page, line); await invoke(page, 'constraint.horizontal'); await waitConstraint(page, 'horizontal');
  await select(page, line); await setDimension(page, 'dimension.linear', 30); await solved(page, 2);
  const before = await save(page); assert.equal(before.constraints.length, 1); assert.equal(before.dimensions.length, 1);
  phase = id + ':delete'; await select(page, line); await invoke(page, id); await solved(page, 1);
  let saved = await save(page);
  assert.deepEqual(saved.sketches[0].entities.map(item => item.id), [circle]);
  assert.equal(saved.constraints.length, 0); assert.equal(saved.dimensions.length, 0);
  assert.equal(await stage(page).getAttribute('data-selected-sketch-entity-id'), '');
  phase = id + ':undo-redo'; await quick(page, 'system.undo').click(); await solved(page, 2);
  assert.deepEqual(await save(page), before, 'Undo restores entity, dimension and constraint stable IDs');
  await quick(page, 'system.redo').click(); await solved(page, 1);
  assert.deepEqual(await save(page), saved, 'Redo replays the same deletion');
  phase = id + ':save-open'; await reopen(page, 1);
  assert.deepEqual(await save(page), saved);
  return { surface: 'authored-search', disabledWithoutGeometry: true, deletedEntityId: line, retainedEntityId: circle,
    dependentConstraintAndDimensionRemoved: true, undoRestoresAllStableIds: true, undo: true, redo: true, saveReloadOpen: true };
}
try {
  for (const kind of ['coincident', 'tangent', 'equal', 'parallel', 'perpendicular', 'concentric', 'symmetric', 'pointOnCurve'])
    await actionCase('constraint.' + kind, page => constraintCase(page, kind));
  await actionCase('constraint.fixed', fixedCase);
  for (const kind of ['horizontal', 'vertical', 'radius', 'angular'])
    await actionCase('dimension.' + kind, page => dimensionCase(page, kind));
  await actionCase('sketch.entity.delete', deleteCase);
  const passed = report.actions.filter(item => item.status === 'PASS');
  report.verifiedActionIds = passed.map(item => item.cadUiAction);
  report.pageErrors = report.actions.flatMap(item => item.pageErrors);
  report.expectedActionCount = 14; report.complete = passed.length === 14 && report.actions.length === 14;
  report.status = report.complete ? 'PASS' : 'FAIL';
  await writeFile(resolve(out, 'fusion-live-sketch-actions-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete) process.exitCode = 1;
} finally {
  await browser.close();
}
