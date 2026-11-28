import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { activateFusionCircle, assertNoPageErrors, atFusionEditor, createFusionPart,
createFusionXYSketch, fusionLauncher, launchFusionBrowser, newFusionPage,
saveFusionDocument } from './FusionBrowserHarness.mjs';
import { waitSolvedOverlay } from './M3BrowserHarness.mjs';

const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/').href;
const out = process.env.ASA_FUSION_SOLID_FIT_DIR ?? 'test-results/fusion-solid-fit';
const title = 'Fusion Solid Fit';
const r = { task: 'FUS-SOLID-FIT-304', status: 'RUNNING', url: home, cases: [], screenshots: [] };
let browser, page, failure, projectId, sketchId, errors = [];
const viewport = () => page.locator('[data-testid="cad-viewport"]');
const canvas = () => viewport().locator('canvas');
const ready = () => page.locator('.cad-app[data-feature-count="1"][data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
const save = async () => (await saveFusionDocument(page, projectId)).document;
const near = (a, b, message, tolerance = 1e-7) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${message}: ${a} != ${b}`);
async function shot(name) {
await page.screenshot({ path: path.join(out, name) }); r.screenshots.push(name);
}
async function camera() {
return viewport().evaluate(host => {
  const c = host.querySelector('canvas');
  const vector = value => (value ?? '').split(',').map(Number);
  return { zoom: Number(c?.dataset.cameraZoom), projection: c?.dataset.projection,
    matrix: vector(c?.dataset.projectionMatrix), position: vector(host.dataset.cameraPosition),
    target: vector(host.dataset.cameraTarget), up: vector(host.dataset.cameraUp),
    bounds: vector(host.dataset.bounds), revision: host.dataset.runtimeRevision,
    changes: Number(host.dataset.viewChangeCount) };
});
}
async function fit() {
await page.getByRole('button', { name: 'Показать всё', exact: true }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="cad-viewport"]')?.dataset.viewName === 'fit');
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
return camera();
}
async function step(name, run) {
const item = { name, status: 'RUNNING' }; r.cases.push(item);
try { await run(item); assertNoPageErrors(errors, name); item.status = 'PASS'; }
catch (e) { item.status = 'FAIL'; item.error = e.message; throw e; }
}
try {
await mkdir(out, { recursive: true });
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
r.gitHead = git(['rev-parse', 'HEAD']);
r.worktreeDirty = !!git(['status', '--porcelain=v1', '--untracked-files=normal']);
r.checkoutSha = r.worktreeDirty ? 'uncommitted' : r.gitHead;
browser = await launchFusionBrowser(); r.browser = browser.version();
({ page, errors } = await newFusionPage(browser));
r.viewport = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, visualViewport?.scale]);
assert.deepEqual(r.viewport, [1920, 1080, 1, 1]);
await page.goto(home, { waitUntil: 'networkidle' });
projectId = await createFusionPart(page, title); sketchId = await createFusionXYSketch(page);
let doc;
await step('Ordinary Circle and Extrude', async item => {
  await activateFusionCircle(page);
  const point = await page.locator('[data-testid="cad-sketch-interaction"][data-tool="circle"]').evaluate(svg => {
    const ctm = svg.ownerDocument.querySelector('[data-sketch-layer="grid"] > g')?.getScreenCTM(); if (!ctm) throw new Error('Missing Sketch CTM');
    const p = new DOMPoint(20, -10).matrixTransform(ctm), hit = document.elementFromPoint(p.x, p.y);
    if (!hit || (hit !== svg && !svg.contains(hit))) throw new Error('Circle center is covered');
    return [p.x, p.y];
  });
  await page.mouse.click(...point);
  const circle = page.locator('.live-parameters[data-command="sketch.circle"]');
  await circle.getByLabel(/^Диаметр(?:, мм)?$/, { exact: true }).fill('40');
  await page.keyboard.press('Enter'); await circle.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 1, 'Circle');
  await page.locator('[data-palette-command="sketch.finish"]').click();
  await page.locator('.live-workarea[data-workspace="solid"]').waitFor();
  await page.locator('.live-top [data-native-command="Extrude"]').click();
  const panel = page.locator('.live-parameters[data-command="part.extrude"]');
  await panel.getByRole('spinbutton', { name: 'Расстояние', exact: true }).fill('20');
  await panel.locator('.live-commit').click(); await ready(); await canvas().waitFor();
  doc = await save();
  const sketch = doc.sketches[0], entity = sketch.entities[0];
  assert.deepEqual([sketch.id, sketch.entities.length, entity.type], [sketchId, 1, 'circle']);
  entity.data.center.forEach((v, i) => near(v, [20, 10][i], 'Circle center', 0.15));
  near(entity.data.diameter, 40, 'Circle diameter');
  assert.deepEqual([doc.features.length, doc.features[0].type, doc.bodies.length], [1, 'extrude', 1]);
});
await step('Wheel zoom then typed Fit', async item => {
  item.before = await fit(); assert.equal(item.before.projection, 'orthographic');
  near(item.before.zoom, 1, 'Baseline zoom');
  assert.equal(item.before.matrix.length, 16); assert.ok(item.before.matrix.every(Number.isFinite)); await shot('01-before-zoom.png');
  const box = await canvas().boundingBox(); assert.ok(box && box.width > 500 && box.height > 300);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1000);
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="cad-viewport"] canvas')?.dataset.cameraZoom) > 1.5);
  item.zoomed = await camera(); assert.notDeepEqual(item.zoomed.matrix, item.before.matrix);
  await shot('02-zoomed.png'); item.after = await fit();
  near(item.after.zoom, 1, 'FUSION_FIT_SCALE_UNCHANGED');
  assert.equal(item.after.projection, 'orthographic');
  item.after.matrix.forEach((v, i) => near(v, item.before.matrix[i], `Fit projection[${i}]`));
  assert.equal(item.after.revision, item.before.revision, 'CAD recompute during navigation');
  assert.deepEqual(await save(), doc, 'Navigation mutated document');
  await shot('03-after-fit.png');
});
await step('History and Save/Home/Continue', async item => {
  await page.locator('.live-quickbuttons [data-command-id="system.undo"]').click();
  await page.locator('.cad-app[data-feature-count="0"]').waitFor();
  const undone = await save(); assert.equal(undone.features.length, 0); assert.equal(undone.bodies.length, 0);
  assert.deepEqual(undone.sketches, doc.sketches, 'Navigation added Undo');
  await page.locator('.live-quickbuttons [data-command-id="system.redo"]').click(); await ready();
  const stable = await save(); assert.deepEqual(stable, doc);
  await page.getByRole('button', { name: 'ASA CAD — на главную', exact: true }).click();
  await fusionLauncher(page).waitFor();
  await fusionLauncher(page).getByRole('button', { name: /^Продолжить:/ }).click();
  await atFusionEditor(page, projectId, 1); await ready(); await canvas().waitFor();
  assert.deepEqual(await save(), stable, 'Save/Continue changed document');
  item.reopened = await fit(); near(item.reopened.zoom, 1, 'Reopened Fit zoom'); item.historyFeatures = [1, 0, 1];
  item.ids = { projectId, sketchId, documentId: stable.documentId, featureId: stable.features[0].id };
  await shot('04-reopened.png');
});
r.status = 'PASS';
} catch (e) {
failure = e; r.status = 'FAIL'; r.error = String(e.stack ?? e);
if (page) try { await shot('failure.png'); } catch (s) { r.screenshotError = s.message; }
} finally {
r.pageErrors = errors;
try { await browser?.close(); } catch (e) { failure ??= e; r.status = 'FAIL'; r.cleanupError = e.message; }
await writeFile(path.join(out, 'report.json'), JSON.stringify(r, null, 2) + '\n');
}
if (failure) throw failure;
console.log('Fusion Solid Fit PASS');
