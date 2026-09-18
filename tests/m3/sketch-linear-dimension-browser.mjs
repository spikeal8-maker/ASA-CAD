import assert from 'node:assert/strict';
import {
  assertNoPageErrors, assertSketchOnlyWasm, entityScreenPoint, launchM3Browser,
  loadFixture, near, newDesktopPage, newTouchPage, reopenFirstSketch,
  saveLocalDocument, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();
const field = (page) => page.locator('.parameter-panel .numeric-field input');
const apply = (page) => page.locator('.parameter-actions button.primary');

async function selectLine(page, touch = false) {
  const visual = page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').first();
  await visual.waitFor({ state: 'attached' });
  const id = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(id);
  const point = await entityScreenPoint(visual);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${id}"]`).waitFor();
  return id;
}

async function lineLength(page, id) {
  return page.locator(`[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="${id}"]`).evaluate((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected solved Line');
    return Math.hypot(
      Number(node.getAttribute('x2')) - Number(node.getAttribute('x1')),
      Number(node.getAttribute('y2')) - Number(node.getAttribute('y1')),
    );
  });
}

function assertLinear(saved, entityId, value) {
  assert.deepEqual(saved.dimensions.map((item) => item.type), ['linear']);
  const dimension = saved.dimensions[0];
  assert.deepEqual(dimension.entityIds, [entityId]);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  assert.equal(saved.constraints.some((item) => item.type === 'horizontal' || item.type === 'vertical'), false);
  return dimension;
}

async function desktopLinear() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const id = await selectLine(page);
    const initial = Math.hypot(18, 10);
    const action = page.locator('.command-ribbon [data-command-id="dimension.linear"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Линейный размер' }).waitFor();
    assert.equal(await page.locator('[data-directional-dimension-target]').getAttribute('data-directional-dimension-target'), id);
    near(Number(await field(page).inputValue()), initial, 1e-6, 'initial Linear length');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);

    await field(page).fill('42');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'Linear create');
    near(await lineLength(page, id), 42, 0.1, 'Linear length');
    assert.equal(await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'), id);
    let saved = await saveLocalDocument(page);
    const dimensionId = assertLinear(saved, id, 42).id;

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Linear undo');
    near(await lineLength(page, id), initial, 0.1, 'undo Linear length');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Linear redo');
    near(await lineLength(page, id), 42, 0.1, 'redo Linear length');

    await saveLocalDocument(page);
    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Linear reopen');
    near(await lineLength(page, id), 42, 0.1, 'reopen Linear length');
    saved = JSON.parse(await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document')));
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.deepEqual(saved.dimensions[0]?.entityIds, [id]);

    await page.getByText('Линейный размер: 42 мм', { exact: true }).click();
    await page.getByText('Изменить размер', { exact: true }).waitFor();
    await field(page).fill('55');
    await apply(page).click();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedOverlay(page, 1, 'Linear edit');
    near(await lineLength(page, id), 55, 0.1, 'edited Linear length');
    saved = await saveLocalDocument(page);
    assert.equal(saved.dimensions.length, 1);
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.equal(saved.dimensions[0]?.value, 55);
    await assertSketchOnlyWasm(page, 'desktop Linear');
    assertNoPageErrors(errors, 'desktop Linear');
  } finally { await page.close(); }
}

async function mobileLinear() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const id = await selectLine(page, true);
    await page.getByRole('button', { name: /Инструменты/ }).click();
    const action = page.locator('[data-mobile-tools="true"] [data-command-id="dimension.linear"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Линейный размер' }).waitFor();
    await field(page).fill('36');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'mobile Linear');
    near(await lineLength(page, id), 36, 0.1, 'mobile Linear length');
    assertLinear(await saveLocalDocument(page), id, 36);
    await assertSketchOnlyWasm(page, 'mobile Linear');
    assertNoPageErrors(errors, 'mobile Linear');
  } finally { await context.close(); }
}

async function searchLinear() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Линейный размер');
    let result = page.locator('.command-search-results [data-command-id="dimension.linear"]');
    await result.waitFor();
    assert.equal(await result.isEnabled(), false);
    assert.equal(await result.getAttribute('title'), 'Выберите отрезок эскиза');

    const id = await selectLine(page);
    result = page.locator('.command-search-results [data-command-id="dimension.linear"]');
    assert.equal(await result.isEnabled(), true);
    await result.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Линейный размер' }).waitFor();
    await field(page).fill('31');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'search Linear');
    near(await lineLength(page, id), 31, 0.1, 'search Linear length');
    assertLinear(await saveLocalDocument(page), id, 31);
    assertNoPageErrors(errors, 'search Linear');
  } finally { await page.close(); }
}

async function cancelNoMutation() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    await selectLine(page);
    const before = JSON.stringify(await saveLocalDocument(page));
    await page.locator('.command-ribbon [data-command-id="dimension.linear"]').click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Линейный размер' }).waitFor();
    await field(page).fill('77');
    await page.locator('.parameter-actions button:not(.primary)').click();
    const after = JSON.stringify(await saveLocalDocument(page));
    assert.equal(after, before);
    assert.equal(JSON.parse(after).dimensions.length, 0);
    assertNoPageErrors(errors, 'Linear Cancel');
  } finally { await page.close(); }
}

try {
  console.log('\nASA-CAD AUD-R1 Linear dimension browser');
  await desktopLinear();
  await mobileLinear();
  await searchLinear();
  await cancelNoMutation();
  console.log('ASA-CAD AUD-R1 Linear dimension browser PASS\n');
} finally {
  await browser.close();
}
