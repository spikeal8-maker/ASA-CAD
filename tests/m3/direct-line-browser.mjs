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

function squarePoint(box, xRatio, yRatio) {
  const side = Math.min(box.width, box.height);
  const offsetX = box.x + (box.width - side) / 2;
  const offsetY = box.y + (box.height - side) / 2;
  return {
    x: offsetX + side * xRatio,
    y: offsetY + side * yRatio,
  };
}

async function assertVisibleTouchTarget(page, x, y) {
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest?.('[data-testid="cad-sketch-interaction"]'));
  }, { x, y });
  assert.equal(hit, true, `touch point ${x.toFixed(1)},${y.toFixed(1)} is covered by UI chrome`);
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

async function sketchViewState(page) {
  return page.locator('[data-testid="part-model-stage"]').evaluate((node) => ({
    span: Number(node.getAttribute('data-sketch-view-span')),
    center: (node.getAttribute('data-sketch-view-center') ?? '').split(',').map(Number),
  }));
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
  assert.deepEqual(await sketchViewState(page), { span: 100, center: [0, 0] });

  const lineButton = page.locator('[data-command-id="sketch.line"]').first();
  assert.equal(await lineButton.isEnabled(), true, 'Line action must be enabled in active Sketch');
  await lineButton.click();
  await page.locator('.content-area.panel-closed').waitFor();
  assert.equal(await page.locator('.management-panel').isVisible(), false, 'direct drawing must collapse management panel');

  const { layer, box } = await interactionBox(page);
  assert.equal(await layer.getAttribute('data-line-phase'), 'awaiting-start');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');

  // Draw across 80% of the stable 100 mm frame. This is intentionally wider
  // than the old entity-fit empty frame (~23.2 mm) and proves there is no
  // geometry-derived drawing cage.
  const first = squarePoint(box, 0.10, 0.58);
  const second = squarePoint(box, 0.90, 0.36);
  await page.mouse.click(first.x, first.y);
  await page.locator('[data-testid="cad-sketch-interaction"][data-line-phase="anchored"]').waitFor();
  await page.locator('[data-testid="sketch-line-anchor"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'first point mutated persisted Sketch');

  await page.mouse.move(second.x, second.y);
  await page.locator('[data-testid="sketch-line-ghost"]').waitFor();
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'ghost preview mutated persisted Sketch');

  await page.mouse.click(second.x, second.y);
  await page.getByText(/Отрезок создан:/).waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
  await waitSolvedLine(page);
  assert.deepEqual(await sketchViewState(page), { span: 100, center: [0, 0] }, 'geometry commit refit the Sketch viewport');
  assert.equal(await page.locator('.content-area.panel-closed').count(), 0, 'Tree panel was not restored after Line commit');

  const persistedLine = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]').first();
  const x1 = Number(await persistedLine.getAttribute('x1'));
  const x2 = Number(await persistedLine.getAttribute('x2'));
  assert.ok(Math.abs(x2 - x1) > 60, `Line remained trapped in old fit bounds: x1=${x1}, x2=${x2}`);

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
  console.log('  ✓ desktop Line: full-width stable frame -> ghost -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      x: point.x,
      y: point.y,
      radiusX: 4,
      radiusY: 4,
      force: 1,
      id: point.id,
    })),
  });
}

async function twoFingerGesture(client, startA, startB, endA, endB, steps = 4) {
  await dispatchTouch(client, 'touchStart', [
    { id: 1, ...startA },
    { id: 2, ...startB },
  ]);
  for (let index = 1; index <= steps; index++) {
    await dispatchTouch(client, 'touchMove', [
      {
        id: 1,
        x: startA.x + (endA.x - startA.x) * index / steps,
        y: startA.y + (endA.y - startA.y) * index / steps,
      },
      {
        id: 2,
        x: startB.x + (endB.x - startB.x) * index / steps,
        y: startB.y + (endB.y - startB.y) * index / steps,
      },
    ]);
  }
  await dispatchTouch(client, 'touchEnd', []);
}

async function touchDirectLine() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
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
    const lineButton = tools.locator('[data-command-id="sketch.line"]');
    assert.equal(await lineButton.isEnabled(), true, 'mobile Line action must use shared CadUiAction');
    await lineButton.click();
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'mobile direct drawing must collapse bottom sheet');

    const { box } = await interactionBox(page);
    const lowerWorkplane = squarePoint(box, 0.50, 0.78);
    await assertVisibleTouchTarget(page, lowerWorkplane.x, lowerWorkplane.y);

    // Two fingers are Sketch navigation only. A parallel move pans; spreading
    // contacts zooms. Neither gesture may create an anchor or persisted entity.
    const beforePan = await sketchViewState(page);
    const panA = squarePoint(box, 0.38, 0.46);
    const panB = squarePoint(box, 0.62, 0.46);
    await twoFingerGesture(
      client,
      panA,
      panB,
      { x: panA.x + 28, y: panA.y + 18 },
      { x: panB.x + 28, y: panB.y + 18 },
    );
    await page.waitForTimeout(120);
    const afterPan = await sketchViewState(page);
    assert.notDeepEqual(afterPan.center, beforePan.center, 'two-finger Sketch pan did not change transient view center');
    assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0, 'two-finger pan created a Line anchor');
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'two-finger pan mutated Sketch entities');

    const pinchA = squarePoint(box, 0.42, 0.50);
    const pinchB = squarePoint(box, 0.58, 0.50);
    const beforePinch = await sketchViewState(page);
    await twoFingerGesture(
      client,
      pinchA,
      pinchB,
      squarePoint(box, 0.28, 0.50),
      squarePoint(box, 0.72, 0.50),
    );
    await page.waitForTimeout(120);
    const afterPinch = await sketchViewState(page);
    assert.notEqual(afterPinch.span, beforePinch.span, 'two-finger pinch did not change transient Sketch span');
    assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0, 'pinch created a Line anchor');
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'pinch mutated Sketch entities');

    const first = squarePoint(box, 0.30, 0.32);
    const second = squarePoint(box, 0.72, 0.58);
    await assertVisibleTouchTarget(page, first.x, first.y);
    await page.touchscreen.tap(first.x, first.y);
    await page.locator('[data-testid="sketch-line-anchor"]').waitFor();
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');
    await assertVisibleTouchTarget(page, second.x, second.y);
    await page.touchscreen.tap(second.x, second.y);
    await waitSolvedLine(page);

    assert.deepEqual(errors, [], `touch direct Line page errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch Line: panel collapsed; two-finger pan/pinch navigate only; single taps commit one line');
  } finally {
    await context.close();
  }
}

async function deterministicLineFixture() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${url.replace(/\/$/, '')}/dev/part/line`, { waitUntil: 'networkidle' });
  await page.locator('.cad-app[data-dev-fixture="line"][data-fixture-status="ready"]').waitFor();
  await page.getByText('Fixture line: один прямой отрезок в XY', { exact: true }).waitFor();
  await page.locator('[data-sketch-id]').first().click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();
  assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
  assert.deepEqual(await sketchViewState(page), { span: 100, center: [0, 0] });
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
