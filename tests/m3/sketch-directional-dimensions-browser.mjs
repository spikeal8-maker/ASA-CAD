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

async function delta(page, id) {
  return page.locator(`[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="${id}"]`).evaluate((node) => ({
    dx: Math.abs(Number(node.getAttribute('x2')) - Number(node.getAttribute('x1'))),
    dy: Math.abs(Number(node.getAttribute('y2')) - Number(node.getAttribute('y1'))),
  }));
}

function assertDimension(saved, type, entityId, value) {
  const dim = saved.dimensions.find((item) => item.type === type);
  assert.ok(dim);
  assert.deepEqual(dim.entityIds, [entityId]);
  assert.equal(dim.value, value);
  assert.equal(dim.driving, true);
  return dim;
}

async function desktopHorizontal() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const id = await selectLine(page);
    const action = page.locator('[data-command-id="dimension.horizontal"]').first();
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Горизонтальный размер' }).waitFor();
    assert.equal(await page.locator('[data-directional-dimension-target]').getAttribute('data-directional-dimension-target'), id);
    near(Number(await field(page).inputValue()), 18, 1e-6, 'initial Horizontal');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);

    await field(page).fill('40');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'Horizontal create');
    near((await delta(page, id)).dx, 40, 0.1, 'Horizontal ΔX');
    assert.equal(await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'), id);
    let saved = await saveLocalDocument(page);
    const dimensionId = assertDimension(saved, 'horizontal', id, 40).id;
    assert.equal(saved.constraints.some((item) => item.type === 'horizontal'), false);

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Horizontal undo');
    near((await delta(page, id)).dx, 18, 0.1, 'undo ΔX');
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Horizontal redo');
    near((await delta(page, id)).dx, 40, 0.1, 'redo ΔX');

    await saveLocalDocument(page);
    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Horizontal reopen');
    near((await delta(page, id)).dx, 40, 0.1, 'reopen ΔX');
    saved = JSON.parse(await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document')));
    assert.equal(saved.dimensions.find((item) => item.type === 'horizontal')?.id, dimensionId);

    await page.getByText(/horizontal: 40 мм/i).click();
    await page.getByText('Изменить размер', { exact: true }).waitFor();
    await field(page).fill('50');
    await apply(page).click();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedOverlay(page, 1, 'Horizontal edit');
    near((await delta(page, id)).dx, 50, 0.1, 'edited ΔX');
    saved = await saveLocalDocument(page);
    assert.equal(saved.dimensions.filter((item) => item.type === 'horizontal').length, 1);
    assert.equal(saved.dimensions.find((item) => item.id === dimensionId)?.value, 50);
    await assertSketchOnlyWasm(page, 'desktop Horizontal');
    assertNoPageErrors(errors, 'desktop Horizontal');
  } finally { await page.close(); }
}

async function mobileVertical() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const id = await selectLine(page, true);
    await page.getByRole('button', { name: /Инструменты/ }).click();
    const action = page.locator('[data-mobile-tools="true"] [data-command-id="dimension.vertical"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Вертикальный размер' }).waitFor();
    near(Number(await field(page).inputValue()), 10, 1e-6, 'initial Vertical');
    await field(page).fill('30');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'mobile Vertical');
    near((await delta(page, id)).dy, 30, 0.1, 'Vertical ΔY');
    assertDimension(await saveLocalDocument(page), 'vertical', id, 30);
    await assertSketchOnlyWasm(page, 'mobile Vertical');
    assertNoPageErrors(errors, 'mobile Vertical');
  } finally { await context.close(); }
}

async function searchHorizontal() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Горизонтальный размер');
    let result = page.locator('.command-search-results [data-command-id="dimension.horizontal"]');
    await result.waitFor();
    assert.equal(await result.isEnabled(), false);
    assert.equal(await result.getAttribute('title'), 'Выберите отрезок эскиза');

    const id = await selectLine(page);
    result = page.locator('.command-search-results [data-command-id="dimension.horizontal"]');
    assert.equal(await result.isEnabled(), true);
    await result.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Горизонтальный размер' }).waitFor();
    await field(page).fill('32');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'search Horizontal');
    near((await delta(page, id)).dx, 32, 0.1, 'search ΔX');
    await assertSketchOnlyWasm(page, 'search Horizontal');
    assertNoPageErrors(errors, 'search Horizontal');
  } finally { await page.close(); }
}

async function cancelNoMutation() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    await selectLine(page);
    const before = JSON.stringify(await saveLocalDocument(page));
    await page.locator('[data-command-id="dimension.horizontal"]').first().click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Горизонтальный размер' }).waitFor();
    await field(page).fill('77');
    await page.locator('.parameter-actions button:not(.primary)').click();
    const after = JSON.stringify(await saveLocalDocument(page));
    assert.equal(after, before);
    assert.equal(JSON.parse(after).dimensions.length, 0);
    await assertSketchOnlyWasm(page, 'directional Cancel');
    assertNoPageErrors(errors, 'directional Cancel');
  } finally { await page.close(); }
}

try {
  console.log('\nASA-CAD M3-DIM-001B directional dimensions browser');
  await desktopHorizontal();
  await mobileVertical();
  await searchHorizontal();
  await cancelNoMutation();
  console.log('ASA-CAD M3-DIM-001B directional dimensions browser PASS\n');
} finally {
  await browser.close();
}
