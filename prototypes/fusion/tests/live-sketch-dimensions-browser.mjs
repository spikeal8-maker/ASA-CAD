import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { entity, idle, near, quick, reopen, save, solved, stage, startSketch, tool } from './live-sketch-actions-harness.mjs';
import { captureNativeDimensionComparison } from './live-sketch-dimension-native-evidence.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.env.ASA_FUSION_EVIDENCE_DIR || resolve(repo, 'prototypes/fusion/evidence'));
const digest = value => createHash('sha256').update(value).digest('hex');
const ownedServers = [];
async function serve(appRoot) {
  const child = spawn(process.execPath, [resolve(repo, 'prototypes/fusion/live/serve.cjs'), '--root', appRoot, '--port', '0'],
    { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  ownedServers.push(child);
  return new Promise((resolveUrl, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('Owned test server did not become ready: ' + text)), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Owned test server exited before ready: ' + code + ' ' + text)); });
    child.stdout.on('data', bytes => {
      text += bytes;
      const match = text.match(/ASA CAD Fusion: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) { clearTimeout(timer); resolveUrl(match[1]); }
    });
    child.stderr.on('data', bytes => { text += bytes; });
  });
}
async function plate(page) {
  await tool(page, 'sketch.rectangle').click();
  await page.getByLabel('Ширина', { exact: true }).fill('60');
  await page.getByLabel('Высота', { exact: true }).fill('40');
  await page.locator('.live-parameters .live-commit').click();
  await solved(page, 4); await idle(page);
  await tool(page, 'sketch.circle').click();
  await page.getByLabel('Диаметр', { exact: true }).fill('12');
  await page.locator('.live-parameters .live-commit').click();
  await solved(page, 5); await idle(page);
  await page.mouse.move(1640, 190);
}
async function screenshot(page, name) {
  const file = 'fusion-live-sketch-dimensions-' + name + '.png';
  await page.screenshot({ path: resolve(out, file) });
  report.screenshots.push({ file, sha256: digest(await readFile(resolve(out, file))) });
}
async function annotations(page, dimensions) {
  return page.locator('[data-sketch-layer="dimensions"]').evaluate((root, dimensions) => dimensions.map(dimension => {
    const group = root.querySelector('[data-sketch-dimension-id="' + dimension.id + '"]');
    if (!group) throw new Error('Missing dimension ' + dimension.id);
    const text = group.querySelector('text'), line = group.querySelector('[data-dimension-line]');
    const matrix = text.getScreenCTM(), scale = Math.hypot(matrix.a, matrix.b);
    const point = (matrix, x, y) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return [p.x, p.y]; };
    const arrows = [...group.querySelectorAll('[data-dimension-arrow]')].map(node => {
      const m = node.getScreenCTM();
      return [...node.points].map(p => ({ local: [p.x, p.y], screen: point(m, p.x, p.y) }));
    });
    const lines = [...group.querySelectorAll('[data-dimension-extension]')].map(node =>
      ['x1', 'y1', 'x2', 'y2'].map(name => Number(node.getAttribute(name))));
    return { id: dimension.id, value: Number(group.getAttribute('data-dimension-value')),
      presentation: group.getAttribute('data-dimension-presentation'),
      visibleText: [...text.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(''),
      fontCssPx: parseFloat(getComputedStyle(text).fontSize) * scale,
      color: getComputedStyle(text).fill,
      line: line ? ['x1', 'y1', 'x2', 'y2'].map(name => Number(line.getAttribute(name))) : null,
      vectorEffect: line?.getAttribute('vector-effect'), arrows, extensions: lines };
  }), dimensions);
}
function validateAnnotations(values, width) {
  const lengths = values.filter(value => value.presentation === 'linear');
  assert.equal(lengths.length, 2, 'Both persisted line dimensions have actual witness geometry');
  for (const annotation of lengths) {
    assert.equal(annotation.extensions.length, 2);
    assert.equal(annotation.arrows.length, 2);
    assert.equal(annotation.vectorEffect, 'non-scaling-stroke');
    assert.equal(annotation.visibleText, annotation.value.toFixed(2));
    near(annotation.fontCssPx, 16, 'Dimension font stays sixteen CSS pixels', .001);
    assert.equal(annotation.color, 'rgb(0, 0, 0)');
    const [a, b] = annotation.arrows.map(points => points[0].local);
    near(Math.hypot(a[0] - b[0], a[1] - b[1]), annotation.value,
      'Arrow tips span the real solved line length', .001);
    for (const points of annotation.arrows) {
      const [tip, baseA, baseB] = points.map(point => point.screen);
      near(Math.hypot(baseA[0] - baseB[0], baseA[1] - baseB[1]), 5, 'Arrow width stays five CSS pixels', .001);
      near(Math.hypot(tip[0] - (baseA[0] + baseB[0]) / 2, tip[1] - (baseA[1] + baseB[1]) / 2),
        9, 'Arrow length stays nine CSS pixels', .001);
    }
  }
  assert.deepEqual(lengths.map(value => value.value).sort((a, b) => a - b), [40, width]);
  const diameter = values.find(value => value.presentation === 'diameter');
  assert.ok(diameter); assert.equal(diameter.visibleText, 'Ø12.00');
  near(diameter.fontCssPx, 16, 'Existing diameter presentation remains screen sized', .001);
}

const report = { status: 'RUNNING', schemaVersion: 1, input: 'Public pointer/keyboard UI; document reads only for assertions',
  sourceSnapshotSha256: process.env.ASA_FUSION_SOURCE_SNAPSHOT || null,
  testSourceSha256: digest(await readFile(fileURLToPath(import.meta.url))),
  isolatedBrowserContext: true, installedOriginTouched: false, visualParityAccepted: false,
  screenshots: [], viewportChecks: [], sourceFiles: {}, servers: [] };
for (const path of ['live/LiveSketchStage.tsx', 'live/SketchDimensionAnnotations.tsx', 'live/sketchDimensionLayout.ts',
  'tests/live-sketch-actions-harness.mjs', 'tests/live-sketch-dimension-native-evidence.mjs']) {
  report.sourceFiles[path] = digest(await readFile(resolve(repo, 'prototypes/fusion', path)));
}
let browser = null, page = null, errors = [], phase = 'start-owned-servers';
await mkdir(out, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE });
  if (process.env.ASA_FUSION_DIMENSION_BASELINE_APP) {
    const baselineUrl = await serve(resolve(process.env.ASA_FUSION_DIMENSION_BASELINE_APP));
    report.servers.push({ role: 'baseline', url: baselineUrl });
    report.baselineHealth = await (await fetch(baselineUrl + '__asa_health')).json();
    const baseline = await startSketch(browser, baselineUrl);
    await plate(baseline.page); await save(baseline.page); await screenshot(baseline.page, 'before-2048');
    assert.deepEqual(baseline.errors, []);
    await baseline.page.close();
  }
  const url = await serve(resolve(repo, 'dist/fusion-live'));
  report.servers.push({ role: 'candidate', url });
  phase = 'paired-native-dimension-capture';
  report.nativeComparison = await captureNativeDimensionComparison(browser, url, screenshot);
  ({ page, errors } = await startSketch(browser, url));
  phase = 'numeric-rectangle-and-circle';
  await plate(page);
  let document = await save(page);
  const width = document.dimensions.find(dimension => dimension.name === 'width');
  assert.ok(width); assert.equal(width.value, 60);
  validateAnnotations(await annotations(page, document.dimensions), 60);
  await screenshot(page, 'after-2048');

  phase = 'dimension-label-edit-cancel';
  const label = page.locator('[data-sketch-dimension-id="' + width.id + '"] text');
  await label.dblclick(); await page.getByLabel('Значение', { exact: true }).fill('80');
  await page.getByLabel('Значение', { exact: true }).press('Escape'); await idle(page);
  assert.deepEqual(await save(page), document, 'Cancel leaves every document field unchanged');

  phase = 'dimension-label-edit-and-history';
  await label.dblclick(); await page.getByLabel('Значение', { exact: true }).fill('80');
  await page.getByLabel('Значение', { exact: true }).press('Enter'); await idle(page);
  await page.waitForSelector('[data-sketch-dimension-id="' + width.id + '"][data-dimension-value="80"]');
  document = await save(page);
  validateAnnotations(await annotations(page, document.dimensions), 80);
  const edge = entity(page, width.entityIds[0]);
  const actualWidth = await edge.evaluate(node => Math.abs(Number(node.getAttribute('x2')) - Number(node.getAttribute('x1'))));
  near(actualWidth, 80, 'The existing solver, not the annotation, changes the real rectangle width');
  await quick(page, 'system.undo').click();
  await page.waitForSelector('[data-sketch-dimension-id="' + width.id + '"][data-dimension-value="60"]');
  validateAnnotations(await annotations(page, (await save(page)).dimensions), 60);
  await quick(page, 'system.redo').click();
  await page.waitForSelector('[data-sketch-dimension-id="' + width.id + '"][data-dimension-value="80"]');
  assert.deepEqual(await save(page), document, 'Redo restores the same real document and dimension IDs');
  report.edit = { cancelPreservesDocument: true, governingValueChanged: [60, 80], solvedWidth: actualWidth,
    sameDimensionId: width.id, undoRedoPreservesDocument: true };

  phase = 'view-scale-and-resize';
  const span = Number(await stage(page).getAttribute('data-sketch-view-span'));
  const bounds = await stage(page).boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.wheel(0, -150);
  await page.waitForFunction(span => Number(document.querySelector('[data-testid="part-model-stage"]')
    ?.getAttribute('data-sketch-view-span')) < span, span);
  for (const [width, height] of [[2048, 1137], [1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => {
      const stage = document.querySelector('[data-testid="part-model-stage"]'), svg = stage?.querySelector('[data-sketch-layer="dimensions"]');
      if (!stage || !svg) return false;
      const box = stage.getBoundingClientRect(), frame = svg.viewBox.baseVal;
      return Math.abs(frame.width / frame.height - box.width / box.height) < 1e-6;
    });
    const values = await annotations(page, document.dimensions);
    validateAnnotations(values, 80);
    assert.equal(await page.evaluate(() => devicePixelRatio), 1);
    report.viewportChecks.push({ viewport: { width, height, dpr: 1 }, annotations: values });
    await screenshot(page, 'zoomed-' + width);
  }
  assert.deepEqual(await save(page), document, 'Zoom and viewport size never mutate CAD intent');

  phase = 'reopen-and-display-toggle';
  await reopen(page, 5);
  assert.deepEqual(await save(page), document, 'Save/Open retains the existing document schema and all IDs');
  validateAnnotations(await annotations(page, document.dimensions), 80);
  await page.locator('[data-sketch-option="dimensions"]').uncheck();
  assert.equal(await page.locator('[data-sketch-layer="dimensions"]').count(), 0);
  await page.locator('[data-sketch-option="dimensions"]').check();
  validateAnnotations(await annotations(page, document.dimensions), 80);
  assert.deepEqual(await save(page), document, 'Dimension visibility never changes the document');
  assert.deepEqual(errors, []);
  Object.assign(report, { status: 'PASS', saveOpenPreservesDocument: true, displayChangesPreserveDocument: true,
    nativeReference: 'fusion-parity-native-linear-dimensions-2048-dpi110.png',
    placement: 'Automatic 54 CSS px offset; shared document has no persisted annotation position', pageErrors: errors });
} catch (error) {
  Object.assign(report, { status: 'FAIL', phase, error: error.message, pageErrors: errors });
  if (page) await screenshot(page, 'debug').catch(() => {});
  console.error('PHASE', phase, error.stack); process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of ownedServers) if (child.pid && child.exitCode === null && child.signalCode === null) {
    const done = new Promise(resolveExit => child.once('exit', resolveExit));
    child.kill('SIGTERM'); await done;
  }
  report.ownedServersClosed = ownedServers.every(child => child.exitCode !== null || child.signalCode !== null);
  await writeFile(resolve(out, 'fusion-live-sketch-dimensions-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, phase: report.phase, error: report.error,
    sourceSnapshotSha256: report.sourceSnapshotSha256, testSourceSha256: report.testSourceSha256,
    viewportChecks: report.viewportChecks.length, screenshots: report.screenshots,
    ownedServersClosed: report.ownedServersClosed, pageErrors: report.pageErrors }, null, 2));
}
