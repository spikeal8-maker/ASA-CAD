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

async function createThreeLines(page, touch) {
  const first = await createLine(page, [0.18, 0.34], [0.34, 0.42], touch, 1);
  const second = await createLine(page, [0.66, 0.58], [0.82, 0.66], touch, 2);
  const axis = await createLine(page, [0.50, 0.18], [0.50, 0.82], touch, 3);
  return { first, second, axis };
}

async function lineGeom(page, entityId) {
  return page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${entityId}"]`).evaluate((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line');
    return [Number(node.getAttribute('x1')), Number(node.getAttribute('y1')), Number(node.getAttribute('x2')), Number(node.getAttribute('y2'))];
  });
}

function linePoint(line, point) { return point === 'a' ? line.slice(0, 2) : line.slice(2, 4); }
function symmetryResidual(p1, p2, axis) {
  const dx = axis[2] - axis[0], dy = axis[3] - axis[1], n = Math.hypot(dx, dy) || 1;
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
  return {
    midpoint: Math.abs((mx - axis[0]) * dy - (my - axis[1]) * dx) / n,
    perpendicular: Math.abs((p1[0] - p2[0]) * dx + (p1[1] - p2[1]) * dy) / n,
  };
}

async function symmetric(page, first, second, axis, tolerance = 1e-4) {
  const residual = symmetryResidual(linePoint(await lineGeom(page, first), 'b'), linePoint(await lineGeom(page, second), 'a'), await lineGeom(page, axis));
  return residual.midpoint <= tolerance && residual.perpendicular <= tolerance;
}

async function tapOrClick(page, locator, touch) {
  const point = await entityScreenPoint(locator);
  if (touch) { await assertVisibleTouchTarget(page, point.x, point.y); await page.touchscreen.tap(point.x, point.y); }
  else await page.mouse.click(point.x, point.y);
}

async function chooseSymmetry(page, first, second, axis, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.symmetric"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-symmetry-phase'), 'first-endpoint');
  const firstMark = page.locator(`[data-symmetry-endpoint="${first}:b"]`);
  await tapOrClick(page, firstMark, touch);
  await page.locator(`[data-symmetry-endpoint="${first}:b"][data-symmetry-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-symmetry-phase'), 'second-endpoint');

  const secondMark = page.locator(`[data-symmetry-endpoint="${second}:a"]`);
  await tapOrClick(page, secondMark, touch);
  await page.locator(`[data-symmetry-endpoint="${second}:a"][data-symmetry-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-symmetry-phase'), 'axis');

  const axisLine = page.locator(`[data-symmetry-axis-id="${axis}"][data-symmetry-axis-valid="true"]`);
  await tapOrClick(page, axisLine, touch);
  await page.getByText('Симметрия применена', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 3, 'Symmetry solve');
}

function endpointKeys(constraint) {
  return constraint.data.refs.map((ref) => `${ref.entityId}:${ref.point}`).sort();
}

async function desktopSymmetry() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const { first, second, axis } = await createThreeLines(page, false);
    assert.equal(await symmetric(page, first, second, axis), false);

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Симмет');
    const action = page.locator('.command-search-results [data-command-id="constraint.symmetric"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await chooseSymmetry(page, first, second, axis, false);
    assert.equal(await symmetric(page, first, second, axis), true);

    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'symmetric');
    assert.ok(constraint);
    assert.deepEqual(endpointKeys(constraint), [`${first}:b`, `${second}:a`].sort());
    assert.equal(constraint.entityIds[2], axis);
    const constraintId = constraint.id;

    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 3, 'Symmetry undo');
    assert.equal(await symmetric(page, first, second, axis), false);
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 3, 'Symmetry redo');
    assert.equal(await symmetric(page, first, second, axis), true);

    await reopenFirstSketch(page, 3);
    await waitSolvedOverlay(page, 3, 'Symmetry reopen');
    assert.equal(await symmetric(page, first, second, axis), true);
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'symmetric');
    assert.equal(reopenedConstraint?.id, constraintId);
    assert.deepEqual(endpointKeys(reopenedConstraint), [`${first}:b`, `${second}:a`].sort());
    assert.equal(reopenedConstraint?.entityIds[2], axis);
    await assertSketchOnlyWasm(page, 'desktop Symmetry');
    assertNoPageErrors(errors, 'desktop Symmetry');
    console.log('  ✓ desktop Symmetry: search -> endpoints -> axis -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchSymmetry() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const { first, second, axis } = await createThreeLines(page, true);
    await activateMobileTool(page, 'constraint.symmetric', 'Symmetry');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false);
    await chooseSymmetry(page, first, second, axis, true);
    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'symmetric');
    assert.ok(constraint);
    assert.deepEqual(endpointKeys(constraint), [`${first}:b`, `${second}:a`].sort());
    assert.equal(constraint.entityIds[2], axis);
    assert.equal(await symmetric(page, first, second, axis), true);
    await assertSketchOnlyWasm(page, 'touch Symmetry');
    assertNoPageErrors(errors, 'touch Symmetry');
    console.log('  ✓ touch Symmetry: Tools close -> two endpoint taps -> axis tap');
  } finally { await context.close(); }
}

try {
  await desktopSymmetry();
  await touchSymmetry();
  console.log('ASA-CAD Symmetry browser PASS');
} finally { await browser.close(); }
