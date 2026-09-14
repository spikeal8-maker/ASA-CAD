import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

export const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
export const shellUrl = `${baseUrl}/`;

export async function launchM3Browser() { return chromium.launch({ headless: true }); }
export function near(actual, expected, tolerance = 0.6, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}
export async function wasmResources(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\.wasm(?:\?|$)/i.test(name)));
}
function isPlaneGcs(name) { return /planegcs/i.test(name); }
export async function assertNoWasm(page, label) { assert.deepEqual(await wasmResources(page), [], `${label}: unexpected CAD kernel loaded`); }
export async function assertSketchOnlyWasm(page, label) {
  const wasm = await wasmResources(page);
  assert.ok(wasm.some(isPlaneGcs), `${label}: PlaneGCS WASM was not loaded`);
  assert.deepEqual(wasm.filter((name) => !isPlaneGcs(name)), [], `${label}: Sketch workflow loaded OpenCascade/other WASM`);
}

export async function createXYSketch(page) {
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
}
export async function createMobileXYSketch(page) {
  const tools = page.locator('[data-mobile-tools="true"]');
  await page.getByRole('button', { name: /Инструменты/ }).click();
  await tools.locator('[data-command-id="part.sketch.create"]').click();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();
}
export async function activateMobileTool(page, commandId, label) {
  await page.getByRole('button', { name: /Инструменты/ }).click();
  const button = page.locator(`[data-mobile-tools="true"] [data-command-id="${commandId}"]`);
  assert.equal(await button.isEnabled(), true, `mobile ${label} action must use shared CadUiAction`);
  await button.click();
}

export async function interactionBox(page, tool, label = tool) {
  const layer = page.locator(`[data-testid="cad-sketch-interaction"][data-tool="${tool}"]`);
  await layer.waitFor();
  const box = await layer.boundingBox();
  assert.ok(box && box.width > 120 && box.height > 120, `${label} interaction layer has no usable bounds`);
  return { layer, box };
}
export function squarePoint(box, xRatio, yRatio) {
  const side = Math.min(box.width, box.height);
  return { x: box.x + (box.width - side) / 2 + side * xRatio, y: box.y + (box.height - side) / 2 + side * yRatio };
}
export async function entityScreenPoint(visual) {
  return visual.evaluate((node) => {
    if (!(node instanceof SVGGeometryElement)) throw new Error('Sketch entity is not SVGGeometryElement');
    const matrix = node.getScreenCTM();
    if (!matrix) throw new Error('Sketch entity has no screen transform');
    const local = node.getPointAtLength(node.getTotalLength() / 2);
    const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}
export async function sketchViewState(page) {
  return page.locator('[data-testid="part-model-stage"]').evaluate((node) => ({
    span: Number(node.getAttribute('data-sketch-view-span')),
    center: (node.getAttribute('data-sketch-view-center') ?? '').split(',').map(Number),
  }));
}

export async function waitSolvedOverlay(page, entityCount, label) {
  const overlay = page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${entityCount}"]`);
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => ['solved', 'error'].includes(document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status') ?? ''), null, { timeout: 20_000 });
  const status = await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status');
  assert.equal(status, 'solved', `${label}: PlaneGCS preview did not solve`);
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
  return overlay;
}
export async function loadFixture(page, fixture, entityCount) {
  await page.goto(`${baseUrl}/dev/part/${fixture}`, { waitUntil: 'networkidle' });
  await page.locator(`.cad-app[data-dev-fixture="${fixture}"][data-fixture-status="ready"]`).waitFor();
  return waitSolvedOverlay(page, entityCount, `${fixture} fixture`);
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
export function assertNoPageErrors(errors, label) { assert.deepEqual(errors, [], `${label} page errors: ${errors.join(' | ')}`); }
export async function newDesktopPage(browser, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  return { page, errors: collectPageErrors(page) };
}
export async function newTouchPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  return { context, page, errors: collectPageErrors(page) };
}
export async function openFixture(browser, fixture, entityCount) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const overlay = await loadFixture(page, fixture, entityCount);
  return { page, overlay };
}

export async function saveLocalDocument(page) {
  await page.locator('.global-actions [data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'document was not saved to local host');
  return JSON.parse(saved);
}
export async function reopenFirstSketch(page, entityCount) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${entityCount}"]`).waitFor({ timeout: 20_000 });
}
export async function assertVisibleTouchTarget(page, x, y) {
  const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest?.('[data-testid="cad-sketch-interaction"]')), { x, y });
  assert.equal(hit, true, `touch point ${x.toFixed(1)},${y.toFixed(1)} is covered by UI chrome`);
}

export async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: point.id ?? index + 1 })),
  });
}
export async function twoFingerGesture(client, startA, startB, endA, endB, steps = 4) {
  await dispatchTouch(client, 'touchStart', [{ id: 1, ...startA }, { id: 2, ...startB }]);
  for (let index = 1; index <= steps; index++) {
    await dispatchTouch(client, 'touchMove', [
      { id: 1, x: startA.x + (endA.x - startA.x) * index / steps, y: startA.y + (endA.y - startA.y) * index / steps },
      { id: 2, x: startB.x + (endB.x - startB.x) * index / steps, y: startB.y + (endB.y - startB.y) * index / steps },
    ]);
  }
  await dispatchTouch(client, 'touchEnd', []);
}
