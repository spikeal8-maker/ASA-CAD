import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

function near(actual, expected, tolerance = 0.6, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

async function wasmResources(page) {
  return page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\.wasm(?:\?|$)/i.test(name)));
}

function isPlaneGcs(name) {
  return /planegcs/i.test(name);
}

async function createXYSketch(page) {
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
}

async function interactionBox(page) {
  const layer = page.locator('[data-testid="cad-sketch-interaction"][data-tool="circle"]');
  await layer.waitFor();
  const box = await layer.boundingBox();
  assert.ok(box && box.width > 120 && box.height > 120, 'Circle interaction layer has no usable bounds');
  return { layer, box };
}

function squarePoint(box, xRatio, yRatio) {
  const side = Math.min(box.width, box.height);
  const offsetX = box.x + (box.width - side) / 2;
  const offsetY = box.y + (box.height - side) / 2;
  return {
    x: offsetX + side * xRatio,
    y: offsetY + side * yRatio,
  };
}

async function waitSolvedCircle(page) {
  const overlay = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]');
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
    return status === 'solved' || status === 'error';
  }, null, { timeout: 20_000 });
  const status = await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status');
  assert.equal(status, 'solved', 'direct Circle PlaneGCS preview did not solve');
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
  return overlay.locator('circle[data-sketch-entity-id]').first();
}

async function desktopDirectCircle() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await createXYSketch(page);
  assert.deepEqual(await wasmResources(page), [], 'empty Sketch loaded a CAD kernel');

  const circleButton = page.locator('[data-command-id="sketch.circle"]').first();
  assert.equal(await circleButton.isEnabled(), true, 'Circle action must be enabled in active Sketch');
  await circleButton.click();
  await page.locator('.content-area.panel-closed').waitFor();
  assert.equal(await page.locator('.management-panel').isVisible(), false, 'direct Circle must collapse management panel');

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-circle-phase'), 'awaiting-center');
  const center = squarePoint(box, 0.50, 0.50);
  const edge = squarePoint(box, 0.62, 0.50);

  await page.mouse.click(center.x, center.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-circle-phase="radius"]').waitFor();
  await page.locator('[data-testid="sketch-circle-center"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Circle center mutated persisted Sketch');

  await page.mouse.move(edge.x, edge.y);
  const ghost = page.locator('[data-testid="sketch-circle-ghost"]');
  await ghost.waitFor();
  near(Number(await ghost.getAttribute('r')), 12, 0.8, 'ghost radius');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Circle ghost mutated persisted Sketch');

  await page.mouse.click(edge.x, edge.y);
  await page.getByText(/Окружность создана: Ø24(?:\.0)? мм/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  const persistedCircle = await waitSolvedCircle(page);
  near(Number(await persistedCircle.getAttribute('r')), 12, 0.8, 'persisted circle radius');

  const sketchWasm = await wasmResources(page);
  assert.ok(sketchWasm.some(isPlaneGcs), 'PlaneGCS WASM did not load after direct Circle commit');
  assert.deepEqual(sketchWasm.filter((name) => !isPlaneGcs(name)), [], 'OpenCascade loaded during direct 2D Circle');

  // One Undo removes the complete direct Circle because pointer interaction
  // commits exactly one sketch.circle history mutation.
  await page.locator('[data-command-id="system.undo"]').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('[data-command-id="system.redo"]').click();
  await waitSolvedCircle(page);

  await page.locator('[data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'direct Circle document was not saved');
  const document = JSON.parse(saved);
  const entity = document.sketches[0]?.entities.find((item) => item.type === 'circle');
  assert.ok(entity, 'saved direct Circle entity missing');
  near(entity.data.center[0], 0, 0.8, 'saved center x');
  near(entity.data.center[1], 0, 0.8, 'saved center y');
  near(entity.data.diameter, 24, 1.2, 'saved diameter');
  assert.equal(document.dimensions.length, 0, 'direct Circle must not silently create a driving dimension');

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();

  assert.deepEqual(errors, [], `desktop direct Circle page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ desktop Circle: center -> radius ghost -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectCircle() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const toolsTab = page.getByRole('button', { name: /Инструменты/ });
    await toolsTab.click();
    const tools = page.locator('[data-mobile-tools="true"]');
    await tools.locator('[data-command-id="part.sketch.create"]').click();
    await page.getByRole('button', { name: /XY/ }).click();
    await page.locator('.parameter-actions button.primary').click();
    await page.getByText('Эскиз 1', { exact: true }).waitFor();

    await toolsTab.click();
    await tools.waitFor();
    const circleButton = tools.locator('[data-command-id="sketch.circle"]');
    assert.equal(await circleButton.isEnabled(), true, 'mobile Circle action must use shared CadUiAction');
    await circleButton.click();
    await page.locator('.content-area.panel-closed').waitFor();

    const { box } = await interactionBox(page);
    const center = squarePoint(box, 0.44, 0.46);
    const edge = squarePoint(box, 0.60, 0.46);
    await page.touchscreen.tap(center.x, center.y);
    await page.locator('[data-testid="sketch-circle-center"]').waitFor();
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');
    await page.touchscreen.tap(edge.x, edge.y);
    await waitSolvedCircle(page);

    assert.deepEqual(errors, [], `touch direct Circle page errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch Circle: shared single-tap surface commits center/radius without desktop DOM delegation');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.3 direct Circle browser');
  await desktopDirectCircle();
  await touchDirectCircle();
  console.log('ASA-CAD M3.3 direct Circle browser PASS\n');
} finally {
  await browser.close();
}
