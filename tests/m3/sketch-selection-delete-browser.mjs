import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });

function isPlaneGcs(name) {
  return /planegcs/i.test(name);
}

async function wasmResources(page) {
  return page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\.wasm(?:\?|$)/i.test(name)));
}

async function waitFixture(page, fixture, entityCount) {
  await page.goto(`${baseUrl}/dev/part/${fixture}`, { waitUntil: 'networkidle' });
  await page.locator(`.cad-app[data-dev-fixture="${fixture}"][data-fixture-status="ready"]`).waitFor();
  const overlay = page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${entityCount}"]`);
  await overlay.waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
    return status === 'solved' || status === 'error';
  }, null, { timeout: 20_000 });
  assert.equal(
    await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status'),
    'solved',
    `${fixture} fixture must solve before selection`,
  );
  return overlay;
}

async function entityScreenPoint(visual) {
  return visual.evaluate((node) => {
    if (!(node instanceof SVGGeometryElement)) throw new Error('Sketch entity is not SVGGeometryElement');
    const matrix = node.getScreenCTM();
    if (!matrix) throw new Error('Sketch entity has no screen transform');
    const length = node.getTotalLength();
    const local = node.getPointAtLength(length / 2);
    const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}

async function selectFirstEntityWithMouse(page) {
  const visual = page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').first();
  // A horizontal/vertical SVG line can have a zero-height/zero-width geometric
  // bounding box even though its stroked hit target is visibly selectable.
  // Waiting for DOM attachment reflects the actual selection contract better
  // than Playwright's box-based `visible` heuristic.
  await visual.waitFor({ state: 'attached' });
  const entityId = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(entityId, 'Sketch entity must expose stable entity ID');
  const point = await entityScreenPoint(visual);
  await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
  const selected = page.locator(`[data-sketch-entity-id="${entityId}"].selected`);
  await selected.waitFor({ state: 'attached' });
  return { entityId, point };
}

async function assertSketchOnlyWasm(page, label) {
  const wasm = await wasmResources(page);
  assert.ok(wasm.some(isPlaneGcs), `${label}: PlaneGCS WASM was not loaded`);
  assert.deepEqual(
    wasm.filter((name) => !isPlaneGcs(name)),
    [],
    `${label}: Sketch selection/delete must not load OpenCascade/other WASM`,
  );
}

async function desktopSelectionDelete(fixture, initialCount, deleteKey) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await waitFixture(page, fixture, initialCount);
    const app = page.locator('.cad-app');

    const firstSelection = await selectFirstEntityWithMouse(page);
    await app.focus();
    await page.keyboard.press('Escape');
    await page.locator('.cad-app[data-selected-sketch-entity-id=""]').waitFor();
    assert.equal(
      await page.locator(`[data-sketch-entity-id="${firstSelection.entityId}"]`).getAttribute('class'),
      `cad-sketch-overlay-entity ${fixture === 'rectangle' ? 'line' : fixture}`,
      `${fixture}: Esc must clear transient selected styling`,
    );

    const secondSelection = await selectFirstEntityWithMouse(page);
    assert.equal(secondSelection.entityId, firstSelection.entityId, `${fixture}: selection identity must be stable entityId`);
    await app.focus();
    await page.keyboard.press(deleteKey);
    await page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${initialCount - 1}"]`).waitFor({ timeout: 20_000 });
    await page.locator('.cad-app[data-selected-sketch-entity-id=""]').waitFor();
    assert.equal(
      await page.locator(`[data-sketch-entity-id="${firstSelection.entityId}"]`).count(),
      0,
      `${fixture}: deleted entity must leave overlay`,
    );

    if (fixture === 'line') {
      await page.locator('[data-command-id="system.undo"]').click();
      await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor({ timeout: 20_000 });
      assert.equal(
        await page.locator(`[data-sketch-entity-id="${firstSelection.entityId}"]`).count(),
        1,
        'Undo must restore the same stable entity ID',
      );
      await page.locator('[data-command-id="system.redo"]').click();
      await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor({ timeout: 20_000 });
    }

    await assertSketchOnlyWasm(page, fixture);
    assert.deepEqual(errors, [], `${fixture}: browser errors: ${errors.join(' | ')}`);
    console.log(`  ✓ ${fixture}: stable-ID select -> Esc -> select -> ${deleteKey}${fixture === 'line' ? ' -> Undo/Redo' : ''}`);
  } finally {
    await page.close();
  }
}

async function touchSelectionDelete() {
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
    await waitFixture(page, 'circle', 1);
    const visual = page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').first();
    const entityId = await visual.getAttribute('data-sketch-entity-id');
    assert.ok(entityId, 'touch Circle must expose stable entity ID');
    const point = await entityScreenPoint(visual);
    await page.touchscreen.tap(point.x, point.y);
    await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();

    const toolsTab = page.getByRole('button', { name: /Инструменты/ });
    await toolsTab.click();
    const tools = page.locator('[data-mobile-tools="true"]');
    await tools.waitFor();
    const deleteAction = tools.locator('[data-command-id="sketch.entity.delete"]');
    assert.equal(await deleteAction.isEnabled(), true, 'mobile delete action must use transient Sketch selection');
    await deleteAction.click();
    await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor({ timeout: 20_000 });
    await page.locator('.cad-app[data-selected-sketch-entity-id=""]').waitFor();

    await assertSketchOnlyWasm(page, 'touch Circle');
    assert.deepEqual(errors, [], `touch selection/delete browser errors: ${errors.join(' | ')}`);
    console.log('  ✓ touch: stable-ID entity tap -> shared mobile delete action');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.6A Sketch selection/delete browser');
  await desktopSelectionDelete('line', 1, 'Delete');
  await desktopSelectionDelete('circle', 1, 'Delete');
  await desktopSelectionDelete('arc', 1, 'Backspace');
  await desktopSelectionDelete('rectangle', 4, 'Delete');
  await touchSelectionDelete();
  console.log('ASA-CAD M3.6A Sketch selection/delete browser PASS\n');
} finally {
  await browser.close();
}
