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
  const source = await createLine(page, [0.18, 0.30], [0.36, 0.43], touch, 1);
  const target = await createLine(page, [0.22, 0.70], [0.82, 0.70], touch, 2);
  return { source, target };
}
async function lineGeom(page, entityId) {
  return page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${entityId}"]`).evaluate((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line');
    return [Number(node.getAttribute('x1')), Number(node.getAttribute('y1')), Number(node.getAttribute('x2')), Number(node.getAttribute('y2'))];
  });
}

function endpoint(line, point) { return point === 'a' ? line.slice(0, 2) : line.slice(2, 4); }
function pointLineDistance(point, line) {
  const dx = line[2] - line[0], dy = line[3] - line[1], n = Math.hypot(dx, dy) || 1;
  return Math.abs((point[0] - line[0]) * dy - (point[1] - line[1]) * dx) / n;
}
async function onTarget(page, source, target, point = 'a', tolerance = 1e-4) {
  return pointLineDistance(endpoint(await lineGeom(page, source), point), await lineGeom(page, target)) <= tolerance;
}

async function tapOrClick(page, locator, touch) {
  const point = await entityScreenPoint(locator);
  if (touch) { await assertVisibleTouchTarget(page, point.x, point.y); await page.touchscreen.tap(point.x, point.y); }
  else await page.mouse.click(point.x, point.y);
}

async function choosePointOnCurve(page, source, target, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.pointOnCurve"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-point-on-curve-phase'), 'endpoint');
  const sourceMark = page.locator(`[data-point-on-curve-endpoint="${source}:a"]`);
  await tapOrClick(page, sourceMark, touch);
  await page.locator(`[data-point-on-curve-endpoint="${source}:a"][data-point-on-curve-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-point-on-curve-phase'), 'target-line');
  const targetLine = page.locator(`[data-point-on-curve-target-id="${target}"][data-point-on-curve-target-valid="true"]`);
  await tapOrClick(page, targetLine, touch);
  await page.getByText('Точка на кривой применена', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 2, 'Point-on-curve solve');
}

async function desktopPointOnCurve() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const { source, target } = await createTwoLines(page, false);
    assert.equal(await onTarget(page, source, target), false);

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Точка');
    const action = page.locator('.command-search-results [data-command-id="constraint.pointOnCurve"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await choosePointOnCurve(page, source, target, false);
    assert.equal(await onTarget(page, source, target), true);

    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'pointOnCurve');
    assert.ok(constraint);
    assert.deepEqual(constraint.data.source, { entityId: source, point: 'a' });
    assert.deepEqual(constraint.entityIds, [source, target]);
    const constraintId = constraint.id;
    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Point-on-curve undo');
    assert.equal(await onTarget(page, source, target), false);
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Point-on-curve redo');
    assert.equal(await onTarget(page, source, target), true);

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Point-on-curve reopen');
    assert.equal(await onTarget(page, source, target), true);
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'pointOnCurve');
    assert.equal(reopenedConstraint?.id, constraintId);
    assert.deepEqual(reopenedConstraint?.data.source, { entityId: source, point: 'a' });
    assert.deepEqual(reopenedConstraint?.entityIds, [source, target]);
    await assertSketchOnlyWasm(page, 'desktop Point-on-curve');
    assertNoPageErrors(errors, 'desktop Point-on-curve');
    console.log('  ✓ desktop Point-on-curve: search -> endpoint -> target Line -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchPointOnCurve() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const { source, target } = await createTwoLines(page, true);
    await activateMobileTool(page, 'constraint.pointOnCurve', 'Point-on-curve');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false);
    await choosePointOnCurve(page, source, target, true);
    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'pointOnCurve');
    assert.ok(constraint);
    assert.deepEqual(constraint.data.source, { entityId: source, point: 'a' });
    assert.deepEqual(constraint.entityIds, [source, target]);
    assert.equal(await onTarget(page, source, target), true);
    await assertSketchOnlyWasm(page, 'touch Point-on-curve');
    assertNoPageErrors(errors, 'touch Point-on-curve');
    console.log('  ✓ touch Point-on-curve: Tools close -> endpoint tap -> target Line tap');
  } finally { await context.close(); }
}

try {
  await desktopPointOnCurve();
  await touchPointOnCurve();
  console.log('ASA-CAD Point-on-curve browser PASS');
} finally { await browser.close(); }
