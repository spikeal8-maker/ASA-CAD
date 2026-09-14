import assert from 'node:assert/strict';
import {
  activateMobileTool,
  assertNoPageErrors,
  assertNoWasm,
  assertSketchOnlyWasm,
  assertVisibleTouchTarget,
  createMobileXYSketch,
  createXYSketch,
  interactionBox,
  launchM3Browser,
  newDesktopPage,
  newTouchPage,
  reopenFirstSketch,
  saveLocalDocument,
  shellUrl,
  sketchViewState,
  squarePoint,
  twoFingerGesture,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function waitSolvedLine(page) {
  return waitSolvedOverlay(page, 1, 'direct Line');
}

async function desktopDirectLine() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    await assertNoWasm(page, 'empty Sketch');

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
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'direct drawing must collapse panel');

    const { layer, box } = await interactionBox(page, 'line', 'Line');
    assert.equal(await layer.getAttribute('data-line-phase'), 'awaiting-start');
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0');

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
    await assertSketchOnlyWasm(page, 'direct Line');

    await page.locator('[data-command-id="system.undo"]').click();
    await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedLine(page);

    await saveLocalDocument(page);
    await reopenFirstSketch(page, 1);
    assertNoPageErrors(errors, 'desktop direct Line');
  } finally {
    await page.close();
  }
  console.log('  ✓ desktop Line: ghost -> solver -> undo/redo -> save/reopen');
}

async function touchDirectLine() {
  const { context, page, errors } = await newTouchPage(browser);
  const client = await context.newCDPSession(page);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    await activateMobileTool(page, 'sketch.line', 'Line');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'mobile drawing must collapse bottom sheet');

    const { box } = await interactionBox(page, 'line', 'Line');
    const lowerWorkplane = squarePoint(box, 0.50, 0.78);
    await assertVisibleTouchTarget(page, lowerWorkplane.x, lowerWorkplane.y);

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

    assertNoPageErrors(errors, 'touch direct Line');
    console.log('  ✓ touch Line: pan/pinch navigate; taps commit one line');
  } finally {
    await context.close();
  }
}

async function deterministicLineFixture() {
  const { page } = await newDesktopPage(browser, { width: 1280, height: 720 });
  try {
    await page.goto(`${shellUrl}dev/part/line`, { waitUntil: 'networkidle' });
    await page.locator('.cad-app[data-dev-fixture="line"][data-fixture-status="ready"]').waitFor();
    await page.getByText('Fixture line: один прямой отрезок в XY', { exact: true }).waitFor();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedLine(page);
    assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
    assert.deepEqual(await sketchViewState(page), { span: 100, center: [0, 0] });
  } finally {
    await page.close();
  }
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
