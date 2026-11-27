import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  activateFusionCircle, assertNoPageErrors, createFusionPart, createFusionXYSketch,
  launchFusionBrowser, newFusionPage, savedFusionProject, saveFusionDocument,
} from './FusionBrowserHarness.mjs';

const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/').href;
const out = process.env.ASA_FUSION_CIRCLE_EVIDENCE_DIR ?? 'test-results/fusion-circle';
const expected = { center: [20, 10], diameter: 12, centerTolerance: 0.15, diameterTolerance: 0.001 };
const marker = 'FUS_P01_GEOMETRY_MISMATCH';
const report = { task: 'FUS/P01', status: 'RUNNING', stage: 'setup', url: home, expected, checks: [], pageErrors: [] };
let browser, page, failure;

function provenance() {
  try {
    const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const worktreeDirty = !!execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
    return { checkoutSha: worktreeDirty ? 'uncommitted' : gitHead, gitHead, worktreeDirty };
  } catch (error) {
    return { checkoutSha: 'UNKNOWN', gitHead: 'UNKNOWN', worktreeDirty: 'UNKNOWN', provenanceError: String(error.message) };
  }
}
const near = (actual, target, tolerance) => Number.isFinite(actual) && Math.abs(actual - target) <= tolerance;
function check(name, actual, target, pass) {
  report.checks.push({ name, actual, expected: target, status: pass ? 'PASS' : 'FAIL' });
}
async function screenPoint(world) {
  return page.locator('[data-testid="cad-sketch-interaction"][data-tool="circle"]').evaluate((svg, point) => {
    if (!(svg instanceof SVGSVGElement)) throw new Error('Circle interaction is not an SVG');
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('Circle interaction has no screen transform');
    const screen = new DOMPoint(point[0], -point[1]).matrixTransform(matrix);
    const hit = document.elementFromPoint(screen.x, screen.y);
    if (!hit || (hit !== svg && !svg.contains(hit))) throw new Error('Requested sketch point is covered by UI');
    return { x: screen.x, y: screen.y };
  }, world);
}
async function circleAttributes(testId) {
  const node = page.locator(`[data-testid="${testId}"]`);
  await node.waitFor();
  return node.evaluate((element) => ({
    center: [Number(element.getAttribute('cx')), -Number(element.getAttribute('cy'))],
    radius: Number(element.getAttribute('r')),
  }));
}
const shot = (name) => page.screenshot({ path: path.join(out, name) });

try {
  Object.assign(report, provenance());
  await mkdir(out, { recursive: true });
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(home).hostname), 'Use an isolated loopback test server');
  assert.ok(![8088, 8094, 8098, 8099].includes(Number(new URL(home).port)), 'Protected origin');
  browser = await launchFusionBrowser();
  report.browser = browser.version();
  const session = await newFusionPage(browser);
  page = session.page;
  report.pageErrors = session.errors;
  report.viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, visualScale: visualViewport?.scale }));
  assert.deepEqual(report.viewport, { width: 1920, height: 1080, dpr: 1, visualScale: 1 });
  await page.goto(home, { waitUntil: 'networkidle' });
  const projectId = await createFusionPart(page, 'Fusion Circle selected-center regression');
  const initial = await savedFusionProject(page, projectId);
  assert.equal(initial.document.kind, 'part');
  assert.equal(initial.document.sketches.length, 0, 'Fresh Part must contain no sketches');
  const sketchId = await createFusionXYSketch(page);
  await activateFusionCircle(page);
  const centerScreen = await screenPoint(expected.center);
  await page.mouse.click(centerScreen.x, centerScreen.y);
  await page.locator('[data-tool="circle"][data-circle-phase="awaiting-point"]').waitFor();
  const selected = await circleAttributes('sketch-circle-center');
  assert.ok(selected.center.every((v, i) => near(v, expected.center[i], expected.centerTolerance)),
    `SETUP: pointer selected ${JSON.stringify(selected.center)}, expected ${JSON.stringify(expected.center)}`);
  report.selectedCenter = selected.center;
  report.screenPoint = centerScreen;
  const hover = await screenPoint([34, 18]);
  await page.mouse.move(hover.x, hover.y);
  await page.locator('[data-testid="sketch-circle-ghost"]').waitFor();
  const panel = page.locator('.live-parameters[data-command="sketch.circle"]');
  const diameter = panel.getByLabel(/^Диаметр(?:, мм)?$/, { exact: true });
  await diameter.fill('18');
  await diameter.fill(String(expected.diameter));
  assert.equal(await diameter.inputValue(), '12');
  // Read after the browser's next paint; no fixed sleep or product projection helper.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.stage = 'preview';
  report.preview = await circleAttributes('sketch-circle-ghost');
  check('preview.center', report.preview.center, expected.center,
    report.preview.center.every((v, i) => near(v, expected.center[i], expected.centerTolerance)));
  check('preview.radius', report.preview.radius, 6, near(report.preview.radius, 6, expected.diameterTolerance / 2));
  await shot('01-selected-center-preview.png');
  await panel.locator('.live-commit').click();
  await panel.waitFor({ state: 'detached' });
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();
  report.stage = 'saved-intent';
  const saved = await saveFusionDocument(page, projectId);
  const doc = saved.document;
  assert.equal(saved.launcherMode, 'fusion');
  assert.equal(doc.kind, 'part');
  assert.equal(doc.sketches.length, 1);
  assert.equal(doc.sketches[0].id, sketchId);
  assert.equal(doc.sketches[0].support, 'XY');
  const entities = doc.sketches[0].entities;
  assert.equal(entities.length, 1, 'Exactly one committed entity is required');
  assert.equal(entities[0].type, 'circle');
  const circle = entities[0];
  report.saved = { projectId, documentId: doc.documentId, sketchId, circle, dimensions: doc.dimensions, constraints: doc.constraints, features: doc.features };
  check('saved.center', circle.data.center, expected.center,
    circle.data.center.every((v, i) => near(v, expected.center[i], expected.centerTolerance)));
  check('saved.diameter', circle.data.diameter, expected.diameter,
    near(circle.data.diameter, expected.diameter, expected.diameterTolerance));
  check('saved.drivingDimensions', doc.dimensions.length, 0, doc.dimensions.length === 0);
  assert.deepEqual(doc.features, [], 'Circle must not add Part features');
  assertNoPageErrors(session.errors, 'P01 ordinary Fusion Circle');
  await shot('02-saved-circle.png');
  const mismatches = report.checks.filter((item) => item.status === 'FAIL');
  if (mismatches.length) {
    const error = new Error(`${marker}: ${mismatches.map((item) => `${item.name}=${JSON.stringify(item.actual)}`).join('; ')}`);
    error.code = marker;
    throw error;
  }
  report.status = 'PASS';
} catch (error) {
  failure = error;
  report.status = 'FAIL';
  report.failureKind = error.code === marker ? marker : 'SETUP_OR_RUNTIME_ERROR';
  report.error = String(error.stack ?? error);
  if (page) {
    try { await shot('failure.png'); }
    catch (captureError) { report.screenshotError = String(captureError.message); }
  } else report.screenshot = 'NOT_CAPTURED: browser/page startup failed';
} finally {
  try { await browser?.close(); }
  catch (error) { failure ??= error; report.status = 'FAIL'; report.cleanupError = String(error.message); }
  try { await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
  catch (error) { failure ??= error; console.error(`Mandatory P01 report could not be written: ${error.message}`); }
}
if (failure) throw failure;
console.log('ASA-CAD Fusion P01 PASS: selected center, numeric preview and saved Circle agree');
