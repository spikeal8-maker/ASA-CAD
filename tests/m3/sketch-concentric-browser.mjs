import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, assertVisibleTouchTarget,
  createMobileXYSketch, createXYSketch, interactionBox, launchM3Browser,
  newDesktopPage, newTouchPage, reopenFirstSketch, saveLocalDocument, shellUrl, squarePoint,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function createCircle(page, touch, centerAt, edgeAt, count) {
  if (touch) await activateMobileTool(page, 'sketch.circle', 'Circle');
  else await page.locator('.command-ribbon [data-command-id="sketch.circle"]').click();
  const { box } = await interactionBox(page, 'circle', 'Circle');
  const center = squarePoint(box, ...centerAt), edge = squarePoint(box, ...edgeAt);
  if (touch) { await page.touchscreen.tap(center.x, center.y); await page.touchscreen.tap(edge.x, edge.y); }
  else { await page.mouse.click(center.x, center.y); await page.mouse.click(edge.x, edge.y); }
  const overlay = await waitSolvedOverlay(page, count, `Concentric Circle ${count}`);
  const id = await overlay.locator('circle[data-sketch-entity-id]').nth(count - 1).getAttribute('data-sketch-entity-id');
  assert.ok(id, `Circle ${count} stable ID missing`);
  return id;
}

async function createPair(page, touch) {
  const first = await createCircle(page, touch, [0.28, 0.42], [0.39, 0.42], 1);
  const second = await createCircle(page, touch, [0.68, 0.62], [0.75, 0.62], 2);
  return { first, second };
}

async function circleGeometry(page, id) {
  const circle = page.locator(`[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id="${id}"]`);
  return Promise.all(['cx', 'cy', 'r'].map((name) => circle.getAttribute(name))).then((values) => values.map(Number));
}

async function centersCoincident(page, first, second, tolerance = 1e-4) {
  const [a, b] = await Promise.all([circleGeometry(page, first), circleGeometry(page, second)]);
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

async function circleEdgePoint(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'Concentric Circle marker must be visible');
  return { x: box.x + box.width, y: box.y + box.height / 2 };
}

async function chooseCircles(page, first, second, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.concentric"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-concentric-circle-count'), '2');
  const firstMarker = page.locator(`[data-concentric-circle-id="${first}"]`);
  const firstPoint = await circleEdgePoint(firstMarker);
  if (touch) { await assertVisibleTouchTarget(page, firstPoint.x, firstPoint.y); await page.touchscreen.tap(firstPoint.x, firstPoint.y); }
  else await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.locator(`[data-concentric-circle-id="${first}"][data-concentric-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-concentric-first'), first);

  const secondPoint = await circleEdgePoint(page.locator(`[data-concentric-circle-id="${second}"]`));
  if (touch) { await assertVisibleTouchTarget(page, secondPoint.x, secondPoint.y); await page.touchscreen.tap(secondPoint.x, secondPoint.y); }
  else await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.getByText('Концентричность применена', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 2, 'Concentric solve');
}

async function desktopConcentric() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const { first, second } = await createPair(page, false);
    assert.equal(await centersCoincident(page, first, second), false, 'Circles must start non-concentric');
    const beforeA = await circleGeometry(page, first), beforeB = await circleGeometry(page, second);

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Концентр');
    const action = page.locator('.command-search-results [data-command-id="constraint.concentric"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true, 'search Concentric must enable');
    await action.click();
    await chooseCircles(page, first, second, false);
    assert.equal(await centersCoincident(page, first, second), true, 'PlaneGCS Concentric failed');
    const afterA = await circleGeometry(page, first), afterB = await circleGeometry(page, second);
    assert.ok(Math.abs(afterA[2] - beforeA[2]) < 1e-4, 'first radius changed');
    assert.ok(Math.abs(afterB[2] - beforeB[2]) < 1e-4, 'second radius changed');

    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'concentric');
    assert.ok(constraint, 'Concentric intent missing');
    const canonicalPair = [first, second].sort();
    assert.deepEqual(constraint.entityIds, canonicalPair, 'Concentric refs must persist canonically');
    const constraintId = constraint.id;

    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Concentric undo');
    assert.equal(await centersCoincident(page, first, second), false, 'Undo failed');
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Concentric redo');
    assert.equal(await centersCoincident(page, first, second), true, 'Redo failed');

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Concentric reopen');
    assert.equal(await centersCoincident(page, first, second), true, 'Save/Open solve failed');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'concentric');
    assert.equal(reopenedConstraint?.id, constraintId, 'constraint ID changed');
    assert.deepEqual(reopenedConstraint?.entityIds, canonicalPair, 'stable Concentric refs changed');
    await assertSketchOnlyWasm(page, 'desktop Concentric');
    assertNoPageErrors(errors, 'desktop Concentric');
    console.log('  ✓ desktop Concentric: search -> Circle/Circle solve -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchConcentric() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const { first, second } = await createPair(page, true);
    await activateMobileTool(page, 'constraint.concentric', 'Concentric');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'Tools panel still covers Sketch');
    await chooseCircles(page, first, second, true);
    const saved = await saveLocalDocument(page);
    assert.ok(saved.constraints.some((item) => item.type === 'concentric'), 'touch Concentric not persisted');
    assert.equal(await centersCoincident(page, first, second), true, 'touch Concentric solve failed');
    await assertSketchOnlyWasm(page, 'touch Concentric');
    assertNoPageErrors(errors, 'touch Concentric');
    console.log('  ✓ touch Concentric: Tools close -> two visible Circle taps -> solve');
  } finally { await context.close(); }
}

try {
  console.log('\nASA-CAD Concentric Circle-to-Circle browser');
  await desktopConcentric();
  await touchConcentric();
  console.log('ASA-CAD Concentric Circle-to-Circle browser PASS\n');
} finally { await browser.close(); }
