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
  assert.ok(entityId, 'Fixed target must expose a stable entity ID');
  const point = await entityScreenPoint(visual);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${entityId}"]`).waitFor();
  return entityId;
}

function savedLine(document, entityId) {
  const entity = document.sketches.flatMap((sketch) => sketch.entities).find((item) => item.id === entityId);
  assert.ok(entity && entity.type === 'line', `saved Line ${entityId} missing`);
  return entity;
}

async function desktopFixedAfterHorizontal() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const entityId = await selectLine(page);

    const horizontal = page.locator('.command-ribbon [data-command-id="constraint.horizontal"]');
    assert.equal(await horizontal.isEnabled(), true, 'Horizontal must be enabled for selected Line');
    await horizontal.click();
    await page.getByText('Горизонтальность применена', { exact: true }).waitFor();
    await waitSolvedOverlay(page, 1, 'pre-Fixed Horizontal solve');

    const fixedRibbon = page.locator('.command-ribbon [data-command-id="constraint.fixed"]');
    assert.equal(await fixedRibbon.isEnabled(), true, 'Fixed ribbon action must enable for selected unfixed Line');

    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Фиксация');
    const fixedSearch = page.locator('.command-search-results [data-command-id="constraint.fixed"]');
    await fixedSearch.waitFor();
    assert.equal(await fixedSearch.isEnabled(), true, 'search must expose the same enabled Fixed CadUiAction');
    await fixedSearch.click();

    await page.getByText('Отрезок зафиксирован', { exact: true }).waitFor();
    await waitSolvedOverlay(page, 1, 'Fixed after Horizontal');
    assert.equal(
      await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'),
      entityId,
      'Fixed must preserve selected stable entity ID',
    );

    const saved = await saveLocalDocument(page);
    const line = savedLine(saved, entityId);
    assert.ok(Math.abs(line.data.from[1] - line.data.to[1]) < 1e-6, 'Fixed must persist solved Horizontal geometry, not stale diagonal DTO');
    const horizontalConstraint = saved.constraints.find((constraint) => constraint.type === 'horizontal' && constraint.entityIds[0] === entityId);
    const fixedConstraint = saved.constraints.find((constraint) => constraint.type === 'fixed' && constraint.entityIds[0] === entityId);
    assert.ok(horizontalConstraint, 'Fixed must preserve Horizontal intent');
    assert.ok(fixedConstraint, 'Fixed constraint must be persisted');
    const fixedId = fixedConstraint.id;

    assert.equal(await fixedRibbon.isEnabled(), false, 'duplicate Fixed must be disabled by shared UI state');

    const selectedTarget = page.locator(`[data-sketch-select-id="${entityId}"]`).first();
    await selectedTarget.waitFor({ state: 'attached' });
    const dragPoint = await entityScreenPoint(selectedTarget);
    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x + 30, dragPoint.y - 20, { steps: 3 });
    await page.getByText('Зафиксированный элемент нельзя перемещать', { exact: true }).waitFor();
    assert.equal(
      await page.locator('[data-testid="part-model-stage"]').getAttribute('data-dragging-sketch-entity-id'),
      '',
      'Fixed Line must never enter transient drag state',
    );
    await page.mouse.up();

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Fixed undo');
    await selectLine(page);
    assert.equal(await page.locator('.command-ribbon [data-command-id="constraint.fixed"]').isEnabled(), true, 'one Undo must remove the atomic Fixed mutation');

    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Fixed redo');
    await selectLine(page);
    assert.equal(await page.locator('.command-ribbon [data-command-id="constraint.fixed"]').isEnabled(), false, 'Redo must restore Fixed state');

    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Fixed reopen');
    await selectLine(page);
    assert.equal(await page.locator('.command-ribbon [data-command-id="constraint.fixed"]').isEnabled(), false, 'Save/Open must restore Fixed enablement state');
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
    const reopenedFixed = reopened?.constraints?.find((constraint) => constraint.type === 'fixed' && constraint.entityIds[0] === entityId);
    assert.equal(reopenedFixed?.id, fixedId, 'Save/Open must preserve the same Fixed constraint ID');
    const reopenedLine = savedLine(reopened, entityId);
    assert.ok(Math.abs(reopenedLine.data.from[1] - reopenedLine.data.to[1]) < 1e-6, 'Save/Open must preserve frozen solved geometry');

    await assertSketchOnlyWasm(page, 'desktop Fixed freeze');
    assertNoPageErrors(errors, 'desktop Fixed freeze browser');
    console.log('  ✓ desktop: Horizontal solved Line -> search Fixed -> atomic freeze -> drag reject -> Undo/Redo -> Save/Open');
  } finally {
    await page.close();
  }
}

async function touchFixed() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const entityId = await selectLine(page, true);

    await page.getByRole('button', { name: /Инструменты/ }).click();
    const tools = page.locator('[data-mobile-tools="true"]');
    await tools.waitFor();
    const fixed = tools.locator('[data-command-id="constraint.fixed"]');
    assert.equal(await fixed.isEnabled(), true, 'mobile Fixed must use shared selected-Line enablement');
    await fixed.click();

    await page.getByText('Отрезок зафиксирован', { exact: true }).waitFor();
    await waitSolvedOverlay(page, 1, 'touch Fixed');
    const saved = await saveLocalDocument(page);
    assert.ok(saved.constraints.some((constraint) => constraint.type === 'fixed' && constraint.entityIds[0] === entityId), 'touch Fixed must persist typed constraint');
    await assertSketchOnlyWasm(page, 'touch Fixed');
    assertNoPageErrors(errors, 'touch Fixed browser');
    console.log('  ✓ touch: selected stable-ID Line -> shared mobile Fixed action');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.7B Fixed solved-geometry freeze browser');
  await desktopFixedAfterHorizontal();
  await touchFixed();
  console.log('ASA-CAD M3.7B Fixed solved-geometry freeze browser PASS\n');
} finally {
  await browser.close();
}
