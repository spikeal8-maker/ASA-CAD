import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, assertVisibleTouchTarget,
  createMobileXYSketch, createXYSketch, entityScreenPoint, interactionBox, launchM3Browser,
  newDesktopPage, newTouchPage, reopenFirstSketch, saveLocalDocument, shellUrl, squarePoint,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function createLine(page, touch) {
  if (touch) await activateMobileTool(page, 'sketch.line', 'Line');
  else await page.locator('.command-ribbon [data-command-id="sketch.line"]').click();
  const { box } = await interactionBox(page, 'line', 'Line');
  const a = squarePoint(box, 0.18, 0.36), b = squarePoint(box, 0.68, 0.43);
  if (touch) { await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y); }
  else { await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y); }
  const overlay = await waitSolvedOverlay(page, 1, 'Tangent Line');
  const id = await overlay.locator('line[data-sketch-entity-id]').getAttribute('data-sketch-entity-id');
  assert.ok(id, 'Tangent Line stable ID missing');
  return id;
}

async function createCircle(page, touch) {
  if (touch) await activateMobileTool(page, 'sketch.circle', 'Circle');
  else await page.locator('.command-ribbon [data-command-id="sketch.circle"]').click();
  const { box } = await interactionBox(page, 'circle', 'Circle');
  const center = squarePoint(box, 0.58, 0.68), edge = squarePoint(box, 0.69, 0.68);
  if (touch) { await page.touchscreen.tap(center.x, center.y); await page.touchscreen.tap(edge.x, edge.y); }
  else { await page.mouse.click(center.x, center.y); await page.mouse.click(edge.x, edge.y); }
  const overlay = await waitSolvedOverlay(page, 2, 'Tangent Circle');
  const id = await overlay.locator('circle[data-sketch-entity-id]').getAttribute('data-sketch-entity-id');
  assert.ok(id, 'Tangent Circle stable ID missing');
  return id;
}

async function tangentGeometry(page, lineId, circleId) {
  const overlay = page.locator('[data-testid="cad-sketch-overlay"]');
  const line = overlay.locator(`line[data-sketch-entity-id="${lineId}"]`);
  const circle = overlay.locator(`circle[data-sketch-entity-id="${circleId}"]`);
  const [x1, y1, x2, y2, cx, cy, r] = await Promise.all([
    line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2'),
    circle.getAttribute('cx'), circle.getAttribute('cy'), circle.getAttribute('r'),
  ]).then((values) => values.map(Number));
  const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
  if (length <= 1e-8) return false;
  const distance = Math.abs(dy * cx - dx * cy + x2 * y1 - y2 * x1) / length;
  return Math.abs(distance - r) <= 1e-4;
}

async function chooseLineCircle(page, lineId, circleId, touch) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="constraint.tangent"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-tangent-line-count'), '1');
  assert.equal(await surface.getAttribute('data-tangent-circle-count'), '1');
  const circlePoint = await entityScreenPoint(page.locator(`[data-tangent-circle-id="${circleId}"]`));
  if (touch) { await assertVisibleTouchTarget(page, circlePoint.x, circlePoint.y); await page.touchscreen.tap(circlePoint.x, circlePoint.y); }
  else await page.mouse.click(circlePoint.x, circlePoint.y);
  await page.locator(`[data-tangent-circle-id="${circleId}"][data-tangent-selected="true"]`).waitFor();
  assert.equal(await surface.getAttribute('data-tangent-first'), `circle:${circleId}`);
  const linePoint = await entityScreenPoint(page.locator(`[data-tangent-line-id="${lineId}"]`));
  if (touch) { await assertVisibleTouchTarget(page, linePoint.x, linePoint.y); await page.touchscreen.tap(linePoint.x, linePoint.y); }
  else await page.mouse.click(linePoint.x, linePoint.y);
  await page.getByText('Касательность применена', { exact: true }).waitFor();
  await surface.waitFor({ state: 'detached' });
  await waitSolvedOverlay(page, 2, 'Tangent solve');
}

async function desktopTangent() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const lineId = await createLine(page, false), circleId = await createCircle(page, false);
    assert.equal(await tangentGeometry(page, lineId, circleId), false, 'Line/Circle must start non-tangent');

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Касание');
    const action = page.locator('.command-search-results [data-command-id="constraint.tangent"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), true, 'search Tangent must enable');
    await action.click();
    await chooseLineCircle(page, lineId, circleId, false);
    assert.equal(await tangentGeometry(page, lineId, circleId), true, 'PlaneGCS Tangent failed');

    const saved = await saveLocalDocument(page);
    const constraint = saved.constraints.find((item) => item.type === 'tangent');
    assert.ok(constraint, 'Tangent intent missing');
    assert.deepEqual(constraint.entityIds, [lineId, circleId], 'Tangent must persist canonical Line/Circle refs');
    const constraintId = constraint.id;

    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Tangent undo');
    assert.equal(await tangentGeometry(page, lineId, circleId), false, 'Undo failed');
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Tangent redo');
    assert.equal(await tangentGeometry(page, lineId, circleId), true, 'Redo failed');

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Tangent reopen');
    assert.equal(await tangentGeometry(page, lineId, circleId), true, 'Save/Open solve failed');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened.constraints.find((item) => item.type === 'tangent');
    assert.equal(reopenedConstraint?.id, constraintId, 'constraint ID changed');
    assert.deepEqual(reopenedConstraint?.entityIds, [lineId, circleId], 'stable Tangent refs changed');
    await assertSketchOnlyWasm(page, 'desktop Tangent');
    assertNoPageErrors(errors, 'desktop Tangent');
    console.log('  ✓ desktop Tangent: search -> Line/Circle solve -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchTangent() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const lineId = await createLine(page, true), circleId = await createCircle(page, true);
    await activateMobileTool(page, 'constraint.tangent', 'Tangent');
    await page.locator('.content-area.panel-closed').waitFor();
    assert.equal(await page.locator('.management-panel').isVisible(), false, 'Tools panel still covers Sketch');
    await chooseLineCircle(page, lineId, circleId, true);
    const saved = await saveLocalDocument(page);
    assert.ok(saved.constraints.some((item) => item.type === 'tangent'), 'touch Tangent not persisted');
    assert.equal(await tangentGeometry(page, lineId, circleId), true, 'touch Tangent solve failed');
    await assertSketchOnlyWasm(page, 'touch Tangent');
    assertNoPageErrors(errors, 'touch Tangent');
    console.log('  ✓ touch Tangent: Tools close -> visible Circle/Line taps -> solve');
  } finally { await context.close(); }
}

try {
  console.log('\nASA-CAD Tangent Line-to-Circle browser');
  await desktopTangent();
  await touchTangent();
  console.log('ASA-CAD Tangent Line-to-Circle browser PASS\n');
} finally { await browser.close(); }
