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

async function waitSolvedArc(page) {
  const overlay = await waitSolvedOverlay(page, 1, 'direct Arc');
  const arc = overlay.locator('path[data-sketch-entity-id]').first();
  await arc.waitFor();
  return arc;
}

async function deterministicArcFixture() {
  const { page, overlay } = await openFixture(browser, 'arc', 1);
  try {
    await page.getByText('Fixture arc: дуга R12 мм 0→90° в XY', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
    const path = await overlay.locator('path[data-sketch-entity-id]').first().getAttribute('d');
    assert.match(path, /^M\s+12(?:\.0+)?\s+0(?:\.0+)?\s+A\s+12(?:\.0+)?\s+12(?:\.0+)?\s+0\s+0\s+0\s+/, 'fixture Arc must keep the positive CAD CCW sweep on the intended circle');
    await assertSketchOnlyWasm(page, 'Arc fixture');
  } finally {
    await page.close();
  }
  console.log('  ✓ /dev/part/arc deterministic review fixture');
}

async function desktopDirectArc() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    await assertNoWasm(page, 'empty Sketch');

    const arcButton = page.locator('[data-command-id="sketch.arc"]').first();
    assert.equal(await arcButton.isEnabled(), true, 'Arc action must be enabled in active Sketch');
    await arcButton.click();
    await page.locator('.content-area.panel-closed').waitFor();

    const { layer, box } = await interactionBox(page, 'arc', 'Arc');
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
    await assertSketchOnlyWasm(page, 'direct Arc');

    await page.locator('[data-command-id="system.undo"]').click();
    await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedArc(page);

    const document = await saveLocalDocument(page);
    const entity = document.sketches[0]?.entities.find((item) => item.type === 'arc');
    assert.ok(entity, 'saved direct Arc entity missing');
    near(entity.data.center[0], 0, 0.8, 'saved center x');
    near(entity.data.center[1], 0, 0.8, 'saved center y');
    near(entity.data.radius, 12, 1.2, 'saved radius');
    near(entity.data.startAngle, 0, 0.12, 'saved start angle');
    near(entity.data.endAngle, Math.PI / 2, 0.12, 'saved end angle');

    await reopenFirstSketch(page, 1);
    await waitSolvedArc(page);
    assertNoPageErrors(errors, 'desktop direct Arc');
  } finally {
    await page.close();
  }
  console.log('  ✓ desktop Arc: center -> start -> guarded end -> sweep ghost -> one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectArc() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    await activateMobileTool(page, 'sketch.arc', 'Arc');

    const { box } = await interactionBox(page, 'arc', 'Arc');
    const center = squarePoint(box, 0.44, 0.50);
    const start = squarePoint(box, 0.60, 0.50);
    const end = squarePoint(box, 0.44, 0.34);
    await page.touchscreen.tap(center.x, center.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-start"]').waitFor();
    await page.touchscreen.tap(start.x, start.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-arc-phase="awaiting-end"]').waitFor();
    await page.touchscreen.tap(end.x, end.y);
    await waitSolvedArc(page);

    assertNoPageErrors(errors, 'touch direct Arc');
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
