import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  activateFusionCircle, assertNoPageErrors, cancelFusionCircle, createFusionXYSketch,
  fusionReadonlySnapshot, launchFusionBrowser, newFusionPage, openFusionCreateDialog,
  savedFusionProject, saveFusionDocument, submitFusionCreate,
} from './FusionBrowserHarness.mjs';

const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').href;
assert.ok(![8094, 8098, 8099].includes(Number(new URL(home).port)), 'isolated origin required');
const evidenceDir = process.env.ASA_FUSION_EVIDENCE_DIR ?? 'test-results/fusion-t01';
await mkdir(evidenceDir, { recursive: true });
const checkoutSha = () => process.env.GIT_SHA
  ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'uncommitted'; } })();
const report = {
  task: 'FUS/T01',
  checkoutSha: checkoutSha(),
  url: home,
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, browserZoom: '100%' },
  status: 'RUNNING', cases: [], pageErrors: [], failedRequests: [],
};
const browser = await launchFusionBrowser();
report.browser = browser.version();
const { page, errors } = await newFusionPage(browser);
report.pageErrors = errors;
page.on('requestfailed', (request) => report.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
const shot = (name) => page.screenshot({ path: path.join(evidenceDir, name) });
async function step(name, run) {
  const result = { name, status: 'RUNNING' };
  report.cases.push(result);
  try { await run(); result.status = 'PASS'; }
  catch (error) { result.status = 'FAIL'; result.error = String(error.message ?? error); throw error; }
}
let dialog, projectId, sketchId;
try {
  await step('Error guard: empty and whitespace names block Fusion create before editor handoff', async () => {
    await page.goto(home, { waitUntil: 'networkidle' });
    dialog = await openFusionCreateDialog(page);
    const nameField = dialog.getByRole('textbox', { name: 'Название проекта', exact: true });
    const submit = dialog.getByRole('button', { name: 'Создать и открыть', exact: true });
    for (const invalid of ['', '   ']) {
      await nameField.fill(invalid);
      assert.equal(await submit.isEnabled(), false, `name "${invalid}" must not create a project`);
      assert.equal(new URL(page.url()).pathname, '/', 'invalid name must not hand off to the editor');
    }
  });
  await step('Positive: fresh Fusion Part, empty XY sketch, CircleCenterRadius activated then cancelled', async () => {
    projectId = await submitFusionCreate(page, dialog, 'T01 Fusion harness smoke');
    const initial = await savedFusionProject(page, projectId);
    assert.equal(initial.document.kind, 'part', 'fresh Fusion project must be a Part');
    assert.equal(initial.document.sketches.length, 0, 'fresh Fusion Part starts without sketches');
    sketchId = await createFusionXYSketch(page);
    await shot('02-empty-xy-sketch.png');
    await activateFusionCircle(page);
    await shot('03-circle-active.png');
  });
  await step('Cancel + save: cancelled Circle adds no geometry; one empty XY sketch is saved', async () => {
    await cancelFusionCircle(page);
    assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), sketchId, 'cancel must keep the same active sketch');
    await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
    const saved = await saveFusionDocument(page, projectId);
    assert.equal(saved.launcherMode, 'fusion');
    assert.equal(saved.document.kind, 'part');
    assert.ok(saved.document.documentId, 'saved document id must be real');
    assert.equal(saved.document.sketches.length, 1, 'saved intent must contain exactly one sketch');
    assert.equal(saved.document.sketches[0].id, sketchId, 'saved sketch id must match the active sketch');
    assert.equal(saved.document.sketches[0].support, 'XY');
    assert.equal(saved.document.sketches[0].entities.length, 0, 'cancelled Circle must not add geometry');
    assert.deepEqual(saved.document.features, [], 'cancelled Circle must not add features');
    report.snapshot = await fusionReadonlySnapshot(page, { projectId, sketchId, documentId: saved.document.documentId });
    assertNoPageErrors(errors, 'T01 Fusion harness smoke');
  });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  await shot('failure.png').catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    .catch((error) => { report.error = String(error); });
  await browser.close().catch(() => {});
}
console.log(`ASA-CAD Fusion T01 harness PASS (${report.cases.length} scenarios)`);
