import assert from 'node:assert/strict';
import { chromium } from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../evidence');
const browser = await chromium.launch({ headless: true, executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 2048, height: 1137 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(20000);
const tool = id => page.locator('.live-tool[data-command-id="' + id + '"]');
const quick = id => page.locator('.live-quickbar [data-command-id="' + id + '"]');
const stage = () => page.locator('[data-testid="part-model-stage"]');
const count = async value => page.waitForFunction(value =>
  document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count') === String(value), value);
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} != ${expected} (+/- ${tolerance})`);
const pointNear = (actual, expected, label) => actual.forEach((value, index) => near(value, expected[index], .02, label));

async function waitForFullFrame() {
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="part-model-stage"]');
    const svg = stage?.querySelector('[data-testid="cad-sketch-overlay"]');
    if (!stage || !svg) return false;
    const rect = stage.getBoundingClientRect(), box = svg.viewBox.baseVal;
    return rect.width > 0 && rect.height > 0 && Math.abs(box.width / box.height - rect.width / rect.height) < 1e-7;
  });
}
async function pixel(world) {
  const svg = page.locator('[data-testid="cad-sketch-selection-layer"]');
  const rect = await svg.boundingBox(), frame = (await svg.getAttribute('viewBox')).split(/\s+/).map(Number);
  const scale = Math.min(rect.width / frame[2], rect.height / frame[3]);
  return { x: rect.x + (rect.width - frame[2] * scale) / 2 + (world[0] - frame[0]) * scale,
    y: rect.y + (rect.height - frame[3] * scale) / 2 + (-world[1] - frame[1]) * scale };
}
async function clickSide(world, side) {
  const point = await pixel(world), rect = await stage().boundingBox();
  const shortEdge = Math.min(rect.width, rect.height);
  const oldLeft = rect.x + (rect.width - shortEdge) / 2, oldRight = oldLeft + shortEdge;
  assert.ok(side === 'left' ? point.x < oldLeft - 2 : point.x > oldRight + 2,
    'The pointer must be outside the previous square');
  assert.equal(await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    return !!target?.closest('[data-testid="part-model-stage"]');
  }, point), true, 'The pointer must be over the field, not behind the browser tree or palette');
  await page.mouse.click(point.x, point.y);
  return { world, pixel: point, side };
}
async function save() {
  const canonicalKey = 'asa-cad-m2-shell-document:state', mirrorKey = 'asa-cad-m2-shell-document';
  const before = await page.evaluate(key => localStorage.getItem(key), canonicalKey);
  await quick('system.save').click();
  await page.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before, { key: canonicalKey, before });
  await page.waitForFunction(() => document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
  const saved = await page.evaluate(({ canonicalKey, mirrorKey }) => ({
    canonical: localStorage.getItem(canonicalKey), mirror: localStorage.getItem(mirrorKey),
  }), { canonicalKey, mirrorKey });
  assert.ok(saved.canonical && saved.mirror, 'UI Save must populate canonical and mirror document keys');
  const envelope = JSON.parse(saved.canonical);
  assert.ok(Number.isSafeInteger(envelope.revision) && envelope.revision > 0, 'UI Save must persist a revision');
  assert.equal(envelope.serializedDocument, saved.mirror, 'UI Save canonical and mirror bytes must agree');
  return JSON.parse(saved.mirror);
}
async function circleBox(id) {
  return page.locator('[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id="' + id + '"]').evaluate(element => {
    const rect = element.getBoundingClientRect(), matrix = element.getScreenCTM();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      center: [rect.x + rect.width / 2, rect.y + rect.height / 2],
      scaleX: Math.hypot(matrix.a, matrix.b), scaleY: Math.hypot(matrix.c, matrix.d) };
  });
}
async function fieldSnapshot() {
  return stage().evaluate(element => {
    const rect = element.getBoundingClientRect();
    const svg = element.querySelector('[data-testid="cad-sketch-overlay"]');
    const box = svg.viewBox.baseVal;
    const layers = [...element.querySelectorAll('svg[data-sketch-layer], svg[data-testid="cad-sketch-overlay"], svg[data-testid="cad-sketch-selection-layer"]')];
    const lines = [...element.querySelectorAll('[data-sketch-layer="grid"] g line')];
    const vertical = lines.find(line => line.getAttribute('x1') === line.getAttribute('x2')).getBoundingClientRect();
    const horizontal = lines.find(line => line.getAttribute('y1') === line.getAttribute('y2')).getBoundingClientRect();
    const xLines = lines.filter(line => line.getAttribute('data-grid-axis') === 'x');
    const majorLines = xLines.filter(line => line.getAttribute('data-grid-kind') === 'major');
    const origin = element.querySelector('[data-sketch-origin-ring]'), originBox = origin.getBoundingClientRect();
    const cubeFace = document.querySelector('[data-sketch-cube-face]'), cubeBox = cubeFace.getBoundingClientRect();
    const cube = document.querySelector('.live-sketch-cube');
    return { stage: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      frame: { x: box.x, y: box.y, width: box.width, height: box.height },
      span: Number(element.getAttribute('data-sketch-view-span')),
      layerFrames: layers.map(layer => layer.getAttribute('viewBox')),
      background: getComputedStyle(element).backgroundColor,
      grid: { left: horizontal.left, right: horizontal.right, top: vertical.top, bottom: vertical.bottom,
        minorStep: Number(element.getAttribute('data-sketch-grid-step')),
        minorPitch: xLines[1].getBoundingClientRect().x - xLines[0].getBoundingClientRect().x,
        majorPitch: majorLines[1].getBoundingClientRect().x - majorLines[0].getBoundingClientRect().x,
        minorColor: getComputedStyle(xLines.find(line => line.getAttribute('data-grid-kind') === 'minor')).stroke,
        majorColor: getComputedStyle(majorLines[0]).stroke,
        xAxisColor: getComputedStyle(element.querySelector('[data-sketch-axis="x"]')).stroke,
        yAxisColor: getComputedStyle(element.querySelector('[data-sketch-axis="y"]')).stroke,
        labels: [...element.querySelectorAll('[data-grid-label-axis]')].map(label => ({
          axis: label.getAttribute('data-grid-label-axis'), value: Number(label.getAttribute('data-grid-label-value')), text: label.textContent,
        })) },
      origin: { x: originBox.x + originBox.width / 2, y: originBox.y + originBox.height / 2,
        outerDiameter: originBox.width + Number.parseFloat(getComputedStyle(origin).strokeWidth) },
      cube: { x: cubeBox.x, y: cubeBox.y, width: cubeBox.width, height: cubeBox.height,
        face: cube.querySelector('.live-sketch-plane-face text').textContent, worldUp: cube.getAttribute('data-world-up'),
        mode: cube.getAttribute('data-sketch-mode') } };
  });
}

const report = { status: 'RUNNING', input: 'Real pointer/keyboard actions; saved document is read only for assertions',
  isolatedBrowserContext: true, sourceSnapshotSha256: process.env.ASA_FUSION_SOURCE_SNAPSHOT || null,
  testSourceSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),
  nativeVisualParity: 'NOT_ASSERTED', screenshots: [], screenChecks: [] };
let phase = 'create-sketch';
try {
  await page.goto(process.env.ASA_FUSION_URL || 'http://127.0.0.1:8099/');
  await tool('part.sketch.create').click();
  await page.getByLabel('Плоскость эскиза', { exact: true }).selectOption('XY');
  await page.locator('.live-commit').click();
  await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
  await count(0); await waitForFullFrame();
  phase = 'native-reference-field-details';
  const empty = await fieldSnapshot();
  assert.equal(empty.background, 'rgb(255, 255, 255)');
  assert.equal(empty.grid.minorColor, 'rgb(233, 233, 233)');
  assert.equal(empty.grid.majorColor, 'rgb(213, 213, 213)');
  assert.equal(empty.grid.xAxisColor, 'rgb(255, 107, 107)');
  assert.equal(empty.grid.yAxisColor, 'rgb(56, 215, 68)');
  near(empty.origin.x, empty.stage.x + empty.stage.width / 2, .2, 'Origin follows the real frame X center');
  near(empty.origin.y, empty.stage.y + empty.stage.height / 2, .2, 'Origin follows the real frame Y center');
  near(empty.origin.outerDiameter, 24, .2, 'Native origin ring has a twelve-pixel outer radius');
  near(empty.cube.width, 70, .2, 'Native plane face width'); near(empty.cube.height, 70, .2, 'Native plane face height');
  near(empty.cube.x + empty.cube.width, empty.stage.x + empty.stage.width - 50, .2, 'Native plane face right offset');
  near(empty.cube.y, empty.stage.y + 50, .2, 'Native plane face top offset');
  assert.equal(empty.cube.mode, 'plane-locked'); assert.equal(empty.cube.worldUp, 'Z');
  assert.equal(empty.cube.face, 'СВЕРХУ', 'XY keeps the existing Z-up model orientation');
  const emptyFilename = 'fusion-live-sketch-field-empty-2048.png';
  await page.screenshot({ path: resolve(out, emptyFilename) }); report.screenshots.push(emptyFilename);
  report.emptyField = empty;
  report.reference = { image: 'fusion-parity-native-sketch-empty-2048-dpi110.png',
    nativeMinorPitchCssPx: 26.7, nativeMajorPitchCssPx: 133.6,
    cameraDifference: 'Existing span 100 is retained; ticks use actual model units, so starting grid pitch differs from native zoom.',
    orientationDifference: 'Native screenshot uses Y-up FRONT; existing model uses Z-up, so XY remains TOP.',
    cube: { presentation: 'Face and offsets follow actual scene height / 946; camera orientation is unchanged.',
      nativePixelBounds: [
        { image: 'fusion-parity-native-sketch-empty-2048-dpi110.png', viewport: [2048, 1137], x: 1928, y: 184, extent: 70 },
        { image: 'fusion-parity-native-sketch-layout-1600-dpi110.png', viewport: [1600, 900], x: 1510, y: 171, extent: 53 },
        { image: 'fusion-parity-native-sketch-layout-1366-dpi110.png', viewport: [1375, 768], x: 1301, y: 165, extent: 43 },
      ] } };
  await page.locator('[data-sketch-option="snap"]').uncheck();

  phase = 'line-in-left-former-letterbox';
  await tool('sketch.line').click();
  const leftClicks = [await clickSide([-70, -30], 'left'), await clickSide([-60, -25], 'left')];
  await count(1); await page.keyboard.press('Escape');
  phase = 'circle-in-right-former-letterbox';
  await tool('sketch.circle').click();
  const rightClicks = [await clickSide([65, -35], 'right'), await clickSide([70, -35], 'right')];
  await count(2); await page.keyboard.press('Escape');
  let documentBeforeViewChanges = await save();
  const entities = documentBeforeViewChanges.sketches[0].entities;
  assert.equal(entities.length, 2);
  const line = entities.find(entity => entity.type === 'line'), circle = entities.find(entity => entity.type === 'circle');
  assert.ok(line && circle);
  pointNear(line.data.from, [-70, -30], 'Committed left line start');
  pointNear(line.data.to, [-60, -25], 'Committed left line end');
  pointNear(circle.data.center, [65, -35], 'Committed right circle center');
  near(circle.data.diameter, 10, .02, 'Committed right circle diameter');
  report.sideDrawing = { leftClicks, rightClicks, persistedLine: line.data, persistedCircle: circle.data };
  const geometryAppearance = await page.evaluate(({ lineId, circleId }) => {
    const entity = id => document.querySelector('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="' + id + '"]');
    const point = document.querySelector('[data-sketch-layer="points"] [data-entity-id="' + lineId + '"]');
    const bounds = point.getBoundingClientRect(), style = getComputedStyle(point);
    return { line: getComputedStyle(entity(lineId)).stroke, circle: getComputedStyle(entity(circleId)).stroke,
      endpoint: { width: bounds.width, height: bounds.height, fill: style.fill, stroke: style.stroke } };
  }, { lineId: line.id, circleId: circle.id });
  assert.equal(geometryAppearance.line, 'rgb(0, 165, 232)'); assert.equal(geometryAppearance.circle, 'rgb(0, 165, 232)');
  near(geometryAppearance.endpoint.width, 8, .2, 'Native open endpoint diameter');
  near(geometryAppearance.endpoint.height, 8, .2, 'Endpoint marker stays circular');
  assert.equal(geometryAppearance.endpoint.fill, 'rgb(255, 255, 255)');
  assert.equal(geometryAppearance.endpoint.stroke, 'rgb(146, 155, 158)');
  report.geometryAppearance = geometryAppearance;

  phase = 'construction-display-filter';
  await clickSide([-65, -27.5], 'left');
  await page.waitForFunction(id => document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-selected-sketch-entity-id') === id, line.id);
  assert.equal(await page.locator('.cad-sketch-selection-highlight.selected').evaluate(element => getComputedStyle(element).stroke),
    'rgb(85, 127, 255)', 'Selected geometry uses the observed periwinkle highlight');
  await page.getByRole('checkbox', { name: 'Вспомогательная геометрия', exact: true }).check();
  await page.waitForFunction(id => document.querySelector('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="' + id + '"]')?.getAttribute('data-sketch-construction') === 'true', line.id);
  documentBeforeViewChanges = await save();
  assert.equal(documentBeforeViewChanges.sketches[0].entities.find(entity => entity.id === line.id).data.construction, true);
  const constructionToggle = page.locator('[data-sketch-option="construction"]');
  await constructionToggle.uncheck(); await count(1);
  assert.equal(await page.locator('[data-sketch-select-id="' + line.id + '"]').count(), 0, 'Hidden construction has no pointer hit target');
  assert.equal(await page.locator('[data-sketch-layer="points"] [data-entity-id="' + line.id + '"]').count(), 0, 'Hidden construction has no point marks');
  await constructionToggle.check(); await count(2);
  assert.deepEqual(await save(), documentBeforeViewChanges, 'Construction display preference never mutates the CAD document');
  const projected = page.locator('[data-sketch-option="projected"]');
  assert.equal(await projected.isEnabled(), false, 'Unavailable projected provenance cannot pretend to filter geometry');
  assert.equal(await projected.isChecked(), false);
  report.constructionVisibility = { publicUiConversion: true, visibleGeometryAndHitTargetsHideTogether: true,
    pointMarksHidden: true, documentUnchangedByDisplay: true, projectedFilter: 'UNAVAILABLE: no provenance in the shared model' };

  phase = 'wheel-anchor-in-side-zone';
  const beforeWheel = await circleBox(circle.id), spanBeforeWheel = Number(await stage().getAttribute('data-sketch-view-span'));
  await page.mouse.move(...beforeWheel.center); await page.mouse.wheel(0, -180);
  await page.waitForFunction(span => Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span')) < span, spanBeforeWheel);
  await waitForFullFrame();
  const afterWheel = await circleBox(circle.id);
  beforeWheel.center.forEach((value, index) => near(afterWheel.center[index], value, .5, 'Wheel keeps visible circle center under pointer'));
  assert.ok(afterWheel.width > beforeWheel.width, 'Wheel changes the actual rendered geometry scale');
  report.wheel = { anchorWorld: circle.data.center, before: beforeWheel, after: afterWheel, anchorToleranceCssPx: .5 };
  await page.getByRole('button', { name: 'Главный вид модели', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span')) === 100);

  phase = 'responsive-full-field';
  for (const [width, height] of [[2048, 1137], [1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height }); await waitForFullFrame();
    const snapshot = await fieldSnapshot(), renderedCircle = await circleBox(circle.id);
    const { stage: bounds, frame, grid, span, layerFrames } = snapshot;
    const cubeScale = bounds.height / 946;
    near(snapshot.cube.width, 70 * cubeScale, .2, 'Cube face follows actual scene height');
    near(snapshot.cube.height, snapshot.cube.width, .2, 'Cube face remains square');
    near(snapshot.cube.x + snapshot.cube.width, bounds.x + bounds.width - 50 * cubeScale, .2, 'Cube right offset follows actual scene height');
    near(snapshot.cube.y, bounds.y + 50 * cubeScale, .2, 'Cube top offset follows actual scene height');
    assert.equal(snapshot.cube.worldUp, 'Z'); assert.equal(snapshot.cube.mode, 'plane-locked');
    assert.equal(new Set(layerFrames).size, 1, 'All visible and input layers share one frame');
    near(frame.width / frame.height, bounds.width / bounds.height, 1e-7, 'Frame follows scene aspect ratio');
    near(grid.left, bounds.x, .2, 'Grid reaches left scene edge');
    near(grid.right, bounds.x + bounds.width, .2, 'Grid reaches right scene edge');
    near(grid.top, bounds.y, .2, 'Grid reaches top scene edge');
    near(grid.bottom, bounds.y + bounds.height, .2, 'Grid reaches bottom scene edge');
    assert.ok(grid.minorPitch >= 18.8 && grid.minorPitch <= 37.8, 'Grid density adapts to actual viewport scale');
    near(grid.majorPitch, grid.minorPitch * 5, .2, 'Every fifth visible grid line is major');
    near(grid.minorPitch, grid.minorStep * Math.min(bounds.width, bounds.height) / span, .2, 'Grid spacing retains real sketch units');
    assert.ok(grid.labels.length > 0, 'Major coordinates are visible along the axes');
    for (const label of grid.labels) {
      near(Number(label.text), label.value, 1e-8, 'Label displays its real coordinate');
      near(label.value / (grid.minorStep * 5), Math.round(label.value / (grid.minorStep * 5)), 1e-8, 'Labels coincide with major ticks');
    }
    near(renderedCircle.width, renderedCircle.height, .2, 'Circle is not stretched into an ellipse');
    // Chromium rounds SVG viewBox coordinates in its screen matrix; radius checks retain a 0.2 CSS px limit.
    near(renderedCircle.scaleX, Math.min(bounds.width, bounds.height) / span, 1e-6, 'Existing scale preserved after resize');
    near(renderedCircle.scaleX, renderedCircle.scaleY, 1e-7, 'Equal CSS scale on both axes');
    near(renderedCircle.width, circle.data.diameter * renderedCircle.scaleX, .2, 'Actual diameter follows the camera');
    assert.equal(await page.evaluate(() => devicePixelRatio), 1);
    report.screenChecks.push({ viewport: { width, height, dpr: 1 }, ...snapshot, circle: renderedCircle });
    const filename = 'fusion-live-sketch-field-' + width + '.png';
    await page.screenshot({ path: resolve(out, filename) }); report.screenshots.push(filename);
  }
  assert.deepEqual(await save(), documentBeforeViewChanges, 'Wheel and resize must not mutate the saved CAD document');
  assert.deepEqual(errors, []);
  Object.assign(report, { status: 'PASS', fullAreaDrawing: true, isotropicCircle: true,
    sharedFrame: true, viewChangesPreserveDocument: true, pageErrors: errors });
} catch (error) {
  Object.assign(report, { status: 'FAIL', phase, error: error.message, pageErrors: errors });
  console.error('PHASE', phase, error.stack);
  await page.screenshot({ path: resolve(out, 'fusion-live-sketch-field-debug.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, 'fusion-live-sketch-field-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
