import assert from 'node:assert/strict';
import {
  assertNoPageErrors,
  assertSketchOnlyWasm,
  dispatchTouch,
  entityScreenPoint,
  launchM3Browser,
  loadFixture,
  newDesktopPage,
  newTouchPage,
  reopenFirstSketch,
  saveLocalDocument,
} from './M3BrowserHarness.mjs';

const cases = [['line', 1], ['circle', 1], ['arc', 1], ['rectangle', 4]];
const browser = await launchM3Browser();

async function fixtureEntity(page, fixture, count) {
  const overlay = await loadFixture(page, fixture, count);
  const visual = overlay.locator('[data-sketch-entity-id]').first();
  await visual.waitFor({ state: 'attached' });
  const entityId = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(entityId, `${fixture}: stable entity ID missing`);
  return { visual, entityId };
}

function entityPosition(document, entityId) {
  const entity = document.sketches.flatMap((sketch) => sketch.entities).find((item) => item.id === entityId);
  assert.ok(entity, `saved entity ${entityId} missing`);
  return entity.type === 'line' ? [...entity.data.from, ...entity.data.to] : [...entity.data.center];
}

async function selectWithMouse(page, visual, entityId) {
  const point = await entityScreenPoint(visual);
  await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
  return point;
}

async function mouseDrag(page, entityId, start, dx = 36, dy = -24) {
  await page.locator('.cad-app').focus();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 });
  await page.locator(`[data-testid="part-model-stage"][data-dragging-sketch-entity-id="${entityId}"]`).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status') === 'solved');
  await page.mouse.up();
  await page.locator('[data-testid="part-model-stage"][data-dragging-sketch-entity-id=""]').waitFor();
  await page.getByText('Элемент эскиза перемещён', { exact: true }).waitFor();
}

async function desktopCase(fixture, count, testCancel = false) {
  const { page, errors } = await newDesktopPage(browser);
  try {
    const { visual, entityId } = await fixtureEntity(page, fixture, count);
    const beforePosition = entityPosition(await saveLocalDocument(page), entityId);
    let start = await selectWithMouse(page, visual, entityId);

    if (testCancel) {
      await page.locator('.cad-app').focus();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 28, start.y + 18, { steps: 4 });
      await page.locator(`[data-testid="part-model-stage"][data-dragging-sketch-entity-id="${entityId}"]`).waitFor();
      await page.keyboard.press('Escape');
      await page.locator('[data-testid="part-model-stage"][data-dragging-sketch-entity-id=""]').waitFor();
      await page.mouse.up();
      assert.deepEqual(entityPosition(await saveLocalDocument(page), entityId), beforePosition, 'Esc drag cancel mutated persisted geometry');
      start = await selectWithMouse(page, page.locator(`[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="${entityId}"]`).first(), entityId);
    }

    await mouseDrag(page, entityId, start);
    const after = await saveLocalDocument(page);
    assert.notDeepEqual(entityPosition(after, entityId), beforePosition, `${fixture}: drag did not move persisted entity`);

    if (fixture === 'line') {
      await page.locator('[data-command-id="system.undo"]').click();
      await page.waitForTimeout(100);
      assert.deepEqual(entityPosition(await saveLocalDocument(page), entityId), beforePosition, 'Undo did not restore line');
      await page.locator('[data-command-id="system.redo"]').click();
      await page.waitForTimeout(100);
      assert.notDeepEqual(entityPosition(await saveLocalDocument(page), entityId), beforePosition, 'Redo did not restore drag');
    }

    await reopenFirstSketch(page, count);
    assert.ok(await page.locator(`[data-sketch-entity-id="${entityId}"]`).count(), `${fixture}: stable ID lost after reopen`);
    await assertSketchOnlyWasm(page, `${fixture} rigid drag`);
    assertNoPageErrors(errors, `${fixture} desktop rigid drag`);
    console.log(`  ✓ desktop ${fixture}: selected stable-ID drag -> solver -> one commit -> save/reopen`);
  } finally { await page.close(); }
}

async function selectedTouchPoint(page, entityId) {
  const target = page.locator(`[data-sketch-select-id="${entityId}"]`).first();
  await target.waitFor({ state: 'attached' });
  const point = await entityScreenPoint(target);
  const hitId = await page.evaluate(({ x, y }) => (
    document.elementFromPoint(x, y)?.closest?.('[data-sketch-select-id]')?.getAttribute('data-sketch-select-id') ?? null
  ), point);
  assert.equal(hitId, entityId, `selected touch target ${entityId} is not topmost at drag start`);
  return point;
}

async function touchCase(fixture, count) {
  const { context, page, errors } = await newTouchPage(browser);
  const client = await context.newCDPSession(page);
  try {
    const { visual, entityId } = await fixtureEntity(page, fixture, count);
    const selectPoint = await entityScreenPoint(visual);
    await page.touchscreen.tap(selectPoint.x, selectPoint.y);
    await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();

    const point = await selectedTouchPoint(page, entityId);
    const dragging = page.locator(`[data-testid="part-model-stage"][data-dragging-sketch-entity-id="${entityId}"]`);
    await dispatchTouch(client, 'touchStart', [{ x: point.x, y: point.y }]);
    await dragging.waitFor({ timeout: 5_000 });
    for (let step = 1; step <= 4; step++) {
      await dispatchTouch(client, 'touchMove', [{ x: point.x + step * 8, y: point.y - step * 5 }]);
    }
    await dragging.waitFor();
    await dispatchTouch(client, 'touchEnd', []);
    await page.getByText('Элемент эскиза перемещён', { exact: true }).waitFor();
    await assertSketchOnlyWasm(page, `${fixture} touch rigid drag`);
    assertNoPageErrors(errors, `${fixture} touch rigid drag`);
    console.log(`  ✓ touch ${fixture}: selected stable-ID rigid drag`);
  } finally { await context.close(); }
}

try {
  console.log('\nASA-CAD M3.6B rigid entity drag browser');
  for (const [fixture, count] of cases) await desktopCase(fixture, count, fixture === 'line');
  for (const [fixture, count] of cases) await touchCase(fixture, count);
  console.log('ASA-CAD M3.6B rigid entity drag browser PASS\n');
} finally { await browser.close(); }
