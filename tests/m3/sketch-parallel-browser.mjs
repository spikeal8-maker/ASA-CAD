import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, assertVisibleTouchTarget,
  createMobileXYSketch, createXYSketch, entityScreenPoint, interactionBox, launchM3Browser,
  newDesktopPage, newTouchPage, reopenFirstSketch, saveLocalDocument, shellUrl, squarePoint,
  waitSolvedOverlay,
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
  const id = await page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]').nth(count - 1).getAttribute('data-sketch-entity-id');
  assert.ok(id, `Line ${count} stable ID missing`);
  return id;
}

async function createTwoLines(page, touch) {
  const first = await createLine(page, [0.18, 0.36], [0.42, 0.42], touch, 1);
  const second = await createLine(page, [0.60, 0.64], [0.84, 0.48], touch, 2);
  return { first, second };
}

async function lineVector(page, entityId) {
  return page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${entityId}"]`).evaluate((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line');
    return [Number(node.getAttribute('x2')) - Number(node.getAttribute('x1')), Number(node.getAttribute('y2')) - Number(node.getAttribute('y1'))];
  });
}

function parallel(a, b, tolerance = 1e-5) {
  const scale = Math.hypot(...a) * Math.hypot(...b);
  return scale > 0 && Math.abs(a[0] * b[1] - a[1] * b[0]) / scale <= tolerance;
}

async function chooseLines(page, first, second, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.parallel"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-parallel-line-count'), '2');
  const firstPoint = await entityScreenPoint(page.locator(`[data-parallel-line-id="${first}"]`));
  if (touch) { await assertVisibleTouchTarget(page, firstPoint.x, firstPoint.y); await page.touchscreen.tap(firstPoint.x, firstPoint.y); }
  else await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.locator(`[data-parallel-line-id="${first}"][data-parallel-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-parallel-first'), first);
  const secondPoint = await entityScreenPoint(page.locator(`[data-parallel-line-id="${second}"]`));
  if (touch) { await assertVisibleTouchTarget(page, secondPoint.x, secondPoint.y); await page.touchscreen.tap(secondPoint.x, secondPoint.y); }
  else await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.getByText('Параллельность применена', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 2, 'Parallel solve');
}

async function desktopParallel() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const { first, second } = await createTwoLines(page, false);
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), false, 'Lines must start non-parallel');

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Паралл');
    const action = page.locator('.command-search-results [data-command-id="constraint.parallel"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true, 'search Parallel must enable');
    await action.click();
    await chooseLines(page, first, second, false);
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), true, 'PlaneGCS Parallel failed');

    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'parallel');
    assert.ok(constraint, 'Parallel intent missing');
    assert.deepEqual(constraint.entityIds, [first, second]);
    const constraintId = constraint.id;

    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Parallel undo');
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), false, 'Undo failed');
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Parallel redo');
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), true, 'Redo failed');

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Parallel reopen');
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), true, 'Save/Open solve failed');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'parallel');
    assert.equal(reopenedConstraint?.id, constraintId, 'constraint ID changed');
    assert.deepEqual(reopenedConstraint?.entityIds, [first, second], 'Line refs changed');
    await assertSketchOnlyWasm(page, 'desktop Parallel');
    assertNoPageErrors(errors, 'desktop Parallel');
    console.log('  ✓ desktop Parallel: search -> solve -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchParallel() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const { first, second } = await createTwoLines(page, true);
    await activateMobileTool(page, 'constraint.parallel', 'Parallel');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'Tools panel still covers Sketch');
    await chooseLines(page, first, second, true);
    const saved = await saveLocalDocument(page);
    assert.ok(saved.constraints.some((item) => item.type === 'parallel'), 'touch Parallel not persisted');
    assert.equal(parallel(await lineVector(page, first), await lineVector(page, second)), true, 'touch solve failed');
    await assertSketchOnlyWasm(page, 'touch Parallel');
    assertNoPageErrors(errors, 'touch Parallel');
    console.log('  ✓ touch Parallel: Tools close -> two visible Line taps');
  } finally { await context.close(); }
}

try {
  console.log('\nASA-CAD M3.7D Line-to-Line Parallel browser');
  await desktopParallel();
  await touchParallel();
  console.log('ASA-CAD M3.7D Line-to-Line Parallel browser PASS\n');
} finally { await browser.close(); }
