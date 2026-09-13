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
  const layer = page.locator('[data-testid="cad-sketch-interaction"][data-tool="arc"]');
  await layer.waitFor();
  const box = await layer.boundingBox();
  assert.ok(box && box.width > 120 && box.height > 120, 'Arc interaction layer has no usable bounds');
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

async function waitSolvedArc(page) {
  const overlay = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]');
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
    return status === 'solved' || status === 'error';
  }, null, { timeout: 20_000 });
  const status = await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status');
  assert.equal(status, 'solved', 'direct Arc PlaneGCS preview did not solve');
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
  const arc = overlay.locator('path[data-sketch-entity-id]').first();
  await arc.waitFor();
  return arc;
}

async function deterministicArcFixture() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${url.replace(/\/$/, '')}/dev/part/arc`, { waitUntil: 'networkidle' });
  await page.locator('.cad-app[data-dev-fixture="arc"][data-fixture-status="ready"]').waitFor();
  await page.getByText('Fixture arc: дуга R12 мм 0→90° в XY', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
  const arc = await waitSolvedArc(page);
  const path = await arc.getAttribute('d');
  assert.match(path, /^M\s+12(?:\.0+)?\s+0(?:\.0+)?\s+A\s+12(?:\.0+)?\s+12(?:\.0+)?\s+0\s+0\s+0\s+/, 'fixture Arc must keep the positive CAD CCW sweep on the intended circle');
  const wasm = await wasmResources(page);
  assert.ok(wasm.some(isPlaneGcs), 'Arc fixture did not exercise PlaneGCS');
  assert.deepEqual(wasm.filter((name) => !isPlaneGcs(name)), [], 'Arc fixture loaded OpenCascade/other WASM');
  await page.close();
  console.log('  ✓ /dev/part/arc deterministic review fixture');
}

async function desktopDirectArc() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await createXYSketch(page);
  assert.deepEqual(await wasmResources(page), [], 'empty Sketch loaded a CAD kernel');

  const arcButton = page.locator('[data-command-id="sketch.arc"]').first();
  assert.equal(await arcButton.isEnabled(), true, 'Arc action must be enabled in active Sketch');
  await arcButton.click();
  await page.locator('.content-area.panel-closed').waitFor();

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-arc-phase'), 'awaiting-center');
  const center = squarePoint(box, 0.50, 0.50);
  const start = squarePoint(box, 0.62, 0.50);
  const end = squarePoint(box, 0.50, 0.38);

  await page.mouse.click(center.x, center.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-start"]').waitFor();
  await page.locator('[data-testid="sketch-arc-center"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Arc center mutated persisted Sketch');

  await page.mouse.move(start.x, start.y);
  const radiusGhost = page.locator('[data-testid="sketch-arc-radius-ghost"]');
  await radiusGhost.waitFor({ state: 'attached' });
  near(Number(await radiusGhost.getAttribute('x2')), 12, 1.2, 'radius ghost x2');
  await page.mouse.click(start.x, start.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-end"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Arc start mutated persisted Sketch');

  await page.mouse.click(center.x, center.y);
  await page.getByText('Конечная точка должна отличаться от центра дуги', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-end"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'invalid Arc endpoint committed geometry');

  await page.mouse.move(end.x, end.y);
  await page.locator('[data-testid="sketch-arc-ghost"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Arc ghost mutated persisted Sketch');

  await page.mouse.click(end.x, end.y);
  await page.getByText(/Дуга создана: R12(?:\.0)? мм/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  const solvedArc = await waitSolvedArc(page);
  assert.match(await solvedArc.getAttribute('d'), /A\s+[^ ]+\s+[^ ]+\s+0\s+0\s+0\s+/, 'direct Arc must render with SVG sweep-flag=0');

  const sketchWasm = await wasmResources(page);
  assert.ok(sketchWasm.some(isPlaneGcs), 'PlaneGCS WASM did not load after direct Arc commit');
  assert.deepEqual(sketchWasm.filter((name) => !isPlaneGcs(name)), [], 'OpenCascade loaded during direct 2D Arc');

  await page.locator('[data-command-id="system.undo"]').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('[data-command-id="system.redo"]').click();
  await waitSolvedArc(page);

  await page.locator('[data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'direct Arc document was not saved');
  const document = JSON.parse(saved);
  const entity = document.sketches[0]?.entities.find((item) => item.type === 'arc');
  assert.ok(entity, 'saved direct Arc entity missing');
  near(entity.data.center[0], 0, 0.8, 'saved center x');
  near(entity.data.center[1], 0, 0.8, 'saved center y');
  near(entity.data.radius, 12, 1.2, 'saved radius');
  near(entity.data.startAngle, 0, 0.12, 'saved start angle');
  near(entity.data.endAngle, Math.PI / 2, 0.12, 'saved end angle');

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-command-id="system.open"]').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await waitSolvedArc(page);

  assert.deepEqual(errors, [], `desktop direct Arc page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('  ✓ desktop Arc: center -> start -> guarded end -> sweep ghost -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectArc() {
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
    const arcButton = tools.locator('[data-command-id="sketch.arc"]');
    assert.equal(await arcButton.isEnabled(), true, 'mobile Arc action must use shared CadUiAction');
    await arcButton.click();

    const { box } = await interactionBox(page);
    const center = squarePoint(box, 0.44, 0.50);
    const start = squarePoint(box, 0.60, 0.50);
    const end = squarePoint(box, 0.44, 0.34);
    await page.touchscreen.tap(center.x, center.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-start"]').waitFor();
    await page.touchscreen.tap(start.x, start.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-end"]').waitFor();
    await page.touchscreen.tap(end.x, end.y);
    await waitSolvedArc(page);

    assert.deepEqual(errors, [], `touch direct Arc page errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch Arc: shared three-tap surface commits center/start/end without desktop DOM delegation');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.4B direct Arc browser');
  await deterministicArcFixture();
  await desktopDirectArc();
  await touchDirectArc();
  console.log('ASA-CAD M3.4B direct Arc browser PASS\n');
} finally {
  await browser.close();
}
