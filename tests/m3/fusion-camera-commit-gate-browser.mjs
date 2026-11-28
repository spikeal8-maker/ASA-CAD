import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  activateFusionCircle, assertNoPageErrors, createFusionPart, createFusionXYSketch,
  launchFusionBrowser, newFusionPage, saveFusionDocument,
} from './FusionBrowserHarness.mjs';

// A05 v2: camera gate blocks mutation commits; aligned camera gives exact geometry.
const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/').href;
const out = process.env.ASA_FUSION_COMMIT_GATE_DIR ?? 'test-results/fus-a05-commit-gate';
const STAGE = '[data-testid="part-model-stage"]';
const CIRC = '.live-parameters[data-command="sketch.circle"]';
const LINPUT = '[data-testid="fusion-line-dynamic-input"]';
const r = { task: 'FUS/A05 v2', status: 'RUNNING', url: home, cases: [] };
let browser, page, failure, projectId, errors = [];
const git = a => execFileSync('git', a, { encoding: 'utf8' }).trim();
const cam = () => page.locator(STAGE).getAttribute('data-camera');
const waitCam = s => page.waitForFunction(([st, x]) => (document.querySelector(st)?.dataset.camera ?? '').endsWith(x), [STAGE, s], { timeout: 30_000 });
const ent = async () => Number(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'));
const hist = async () => ({ undo: !(await page.locator('.live-quickbuttons [data-command-id="system.undo"]').isDisabled()), redo: !(await page.locator('.live-quickbuttons [data-command-id="system.redo"]').isDisabled()) });
const oracle = async () => ({ ent: await ent(), active: await page.locator('.live-workarea').getAttribute('data-active-command'), hist: await hist() });
const notice = async () => (await page.locator('.live-status').textContent() ?? '');
const pt = async xy => page.evaluate(([x, y]) => { const p = new DOMPoint(x, -y).matrixTransform(document.querySelector('[data-sketch-layer="grid"]').firstElementChild.getScreenCTM()); return [p.x, p.y]; }, xy);
const step = async (name, run) => { const it = { name, status: 'RUNNING' }; r.cases.push(it); try { await run(it); assertNoPageErrors(errors, name); it.status = 'PASS'; } catch (e) { it.status = 'FAIL'; it.error = String(e.message); throw e; } };
try {
  await mkdir(out, { recursive: true });
  r.checkout = git(['rev-parse', 'HEAD']) + (git(['status', '--porcelain=v1']) ? '+dirty' : '');
  browser = await launchFusionBrowser(); r.browser = browser.version();
  ({ page, errors } = await newFusionPage(browser));
  await page.goto(home);
  projectId = await createFusionPart(page, 'A05 v2');
  await createFusionXYSketch(page);
  await waitCam(':aligned');
  const panel = page.locator(CIRC);
  const diameter = () => panel.getByLabel(/Диаметр/);
  const draft = async () => { await activateFusionCircle(page); await page.mouse.click(...(await pt([20, 10]))); await diameter().fill('40'); };
  const gate = async () => { await page.locator('.live-navigation button[aria-label="Приблизить"]').click(); await waitCam(':gated'); };
  const recover = async () => { await page.locator('[data-palette-command="sketch.finish"]').click(); await page.locator('.live-workarea[data-workspace="solid"]').waitFor(); await page.locator('.live-timeline button[data-timeline-sketch]').last().click(); await waitCam(':aligned'); };
  const alive = async () => (await panel.count()) > 0 && (await diameter().inputValue()) === '40' && (await ent()) === 0;
  const esc = async () => { await page.locator('.cad-app').focus(); await page.keyboard.press('Escape'); };
  const lineStart = async () => { await page.locator('.live-sketch-ribbon [data-command-id="sketch.line"]').click(); await page.locator(STAGE + '[data-line-solver-ready="true"]').waitFor({ timeout: 30_000 }); await page.mouse.click(...(await pt([0, 0]))); await page.locator(LINPUT + '[data-line-phase="PREVIEW_SEGMENT"]').waitFor({ timeout: 10_000 }); };
  await step('Gated: 4 commit paths rejected; draft+history intact', async () => {
    await draft();
    const base = await oracle();
    await gate();
    for (const [label, run] of [
      ['numeric Enter', async () => { await diameter().press('Enter'); }],
      ['root Enter', async () => { await page.locator('.cad-app').focus(); await page.keyboard.press('Enter'); }],
      ['panel OK', async () => { await page.locator(CIRC).locator('.live-commit').click(); }],
      ['marking OK', async () => { await page.locator('.live-scene').click({ button: 'right' }); await page.locator('.live-context .marking-list button').first().click(); }]]) {
      await run(); await page.waitForTimeout(300);
      assert.match(await notice(), /Камера не готова/, label);
      assert.deepEqual(await oracle(), base, label);
      assert.ok(await alive(), label);
    }
  });
  await step('Gated: Esc+Cancel; nav usable; re-enter recovers', async () => {
    const base = await oracle();
    await esc();
    assert.equal(await ent(), 0, 'escape');
    await page.locator(CIRC).getByRole('button', { name: 'Отмена' }).click();
    await page.waitForFunction((c) => !document.querySelector(c), CIRC);
    assert.deepEqual(await oracle(), { ...base, active: '' }, 'cancel');
    await page.locator('.live-navigation button[aria-label="Показать всё"]').click();
    assert.match(await cam(), /^ready:\d+:(aligned|gated)$/, 'nav ready');
    await recover();
    assert.ok((await cam()).endsWith(':aligned'), 'recovery');
  });
  await step('Aligned: Circle (20,10) d40 exact', async () => {
    await draft();
    await diameter().press('Enter');
    await panel.waitFor({ state: 'detached' });
    assert.equal(await ent(), 1);
    const en = (await saveFusionDocument(page, projectId)).document.sketches.find(s => s.support === 'XY').entities[0];
    assert.equal(en.type, 'circle');
    assert.ok(Math.abs(en.data.center[0] - 20) <= 0.15 && Math.abs(en.data.center[1] - 10) <= 0.15, 'center');
    assert.ok(Math.abs(en.data.diameter - 40) <= 0.01, 'diameter');
  });
  await step('Gated: Line click blocked; draft+history intact', async () => {
    await lineStart();
    const base = await oracle();
    await gate();
    await page.mouse.click(...(await pt([30, 0])));
    await page.waitForTimeout(400);
    assert.equal(await ent(), 1, 'no geometry');
    assert.equal(await page.locator(LINPUT).getAttribute('data-line-phase'), 'PREVIEW_SEGMENT', 'draft kept');
    assert.equal(await page.locator('[data-testid="cad-sketch-interaction"]').getAttribute('data-presentation-gated'), 'true', 'surface gated');
    assert.deepEqual(await hist(), base.hist, 'history');
  });
  await step('Aligned Line exact; Undo/Redo roundtrip', async () => {
    await esc();
    await recover();
    await lineStart();
    await page.mouse.click(...(await pt([30, 0])));
    await page.waitForFunction(() => (document.querySelector('[data-testid="cad-sketch-overlay"]')?.dataset.entityCount ?? 0) >= 2, null, { timeout: 30_000 });
    await esc();
    const before = (await saveFusionDocument(page, projectId)).document.sketches;
    const line = before.find(s => s.support === 'XY').entities.find(e => e.type === 'line');
    const near = (a, b) => Math.abs(a - b) <= 0.15;
    assert.ok(near(line.data.from[0], 0) && near(line.data.from[1], 0) && near(line.data.to[0], 30) && near(line.data.to[1], 0), 'line');
    await page.locator('.live-quickbuttons [data-command-id="system.undo"]').click();
    await page.waitForTimeout(400);
    assert.notDeepEqual((await saveFusionDocument(page, projectId)).document.sketches, before, 'undo changed');
    await page.locator('.live-quickbuttons [data-command-id="system.redo"]').click();
    await page.waitForTimeout(400);
    assert.deepEqual((await saveFusionDocument(page, projectId)).document.sketches, before, 'roundtrip');
  });
  r.status = 'PASS';
} catch (e) {
  failure = e; r.status = 'FAIL'; r.error = String(e);
  if (page) try { await page.screenshot({ path: out + '/f.png' }); } catch { }
} finally {
  r.pageErrors = errors;
  try { await browser?.close(); } catch { }
  await writeFile(out + '/report.json', JSON.stringify(r, null, 2) + '\n');
}
if (failure) throw failure;
console.log('A05 v2 commit gate PASS');
