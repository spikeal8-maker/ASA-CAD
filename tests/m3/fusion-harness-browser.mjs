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

// Provenance: the actual checked-out Git HEAD plus an explicit clean/uncommitted state.
// Ignored evidence/build files do not mark the tree dirty; new untracked source files do.
// No environment value (for example GIT_SHA) may substitute for the real checkout.
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const headSha = (() => { try { return git(['rev-parse', 'HEAD']); } catch { return null; } })();
const dirtyEntries = (() => {
  try { return git(['status', '--porcelain']).split('\n').map((line) => line.trim()).filter(Boolean); }
  catch { return null; }
})();
const report = {
  task: 'FUS/T01',
  checkout: {
    sha: headSha,
    state: headSha ? (dirtyEntries && dirtyEntries.length > 0 ? 'uncommitted' : 'clean') : 'unknown',
    dirtyEntries,
  },
  url: home,
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, browserZoom: '100%' },
  status: 'RUNNING', cases: [], pageErrors: [], failedRequests: [],
};
let browser = null;
let page = null;
let pageErrors = [];
async function step(name, run) {
  const result = { name, status: 'RUNNING' };
  report.cases.push(result);
  try { await run(); result.status = 'PASS'; }
  catch (error) { result.status = 'FAIL'; result.error = String(error.message ?? error); throw error; }
}
let dialog, projectId, sketchId;
let runError = null;
try {
  browser = await launchFusionBrowser();
  report.browser = browser.version();
  const started = await newFusionPage(browser);
  page = started.page;
  pageErrors = started.errors;
  report.pageErrors = pageErrors;
  page.on('requestfailed', (request) => report.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  const shot = (name) => page.screenshot({ path: path.join(evidenceDir, name) });
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
    assertNoPageErrors(pageErrors, 'T01 Fusion harness smoke');
  });
  report.status = 'PASS';
} catch (error) {
  runError = error;
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  if (page) await page.screenshot({ path: path.join(evidenceDir, 'failure.png') }).catch(() => {});
}

let writeError = null;
try {
  await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  writeError = error;
  report.reportWriteError = String(error.message ?? writeError);
}
if (browser) await browser.close().catch(() => {});
if (writeError && runError) console.error(String(runError.stack ?? runError));
if (writeError) {
  console.error(`ASA-CAD Fusion T01 harness: report.json write failed: ${String(writeError.message ?? writeError)}`);
  throw writeError;
}
if (runError) throw runError;
console.log(`ASA-CAD Fusion T01 harness PASS (${report.cases.length} scenarios)`);
