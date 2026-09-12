import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

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
  const layer = page.locator('[data-testid="cad-sketch-interaction"][data-tool="line"]');
  await layer.waitFor();
  const box = await layer.boundingBox();
  assert.ok(box && box.width > 120 && box.height > 120, 'Line interaction layer has no usable bounds');
  return { layer, box };
}

async function waitSolvedLine(page) {
  const overlay = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]');
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
    return status === 'solved' || status === 'error';
  }, null, { timeout: 20_000 });
  const status = await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status');
  assert.equal(status, 'solved', 'direct Line PlaneGCS preview did not solve');
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
}

async function desktopDirectLine() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await createXYSketch(page);
  assert.deepEqual(await wasmResources(page), [], 'empty Sketch loaded a CAD kernel');

  const stage = page.locator('[data-testid="part-model-stage"]');
  assert.equal(await stage.getAttribute('data-sketch-context'), 'isolated-2d');
  assert.equal(await stage.getAttribute('data-sketch-support'), 'XY');
  assert.equal(await stage.getAttribute('data-sketch-projection'), 'origin-plane');
  assert.equal(await stage.getAttribute('data-model-context-ready'), 'true');

  const lineButton = page.locator('[data-command-id="sketch.line"]').first();
  assert.equal(await lineButton.isEnabled(), true, 'Line action must be enabled in active Sketch');
  await lineButton.click();

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-line-phase'), 'awaiting-start');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');

  await layer.click({ position: { x: box.width * 0.30, y: box.height * 0.62 } });
  await page.locator('[data-testid="cad-sketch-interaction"][data-line-phase="anchored"]').waitFor();
  await page.locator('[data-testid="sketch-line-anchor"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'first point mutated persisted Sketch');

  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.34);
  await page.locator('[data-testid="sketch-line-ghost"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'ghost preview mutated persisted Sketch');

  await layer.click({ position: { x: box.width * 0.72, y: box.height * 0.34 } });
  await page.getByText(/Отрезок создан:/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  await waitSolvedLine(page);

  const sketchWasm = await wasmResources(page);
  assert.ok(sketchWasm.some(isPlaneGcs), 'PlaneGCS WASM did not load after persisted Line commit');
  assert.deepEqual(sketchWasm.filter((name) => !isPlaneGcs(name)), [], 'OpenCascade loaded during direct 2D Line');

  await page.locator('[data-command-id="system.undo"]').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('[data-command-id="system.redo"]').click();
  await waitSolvedLine(page);

  await page.locator('[data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();

  assert.deepEqual(errors, [], `desktop direct Line page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ desktop Line: ghost transient -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectLine() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

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
  const lineButton = tools.locator('[data-command-id="sketch.line"]');
  assert.equal(await lineButton.isEnabled(), true, 'mobile Line action must use shared CadUiAction');
  await lineButton.click();

  const { box } = await interactionBox(page);
  await page.touchscreen.tap(box.x + box.width * 0.28, box.y + box.height * 0.62);
  await page.locator('[data-testid="sketch-line-anchor"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');
  await page.touchscreen.tap(box.x + box.width * 0.72, box.y + box.height * 0.36);
  await waitSolvedLine(page);

  assert.deepEqual(errors, [], `touch direct Line page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ touch Line: same Pointer Events path commits one line');
}

async function deterministicLineFixture() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${url.replace(/\/$/, '')}/dev/part/line`, { waitUntil: 'networkidle' });
  await page.locator('.cad-app[data-dev-fixture="line"][data-fixture-status="ready"]').waitFor();
  await page.getByText('Fixture line: один прямой отрезок в XY', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();
  assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
  await page.close();
  console.log('  ✓ /dev/part/line deterministic review fixture');
}

try {
  console.log('\nASA-CAD M3.2 direct Line browser');
  await deterministicLineFixture();
  await desktopDirectLine();
  await touchDirectLine();
  console.log('ASA-CAD M3.2 direct Line browser PASS\n');
} finally {
  await browser.close();
}
