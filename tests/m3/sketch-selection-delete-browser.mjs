import assert from 'node:assert/strict';
import {
  assertNoPageErrors,
  assertSketchOnlyWasm,
  baseUrl,
  launchM3Browser,
  newDesktopPage,
  newTouchPage,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function waitFixture(page, fixture, entityCount) {
  await page.goto(`${baseUrl}/dev/part/${fixture}`, { waitUntil: 'networkidle' });
  await page.locator(`.cad-app[data-dev-fixture="${fixture}"][data-fixture-status="ready"]`).waitFor();
  return waitSolvedOverlay(page, entityCount, `${fixture} fixture`);
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
  await visual.waitFor({ state: 'attached' });
  const entityId = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(entityId, 'Sketch entity must expose stable entity ID');
  const point = await entityScreenPoint(visual);
  await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
  await page.locator(`[data-sketch-entity-id="${entityId}"].selected`).waitFor({ state: 'attached' });
  return { entityId, point };
}

async function desktopSelectionDelete(fixture, initialCount, deleteKey) {
  const { page, errors } = await newDesktopPage(browser);
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
    assertNoPageErrors(errors, fixture);
    console.log(`  ✓ ${fixture}: stable-ID select -> Esc -> select -> ${deleteKey}${fixture === 'line' ? ' -> Undo/Redo' : ''}`);
  } finally {
    await page.close();
  }
}

async function touchSelectionDelete() {
  const { context, page, errors } = await newTouchPage(browser);
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
    assertNoPageErrors(errors, 'touch selection/delete browser');
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
