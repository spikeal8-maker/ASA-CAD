import assert from 'node:assert/strict';
import {
  assertNoPageErrors,
  assertSketchOnlyWasm,
  baseUrl,
  launchM3Browser,
  newDesktopPage,
  newTouchPage,
  reopenFirstSketch,
  saveLocalDocument,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const cases = [
  ['line', 1],
  ['circle', 1],
  ['arc', 1],
  ['rectangle', 4],
];
const browser = await launchM3Browser();

async function openFixture(page, fixture, count) {
  await page.goto(`${baseUrl}/dev/part/${fixture}`, { waitUntil: 'networkidle' });
  await page.locator(`.cad-app[data-dev-fixture="${fixture}"][data-fixture-status="ready"]`).waitFor();
  const overlay = await waitSolvedOverlay(page, count, `${fixture} drag fixture`);
  const visual = overlay.locator('[data-sketch-entity-id]').first();
  await visual.waitFor({ state: 'attached' });
  const entityId = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(entityId, `${fixture}: stable entity ID missing`);
  return { visual, entityId };
}

async function entityScreenPoint(visual) {
  return visual.evaluate((node) => {
    if (!(node instanceof SVGGeometryElement)) throw new Error('Sketch entity is not SVGGeometryElement');
    const matrix = node.getScreenCTM();
    if (!matrix) throw new Error('Sketch entity has no screen transform');
    const local = node.getPointAtLength(node.getTotalLength() / 2);
    const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}

function entityPosition(document, entityId) {
  const entity = document.sketches.flatMap((sketch) => sketch.entities).find((item) => item.id === entityId);
  assert.ok(entity, `saved entity ${entityId} missing`);
  if (entity.type === 'line') return [...entity.data.from, ...entity.data.to];
  return [...entity.data.center];
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
    const { visual, entityId } = await openFixture(page, fixture, count);
    const before = await saveLocalDocument(page);
    const beforePosition = entityPosition(before, entityId);
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
      const afterCancel = await saveLocalDocument(page);
      assert.deepEqual(entityPosition(afterCancel, entityId), beforePosition, 'Esc drag cancel mutated persisted geometry');
      const refreshed = page.locator(`[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="${entityId}"]`).first();
      start = await selectWithMouse(page, refreshed, entityId);
    }

    await mouseDrag(page, entityId, start);
    const after = await saveLocalDocument(page);
    assert.equal(after.sketches.flatMap((sketch) => sketch.entities).some((item) => item.id === entityId), true);
    assert.notDeepEqual(entityPosition(after, entityId), beforePosition, `${fixture}: rigid drag did not move persisted entity`);

    if (fixture === 'line') {
      await page.locator('[data-command-id="system.undo"]').click();
      await page.waitForTimeout(100);
      const undoDoc = await saveLocalDocument(page);
      assert.deepEqual(entityPosition(undoDoc, entityId), beforePosition, 'Undo did not restore pre-drag line');
      await page.locator('[data-command-id="system.redo"]').click();
      await page.waitForTimeout(100);
      const redoDoc = await saveLocalDocument(page);
      assert.notDeepEqual(entityPosition(redoDoc, entityId), beforePosition, 'Redo did not restore dragged line');
    }

    await reopenFirstSketch(page, count);
    assert.equal(await page.locator(`[data-sketch-entity-id="${entityId}"]`).count() > 0, true, `${fixture}: stable ID lost after reopen`);
    await assertSketchOnlyWasm(page, `${fixture} rigid drag`);
    assertNoPageErrors(errors, `${fixture} desktop rigid drag`);
    console.log(`  ✓ desktop ${fixture}: selected stable-ID drag -> solver -> one commit -> save/reopen`);
  } finally {
    await page.close();
  }
}

async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({ ...point, radiusX: 4, radiusY: 4, force: 1, id: 1 })),
  });
}

async function touchCase(fixture, count) {
  const { context, page, errors } = await newTouchPage(browser);
  const client = await context.newCDPSession(page);
  try {
    const { visual, entityId } = await openFixture(page, fixture, count);
    const point = await entityScreenPoint(visual);
    await page.touchscreen.tap(point.x, point.y);
    await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
    await dispatchTouch(client, 'touchStart', [{ x: point.x, y: point.y }]);
    for (let step = 1; step <= 4; step++) {
      await dispatchTouch(client, 'touchMove', [{ x: point.x + step * 8, y: point.y - step * 5 }]);
    }
    await page.locator(`[data-testid="part-model-stage"][data-dragging-sketch-entity-id="${entityId}"]`).waitFor();
    await dispatchTouch(client, 'touchEnd', []);
    await page.getByText('Элемент эскиза перемещён', { exact: true }).waitFor();
    await assertSketchOnlyWasm(page, `${fixture} touch rigid drag`);
    assertNoPageErrors(errors, `${fixture} touch rigid drag`);
    console.log(`  ✓ touch ${fixture}: selected stable-ID one-finger rigid drag`);
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.6B rigid entity drag browser');
  for (const [fixture, count] of cases) await desktopCase(fixture, count, fixture === 'line');
  for (const [fixture, count] of cases) await touchCase(fixture, count);
  console.log('ASA-CAD M3.6B rigid entity drag browser PASS\n');
} finally {
  await browser.close();
}
