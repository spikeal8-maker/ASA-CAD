import assert from 'node:assert/strict';
import {
  activateMobileTool,
  assertNoPageErrors,
  assertNoWasm,
  assertSketchOnlyWasm,
  createMobileXYSketch,
  createXYSketch,
  interactionBox,
  launchM3Browser,
  near,
  newDesktopPage,
  newTouchPage,
  openFixture,
  reopenFirstSketch,
  saveLocalDocument,
  shellUrl,
  squarePoint,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function waitSolvedCircle(page) {
  const overlay = await waitSolvedOverlay(page, 1, 'direct Circle');
  return overlay.locator('circle[data-sketch-entity-id]').first();
}

async function deterministicCircleFixture() {
  const { page, overlay } = await openFixture(browser, 'circle', 1);
  try {
    await page.getByText('Fixture circle: окружность Ø24 мм с центром (5, -3) в XY', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
    const circle = overlay.locator('circle[data-sketch-entity-id]').first();
    near(Number(await circle.getAttribute('cx')), 5, 0.2, 'fixture center x');
    near(Number(await circle.getAttribute('cy')), 3, 0.2, 'fixture center y');
    near(Number(await circle.getAttribute('r')), 12, 0.2, 'fixture radius');
    await assertSketchOnlyWasm(page, 'Circle fixture');
  } finally {
    await page.close();
  }
  console.log('  ✓ /dev/part/circle deterministic review fixture');
}

async function desktopDirectCircle() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    await assertNoWasm(page, 'empty Sketch');

    const circleButton = page.locator('[data-command-id="sketch.circle"]').first();
    assert.equal(await circleButton.isEnabled(), true, 'Circle action must be enabled in active Sketch');
    await circleButton.click();
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'direct Circle must collapse management panel');

    const { layer, box } = await interactionBox(page, 'circle', 'Circle');
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
    await assertSketchOnlyWasm(page, 'direct Circle');

    await page.locator('[data-command-id="system.undo"]').click();
    await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedCircle(page);

    const document = await saveLocalDocument(page);
    const entity = document.sketches[0]?.entities.find((item) => item.type === 'circle');
    assert.ok(entity, 'saved direct Circle entity missing');
    near(entity.data.center[0], 0, 0.8, 'saved center x');
    near(entity.data.center[1], 0, 0.8, 'saved center y');
    near(entity.data.diameter, 24, 1.2, 'saved diameter');
    assert.equal(document.dimensions.length, 0, 'direct Circle must not silently create a driving dimension');

    await reopenFirstSketch(page, 1);
    assertNoPageErrors(errors, 'desktop direct Circle');
  } finally {
    await page.close();
  }
  console.log('  ✓ desktop Circle: center -> radius ghost -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectCircle() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    await activateMobileTool(page, 'sketch.circle', 'Circle');
    await page.locator('.content-area.panel-closed').waitFor();

    const { box } = await interactionBox(page, 'circle', 'Circle');
    const center = squarePoint(box, 0.44, 0.46);
    const edge = squarePoint(box, 0.60, 0.46);
    await page.touchscreen.tap(center.x, center.y);
    await page.locator('[data-testid="sketch-circle-center"]').waitFor();
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');
    await page.touchscreen.tap(edge.x, edge.y);
    await waitSolvedCircle(page);

    assertNoPageErrors(errors, 'touch direct Circle');
    console.log('  ✓ touch Circle: shared single-tap surface commits center/radius without desktop DOM delegation');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.3 direct Circle browser');
  await deterministicCircleFixture();
  await desktopDirectCircle();
  await touchDirectCircle();
  console.log('ASA-CAD M3.3 direct Circle browser PASS\n');
} finally {
  await browser.close();
}
