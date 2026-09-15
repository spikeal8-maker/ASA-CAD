import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, assertVisibleTouchTarget,
  createMobileXYSketch, createXYSketch, interactionBox, launchM3Browser, newDesktopPage,
  newTouchPage, reopenFirstSketch, saveLocalDocument, shellUrl, squarePoint, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function createLine(page, from, to, touch, count) {
  if (touch) await activateMobileTool(page, 'sketch.line', 'Line');
  else await page.locator('.command-ribbon [data-command-id="sketch.line"]').click();
  const { box } = await interactionBox(page, 'line', 'Line');
  const a = squarePoint(box, ...from), b = squarePoint(box, ...to);
  if (touch) { await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y); }
  else { await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y); }
  await waitSolvedOverlay(page, count, `Line ${count}`);
  const lines = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]');
  const id = await lines.nth(count - 1).getAttribute('data-sketch-entity-id');
  assert.ok(id, `Line ${count} stable ID missing`);
  return id;
}

async function markerPoint(page, entityId, point) {
  const marker = page.locator(`[data-coincident-entity-id="${entityId}"][data-coincident-point="${point}"]`);
  await marker.waitFor({ state: 'attached' });
  return marker.evaluate((node) => {
    if (!(node instanceof SVGCircleElement)) throw new Error('Expected endpoint marker');
    const matrix = node.getScreenCTM();
    if (!matrix) throw new Error('Endpoint transform missing');
    const value = new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  });
}

async function solvedEndpoint(page, entityId, point) {
  const line = page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${entityId}"]`);
  return line.evaluate((node, endpoint) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line');
    return endpoint === 'a'
      ? [Number(node.getAttribute('x1')), Number(node.getAttribute('y1'))]
      : [Number(node.getAttribute('x2')), Number(node.getAttribute('y2'))];
  }, point);
}

const coincident = (a, b, tolerance = 1e-5) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;

async function createTwoLines(page, touch) {
  const first = await createLine(page, [0.18, 0.38], [0.40, 0.42], touch, 1);
  const second = await createLine(page, [0.64, 0.62], [0.84, 0.58], touch, 2);
  return { first, second };
}

async function chooseEndpoints(page, first, second, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.coincident"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-coincident-endpoint-count'), '4');
  const firstPoint = await markerPoint(page, first, 'b');
  if (touch) { await assertVisibleTouchTarget(page, firstPoint.x, firstPoint.y); await page.touchscreen.tap(firstPoint.x, firstPoint.y); }
  else await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.locator(`[data-coincident-entity-id="${first}"][data-coincident-point="b"][data-coincident-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-coincident-first'), `${first}:b`);
  const secondPoint = await markerPoint(page, second, 'a');
  if (touch) { await assertVisibleTouchTarget(page, secondPoint.x, secondPoint.y); await page.touchscreen.tap(secondPoint.x, secondPoint.y); }
  else await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.getByText('Совпадение применено', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 2, 'Coincident solve');
}

async function desktopCoincident() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const { first, second } = await createTwoLines(page, false);
    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), false, 'Lines must start separated');

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Совпадение');
    const action = page.locator('.command-search-results [data-command-id="constraint.coincident"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true, 'search Coincident must enable');
    await action.click();
    await chooseEndpoints(page, first, second, false);

    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), true, 'PlaneGCS Coincident failed');
    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'coincident');
    assert.ok(constraint, 'Coincident intent missing');
    assert.deepEqual(constraint.data.refs, [{ entityId: first, point: 'b' }, { entityId: second, point: 'a' }]);
    const constraintId = constraint.id;

    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Coincident undo');
    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), false, 'Undo failed');
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Coincident redo');
    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), true, 'Redo failed');

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Coincident reopen');
    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), true, 'Save/Open solve failed');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'coincident');
    assert.equal(reopenedConstraint?.id, constraintId, 'constraint ID changed');
    assert.deepEqual(reopenedConstraint?.data?.refs, constraint.data.refs, 'endpoint refs changed');
    await assertSketchOnlyWasm(page, 'desktop Coincident');
    assertNoPageErrors(errors, 'desktop Coincident');
    console.log('  ✓ desktop Coincident: solve -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchCoincident() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const { first, second } = await createTwoLines(page, true);
    await activateMobileTool(page, 'constraint.coincident', 'Coincident');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'Tools panel still covers Sketch');
    await chooseEndpoints(page, first, second, true);
    const saved = await saveLocalDocument(page);
    assert.ok(saved.constraints.some((item) => item.type === 'coincident'), 'touch Coincident not persisted');
    assert.equal(coincident(await solvedEndpoint(page, first, 'b'), await solvedEndpoint(page, second, 'a')), true, 'touch solve failed');
    await assertSketchOnlyWasm(page, 'touch Coincident');
    assertNoPageErrors(errors, 'touch Coincident');
    console.log('  ✓ touch Coincident: Tools close -> two visible endpoint taps');
  } finally { await context.close(); }
}

try {
  console.log('\nASA-CAD M3.7C Line endpoint Coincident browser');
  await desktopCoincident();
  await touchCoincident();
  console.log('ASA-CAD M3.7C Line endpoint Coincident browser PASS\n');
} finally { await browser.close(); }
