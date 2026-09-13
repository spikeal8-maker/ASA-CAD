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
  return overlay;
}

async function deterministicRectangleFixture() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${url.replace(/\/$/, '')}/dev/part/rectangle`, { waitUntil: 'networkidle' });
  await page.locator('.cad-app[data-dev-fixture="rectangle"][data-fixture-status="ready"]').waitFor();
  await page.getByText('Fixture rectangle: прямой прямоугольник 36×18 мм без driving dimensions', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
  const overlay = await waitSolvedRectangle(page);
  assert.equal(await overlay.locator('line[data-sketch-entity-id]').count(), 4, 'Rectangle fixture must render four solved edges');
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

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-rectangle-phase'), 'awaiting-first');

  // Start at lower/right and finish upper/left so the tool must normalize
  // arbitrary drag direction into canonical min-origin + positive dimensions.
  const first = squarePoint(box, 0.68, 0.66);
  const opposite = squarePoint(box, 0.32, 0.34);

  await page.mouse.click(first.x, first.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-rectangle-phase="awaiting-opposite"]').waitFor();
  await page.locator('[data-testid="sketch-rectangle-first-corner"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle first corner mutated persisted Sketch');

  await page.mouse.move(opposite.x, opposite.y);
  const ghost = page.locator('[data-testid="sketch-rectangle-ghost"]');
  await ghost.waitFor();
  assert.ok(Number(await ghost.getAttribute('width')) > 0, 'Rectangle ghost width must be positive');
  assert.ok(Number(await ghost.getAttribute('height')) > 0, 'Rectangle ghost height must be positive');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle ghost mutated persisted Sketch');

  await page.mouse.click(opposite.x, opposite.y);
  await page.getByText(/Прямоугольник .*×.* мм создан/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  const solved = await waitSolvedRectangle(page);
  assert.equal(await solved.locator('line[data-sketch-entity-id]').count(), 4);

  const sketchWasm = await wasmResources(page);
  assert.ok(sketchWasm.some(isPlaneGcs), 'PlaneGCS WASM did not load after direct Rectangle commit');
  assert.deepEqual(sketchWasm.filter((name) => !isPlaneGcs(name)), [], 'OpenCascade loaded during direct 2D Rectangle');

  // One Undo removes all four edges because direct pointer interaction commits
  // exactly one sketch.rectangle history mutation.
  await page.locator('[data-command-id="system.undo"]').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('[data-command-id="system.redo"]').click();
  await waitSolvedRectangle(page);

  await page.locator('[data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'direct Rectangle document was not saved');
  const document = JSON.parse(saved);
  const edges = document.sketches[0]?.entities.filter((item) => item.type === 'line' && String(item.data.role ?? '').startsWith('rectangle-edge-')) ?? [];
  assert.equal(edges.length, 4, 'saved direct Rectangle must contain four rectangle edges');
  assert.equal(document.dimensions.length, 0, 'direct Rectangle must not silently create driving dimensions');
  const edge0 = edges.find((edge) => edge.data.role === 'rectangle-edge-0');
  const edge1 = edges.find((edge) => edge.data.role === 'rectangle-edge-1');
  assert.ok(edge0 && edge1, 'saved direct Rectangle must preserve canonical edge roles');
  assert.ok(edge0.data.to[0] > edge0.data.from[0], 'canonical rectangle width must be positive');
  assert.ok(edge1.data.to[1] > edge1.data.from[1], 'canonical rectangle height must be positive');

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="4"]').waitFor();

  assert.deepEqual(errors, [], `desktop direct Rectangle page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ desktop Rectangle: corner -> ghost -> normalized one mutation -> solver -> undo/redo -> save/reopen');
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
    // Rectangle deliberately keeps the numeric Parameters sheet available as a
    // parallel fallback. Use the unobscured upper Sketch area for direct touch.
    const first = squarePoint(box, 0.64, 0.30);
    const opposite = squarePoint(box, 0.36, 0.12);
    await page.touchscreen.tap(first.x, first.y);
    await page.locator('[data-testid="sketch-rectangle-first-corner"]').waitFor();
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');
    await page.touchscreen.tap(opposite.x, opposite.y);
    await waitSolvedRectangle(page);

    assert.deepEqual(errors, [], `touch direct Rectangle page errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch Rectangle: shared single-tap surface commits first/opposite corners without desktop DOM delegation');
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
