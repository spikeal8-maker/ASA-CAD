import assert from 'node:assert/strict';
import {
  assertNoPageErrors,
  assertSketchOnlyWasm,
  entityScreenPoint,
  launchM3Browser,
  loadFixture,
  newDesktopPage,
  newTouchPage,
  reopenFirstSketch,
  saveLocalDocument,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function selectLine(page, touch = false) {
  const visual = page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').first();
  await visual.waitFor({ state: 'attached' });
  const entityId = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(entityId, 'orientation constraint target must expose a stable entity ID');
  const point = await entityScreenPoint(visual);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
  return entityId;
}

async function solvedLine(page, entityId) {
  const line = page.locator(`[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="${entityId}"]`);
  await line.waitFor({ state: 'attached' });
  return line.evaluate((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line overlay');
    return {
      x1: Number(node.getAttribute('x1')),
      y1: Number(node.getAttribute('y1')),
      x2: Number(node.getAttribute('x2')),
      y2: Number(node.getAttribute('y2')),
    };
  });
}

function assertHorizontal(line, label) {
  assert.ok(Math.abs(line.y1 - line.y2) < 1e-5, `${label}: expected horizontal solved Line`);
  assert.ok(Math.abs(line.x1 - line.x2) > 1e-3, `${label}: horizontal Line collapsed unexpectedly`);
}

function assertVertical(line, label) {
  assert.ok(Math.abs(line.x1 - line.x2) < 1e-5, `${label}: expected vertical solved Line`);
  assert.ok(Math.abs(line.y1 - line.y2) > 1e-3, `${label}: vertical Line collapsed unexpectedly`);
}

async function desktopHorizontal() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const entityId = await selectLine(page);
    const app = page.locator('.cad-app');

    const horizontal = page.locator('[data-command-id="constraint.horizontal"]').first();
    const vertical = page.locator('[data-command-id="constraint.vertical"]').first();
    assert.equal(await horizontal.isEnabled(), true, 'desktop Horizontal action must enable for selected Line');
    assert.equal(await vertical.isEnabled(), true, 'desktop Vertical action must enable for selected Line');

    await horizontal.click();
    await page.getByText('Горизонтальность применена', { exact: true }).waitFor();
    await waitSolvedOverlay(page, 1, 'desktop Horizontal');
    assertHorizontal(await solvedLine(page, entityId), 'desktop Horizontal');
    assert.equal(await app.getAttribute('data-selected-sketch-entity-id'), entityId, 'constraint mutation must preserve selected stable ID');

    const saved = await saveLocalDocument(page);
    const persistedHorizontal = saved.constraints.find((constraint) => constraint.type === 'horizontal');
    assert.ok(persistedHorizontal, 'Save must persist Horizontal constraint intent');
    assert.deepEqual(persistedHorizontal.entityIds, [entityId]);
    const constraintId = persistedHorizontal.id;

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Horizontal undo');
    const undone = await solvedLine(page, entityId);
    assert.ok(Math.abs(undone.y1 - undone.y2) > 1e-3, 'Undo must remove Horizontal constraint effect');

    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Horizontal redo');
    assertHorizontal(await solvedLine(page, entityId), 'Horizontal redo');

    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Horizontal reopen');
    assertHorizontal(await solvedLine(page, entityId), 'Horizontal reopen');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedConstraint = reopened?.constraints?.find((constraint) => constraint.type === 'horizontal');
    assert.equal(reopenedConstraint?.id, constraintId, 'Save/Open must preserve the same constraint ID');
    assert.deepEqual(reopenedConstraint?.entityIds, [entityId], 'Save/Open must preserve stable entity reference');

    await assertSketchOnlyWasm(page, 'desktop Horizontal');
    assertNoPageErrors(errors, 'desktop Horizontal browser');
    console.log('  ✓ desktop: selected Line -> Horizontal -> Undo/Redo -> Save/Open');
  } finally {
    await page.close();
  }
}

async function touchVertical() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const entityId = await selectLine(page, true);

    await page.getByRole('button', { name: /Инструменты/ }).click();
    const tools = page.locator('[data-mobile-tools="true"]');
    await tools.waitFor();
    const vertical = tools.locator('[data-command-id="constraint.vertical"]');
    assert.equal(await vertical.isEnabled(), true, 'mobile Vertical action must use shared selected-Line enablement');
    await vertical.click();

    await page.getByText('Вертикальность применена', { exact: true }).waitFor();
    await waitSolvedOverlay(page, 1, 'touch Vertical');
    assertVertical(await solvedLine(page, entityId), 'touch Vertical');
    assert.equal(
      await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'),
      entityId,
      'touch constraint mutation must preserve selected stable ID',
    );

    await assertSketchOnlyWasm(page, 'touch Vertical');
    assertNoPageErrors(errors, 'touch Vertical browser');
    console.log('  ✓ touch: selected stable-ID Line -> shared mobile Vertical action');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.7A Sketch orientation constraints browser');
  await desktopHorizontal();
  await touchVertical();
  console.log('ASA-CAD M3.7A Sketch orientation constraints browser PASS\n');
} finally {
  await browser.close();
}
