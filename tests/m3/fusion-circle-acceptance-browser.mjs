import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { activateFusionCircle, assertNoPageErrors, atFusionEditor, cancelFusionCircle,
createFusionPart, createFusionXYSketch, fusionLauncher, launchFusionBrowser,
newFusionPage, saveFusionDocument } from './FusionBrowserHarness.mjs';
import { waitSolvedOverlay } from './M3BrowserHarness.mjs';
const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/').href;
const out = process.env.ASA_FUSION_CIRCLE_ACCEPTANCE_DIR ?? 'test-results/fusion-circle-acceptance';
const title = 'Circle acceptance';
const surface = '[data-testid="cad-sketch-interaction"][data-tool="circle"]';
const selector = '.live-parameters[data-command="sketch.circle"]';
const r = { task: 'FUS/P03', status: 'RUNNING', checkoutSha: 'UNKNOWN', url: home, cases: [], pageErrors: [] };
let browser, page, failure, projectId, sketchId, id, stable;
const panel = () => page.locator(selector);
const field = () => panel().getByLabel(/^Диаметр(?:, мм)?$/, { exact: true });
const count = n => page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${n}"]`).waitFor();
const near = (a, e, t) => assert.ok(Number.isFinite(a) && Math.abs(a - e) <= t, `${a} != ${e} ±${t}`);
const shot = name => page.screenshot({ path: path.join(out, name) });
const save = async () => (await saveFusionDocument(page, projectId)).document;
const ids = overlay => overlay.locator('circle[data-sketch-entity-id]').evaluateAll(ns => ns.map(n => n.dataset.sketchEntityId));
async function point(world, action = 'click') {
const q = await page.locator(surface).evaluate((svg, p) => {
  const matrix = svg.getScreenCTM();
  if (!matrix) throw new Error('No CTM');
  const q = new DOMPoint(p[0], -p[1]).matrixTransform(matrix);
  const hit = document.elementFromPoint(q.x, q.y);
  if (!hit || (hit !== svg && !svg.contains(hit))) throw new Error('Covered point');
  return [q.x, q.y];
}, world);
await page.mouse[action](...q);
}
async function start(center) {
await activateFusionCircle(page); await point(center);
await page.locator(`${surface}[data-circle-phase="awaiting-point"]`).waitFor();
}
function geometry(doc, expected) {
assert.equal(doc.kind, 'part'); assert.equal(doc.sketches.length, 1);
const sketch = doc.sketches[0];
assert.equal(sketch.id, sketchId); assert.equal(sketch.support, 'XY');
assert.equal(sketch.entities.length, expected.length);
assert.deepEqual([doc.constraints, doc.dimensions, doc.features], [[], [], []]);
sketch.entities.forEach((entity, i) => {
  const [center, diameter] = expected[i];
  assert.equal(entity.type, 'circle'); assert.ok(entity.id);
  assert.equal(entity.data.center.length, 2);
  entity.data.center.forEach((v, axis) => near(v, center[axis], 0.15));
  near(entity.data.diameter, diameter, 0.001);
});
return sketch.entities;
}
async function step(name, run) {
const item = { name, status: 'RUNNING' }; r.cases.push(item);
try { await run(item); assertNoPageErrors(r.pageErrors, name); item.status = 'PASS'; }
catch (e) { item.status = 'FAIL'; item.error = String(e.message); throw e; }
}
try {
await mkdir(out, { recursive: true });
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
r.gitHead = git(['rev-parse', 'HEAD']);
r.worktreeDirty = !!git(['status', '--porcelain=v1', '--untracked-files=normal']);
r.checkoutSha = r.worktreeDirty ? 'uncommitted' : r.gitHead;
assert.ok(![8088, 8094, 8098, 8099].includes(+new URL(home).port));
browser = await launchFusionBrowser(); r.browser = browser.version();
const session = await newFusionPage(browser); page = session.page; r.pageErrors = session.errors;
r.viewport = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, visualViewport?.scale]);
assert.deepEqual(r.viewport, [1920, 1080, 1, 1]);
await page.goto(home, { waitUntil: 'networkidle' });
projectId = await createFusionPart(page, title); sketchId = await createFusionXYSketch(page);
await step('Numeric, focus, Undo/Redo', async item => {
  await start([-20, -15]); await page.keyboard.press('2');
  await page.waitForFunction(s => {
    const input = document.querySelector(`${s} input[aria-label^="Диаметр"]`);
    return input === document.activeElement && input.value === '2';
  }, selector);
  await page.keyboard.type('4,5'); assert.equal(await field().inputValue(), '24,5');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="sketch-circle-ghost"]')?.getAttribute('r')) === 12.25);
  const ghost = await page.locator('[data-testid="sketch-circle-ghost"]').evaluate(n =>
    [n.cx.baseVal.value, -n.cy.baseVal.value, n.r.baseVal.value]);
  near(ghost[0], -20, 0.15); near(ghost[1], -15, 0.15); near(ghost[2], 12.25, 0.0005);
  item.ghost = ghost; await shot('01-comma.png');
  await page.keyboard.press('Enter'); await panel().waitFor({ state: 'detached' });
  const overlay = await waitSolvedOverlay(page, 1, 'numeric');
  [id] = await ids(overlay);
  assert.ok(id);
  await page.keyboard.press('Control+z'); await count(0);
  await page.keyboard.press('Control+y');
  const restored = await waitSolvedOverlay(page, 1, 'redo');
  assert.deepEqual(await ids(restored), [id]);
  assert.equal(geometry(await save(), [[[-20, -15], 24.5]])[0].id, id);
  item.entityId = id; item.history = [1, 0, 1];
});
await step('Pointer repeat', async item => {
  await start([30, -10]); await point([40, -10]);
  await panel().waitFor({ state: 'detached' }); await waitSolvedOverlay(page, 2, 'pointer');
  const doc = await save(), entities = geometry(doc, [[[-20, -15], 24.5], [[30, -10], 20]]);
  assert.equal(entities[0].id, id); assert.notEqual(entities[1].id, id);
  stable = doc; item.entities = entities; await shot('02-circles.png');
});
await step('Cancel and Esc', async () => {
  await start([8, 5]);
  await cancelFusionCircle(page); await count(2);
  await start([8, 5]); await page.keyboard.press('Escape');
  await page.locator(`${surface}[data-circle-phase="awaiting-center"]`).waitFor(); await count(2);
  await page.keyboard.press('Escape'); await panel().waitFor({ state: 'detached' });
  assert.deepEqual(await save(), stable);
});
await step('Invalid input', async item => {
  await start([-10, 12]); item.inputs = [];
  for (const text of ['', 'abc', '0', '-1']) {
    await field().fill(text);
    assert.equal(await field().getAttribute('aria-invalid'), 'true');
    assert.equal(await panel().locator('.live-commit').isEnabled(), false, `Invalid: ${text}`);
    await page.keyboard.press('Enter'); await panel().waitFor(); await count(2);
    item.inputs.push(text);
  }
  await cancelFusionCircle(page); assert.deepEqual(await save(), stable);
});
await step('Save/Continue', async item => {
  await page.getByRole('button', { name: 'ASA CAD — на главную', exact: true }).click();
  await fusionLauncher(page).waitFor();
  await fusionLauncher(page).getByRole('button', { name: `Продолжить: ${title}`, exact: true }).click();
  await atFusionEditor(page, projectId, 1);
  await page.locator(`[data-timeline-sketch="${sketchId}"]`).click();
  const overlay = await waitSolvedOverlay(page, 2, 'reopen');
  const reopened = await ids(overlay);
  assert.deepEqual(reopened.slice().sort(), stable.sketches[0].entities.map(e => e.id).sort());
  const doc = await save();
  assert.deepEqual(doc, stable);
  item.ids = { projectId, documentId: doc.documentId, sketchId, entities: reopened }; await shot('03-reopen.png');
});
r.status = 'PASS';
} catch (error) {
failure = error; r.status = 'FAIL'; r.error = String(error.stack ?? error);
if (page) {
  try { await shot('failure.png'); } catch (e) { r.screenshotError = String(e.message); }
} else r.screenshot = 'NOT_CAPTURED';
} finally {
try { await browser?.close(); }
catch (e) { failure ??= e; r.status = 'FAIL'; r.cleanupError = String(e.message); }
try { await writeFile(path.join(out, 'report.json'), JSON.stringify(r, null, 2) + '\n'); }
catch (e) { failure ??= e; console.error(`P03 report: ${e.message}`); }
}
if (failure) throw failure;
console.log(`Fusion P03 PASS (${r.cases.length} cases)`);
