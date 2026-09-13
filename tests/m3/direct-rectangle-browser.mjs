import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

function near(actual, expected, tolerance = 0.7, label = 'value') {
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
  const layer = page.locator('[data-testid="cad-sketch-interaction"][data-tool="rectangle"]');
  await layer.waitFor();
  const box = await layer.boundingBox();
  assert.ok(box && box.width > 120 && box.height > 120, 'Rectangle interaction layer has no usable bounds');
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

async function waitSolvedRectangle(page) {
  const overlay = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="4"]');
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
    return status === 'solved' || status === 'error';
  }, null, { timeout: 20_000 });
  const status = await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status');
  assert.equal(status, 'solved', 'direct Rectangle PlaneGCS preview did not solve');
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
  assert.equal(await overlay.locator('line[data-sketch-entity-id]').count(), 4, 'Rectangle overlay must contain four persisted/solved edges');
  return overlay;
}

async function deterministicRectangleFixture() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${url.replace(/\/$/, '')}/dev/part/rectangle`, { waitUntil: 'networkidle' });
  await page.locator('.cad-app[data-dev-fixture="rectangle"][data-fixture-status="ready"]').waitFor();
  await page.getByText('Fixture rectangle: прямоугольник 36×20 мм в XY', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
  await waitSolvedRectangle(page);
  const wasm = await wasmResources(page);
  assert.ok(wasm.some(isPlaneGcs), 'Rectangle fixture did not exercise PlaneGCS');
  assert.deepEqual(wasm.filter((name) => !isPlaneGcs(name)), [], 'Rectangle fixture loaded OpenCascade/other WASM');
  await page.close();
  console.log('  ✓ /dev/part/rectangle deterministic review fixture');
}

async function desktopDirectRectangle() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await createXYSketch(page);
  assert.deepEqual(await wasmResources(page), [], 'empty Sketch loaded a CAD kernel');

  const rectangleButton = page.locator('[data-command-id="sketch.rectangle"]').first();
  assert.equal(await rectangleButton.isEnabled(), true, 'Rectangle action must be enabled in active Sketch');
  await rectangleButton.click();
  await page.locator('.content-area.panel-closed').waitFor();

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-rectangle-phase'), 'awaiting-first');
  const first = squarePoint(box, 0.65, 0.40);
  const invalidSameX = squarePoint(box, 0.65, 0.60);
  const opposite = squarePoint(box, 0.35, 0.60);

  await page.mouse.click(first.x, first.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-rectangle-phase="awaiting-opposite"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle first corner mutated persisted Sketch');

  await page.mouse.move(invalidSameX.x, invalidSameX.y);
  await page.mouse.click(invalidSameX.x, invalidSameX.y);
  await page.getByText('Ширина и высота прямоугольника должны быть больше нуля', { exact: true }).waitFor();
  assert.equal(await layer.getAttribute('data-rectangle-phase'), 'awaiting-opposite', 'invalid opposite corner must keep Rectangle tool active');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'invalid Rectangle committed geometry');

  await page.mouse.move(opposite.x, opposite.y);
  const ghostEdges = page.locator('[data-testid="sketch-rectangle-ghost-edge"]');
  await ghostEdges.first().waitFor({ state: 'attached' });
  assert.equal(await ghostEdges.count(), 4, 'Rectangle preview must be exactly four transient edges');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle ghost mutated persisted Sketch');

  await page.mouse.click(opposite.x, opposite.y);
  await page.getByText(/Прямоугольник 30(?:\.0)?×20(?:\.0)? мм создан/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  await waitSolvedRectangle(page);

  const sketchWasm = await wasmResources(page);
  assert.ok(sketchWasm.some(isPlaneGcs), 'PlaneGCS WASM did not load after direct Rectangle commit');
  assert.deepEqual(sketchWasm.filter((name) => !isPlaneGcs(name)), [], 'OpenCascade loaded during direct 2D Rectangle');

  await page.locator('[data-command-id="system.undo"]').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('[data-command-id="system.redo"]').click();
  await waitSolvedRectangle(page);

  await page.locator('[data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'direct Rectangle document was not saved');
  const document = JSON.parse(saved);
  const sketch = document.sketches[0];
  const edges = sketch?.entities.filter((item) => item.type === 'line' && /^rectangle-edge-/.test(item.data.role ?? '')) ?? [];
  assert.equal(edges.length, 4, 'saved direct Rectangle must contain four rectangle edges');
  assert.equal(document.dimensions.length, 0, 'direct Rectangle must not silently add driving dimensions');

  const xs = edges.flatMap((edge) => [edge.data.from[0], edge.data.to[0]]);
  const ys = edges.flatMap((edge) => [edge.data.from[1], edge.data.to[1]]);
  near(Math.min(...xs), -15, 0.9, 'saved Rectangle min x');
  near(Math.max(...xs), 15, 0.9, 'saved Rectangle max x');
  near(Math.min(...ys), -10, 0.9, 'saved Rectangle min y');
  near(Math.max(...ys), 10, 0.9, 'saved Rectangle max y');

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await waitSolvedRectangle(page);

  assert.deepEqual(errors, [], `desktop direct Rectangle page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ desktop Rectangle: first/opposite -> four-edge ghost -> normalized one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectRectangle() {
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
    const rectangleButton = tools.locator('[data-command-id="sketch.rectangle"]');
    assert.equal(await rectangleButton.isEnabled(), true, 'mobile Rectangle action must use shared CadUiAction');
    await rectangleButton.click();

    const { box } = await interactionBox(page);
    const first = squarePoint(box, 0.35, 0.38);
    const opposite = squarePoint(box, 0.65, 0.62);
    await page.touchscreen.tap(first.x, first.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-rectangle-phase="awaiting-opposite"]').waitFor();
    await page.touchscreen.tap(opposite.x, opposite.y);
    await waitSolvedRectangle(page);

    assert.deepEqual(errors, [], `touch direct Rectangle page errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch Rectangle: shared two-tap surface commits one normalized Rectangle without desktop DOM delegation');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.5 direct Rectangle browser');
  await deterministicRectangleFixture();
  await desktopDirectRectangle();
  await touchDirectRectangle();
  console.log('ASA-CAD M3.5 direct Rectangle browser PASS\n');
} finally {
  await browser.close();
}
