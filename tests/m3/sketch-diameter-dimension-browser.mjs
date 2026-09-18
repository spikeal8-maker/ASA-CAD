import assert from 'node:assert/strict';
import {
  assertNoPageErrors, assertSketchOnlyWasm, launchM3Browser,
  loadFixture, near, newDesktopPage, newTouchPage, reopenFirstSketch,
  saveLocalDocument, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();
const field = (page) => page.locator('.parameter-panel .numeric-field input');
const apply = (page) => page.locator('.parameter-actions button.primary');

async function selectCircle(page, touch = false) {
  const visual = page.locator('[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id]').first();
  await visual.waitFor({ state: 'attached' });
  const id = await visual.getAttribute('data-sketch-entity-id');
  const box = await visual.boundingBox();
  assert.ok(id && box);
  const point = { x: box.x + box.width - 1, y: box.y + box.height / 2 };
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${id}"]`).waitFor();
  return id;
}

async function circleDiameter(page, id) {
  const circle = page.locator(`[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id="${id}"]`);
  await circle.waitFor();
  return Number(await circle.getAttribute('r')) * 2;
}

function assertDiameter(saved, entityId, value) {
  assert.deepEqual(saved.dimensions.map((item) => item.type), ['diameter']);
  assert.equal(saved.sketches[0]?.entities.filter((item) => item.type === 'circle').length, 1);
  assert.equal(saved.constraints.length, 0);
  const dimension = saved.dimensions[0];
  assert.deepEqual(dimension.entityIds, [entityId]);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  return dimension;
}

async function desktopDiameter() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    const id = await selectCircle(page);
    const action = page.locator('.command-ribbon [data-command-id="dimension.diameter"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Диаметральный размер' }).waitFor();
    assert.equal(await page.locator('[data-directional-dimension-target]').getAttribute('data-directional-dimension-target'), id);
    near(Number(await field(page).inputValue()), 24, 1e-6, 'initial Diameter');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);

    await field(page).fill('30');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'Diameter create');
    near(await circleDiameter(page, id), 30, 0.1, 'Diameter solve');
    assert.equal(await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'), id);
    let saved = await saveLocalDocument(page);
    const dimensionId = assertDiameter(saved, id, 30).id;

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Diameter undo');
    near(await circleDiameter(page, id), 24, 0.1, 'undo Diameter');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Diameter redo');
    near(await circleDiameter(page, id), 30, 0.1, 'redo Diameter');

    await saveLocalDocument(page);
    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Diameter reopen');
    near(await circleDiameter(page, id), 30, 0.1, 'reopen Diameter');
    saved = JSON.parse(await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document')));
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.deepEqual(saved.dimensions[0]?.entityIds, [id]);

    await page.getByText('Диаметральный размер: 30 мм', { exact: true }).click();
    await page.getByText('Изменить размер', { exact: true }).waitFor();
    await field(page).fill('36');
    await apply(page).click();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedOverlay(page, 1, 'Diameter edit');
    near(await circleDiameter(page, id), 36, 0.1, 'edited Diameter');
    saved = await saveLocalDocument(page);
    assert.equal(saved.dimensions.length, 1);
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.equal(saved.dimensions[0]?.value, 36);
    await assertSketchOnlyWasm(page, 'desktop Diameter');
    assertNoPageErrors(errors, 'desktop Diameter');
  } finally { await page.close(); }
}

async function mobileDiameter() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    const id = await selectCircle(page, true);
    await page.getByRole('button', { name: /Инструменты/ }).click();
    const action = page.locator('[data-mobile-tools="true"] [data-command-id="dimension.diameter"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Диаметральный размер' }).waitFor();
    await field(page).fill('32');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'mobile Diameter');
    near(await circleDiameter(page, id), 32, 0.1, 'mobile Diameter');
    assertDiameter(await saveLocalDocument(page), id, 32);
    await assertSketchOnlyWasm(page, 'mobile Diameter');
    assertNoPageErrors(errors, 'mobile Diameter');
  } finally { await context.close(); }
}

async function searchDiameter() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Диаметральный размер');
    let result = page.locator('.command-search-results [data-command-id="dimension.diameter"]');
    await result.waitFor();
    assert.equal(await result.isEnabled(), false);
    assert.equal(await result.getAttribute('title'), 'Выберите окружность эскиза');

    const id = await selectCircle(page);
    result = page.locator('.command-search-results [data-command-id="dimension.diameter"]');
    assert.equal(await result.isEnabled(), true);
    await result.click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Диаметральный размер' }).waitFor();
    await field(page).fill('28');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'search Diameter');
    near(await circleDiameter(page, id), 28, 0.1, 'search Diameter');
    assertDiameter(await saveLocalDocument(page), id, 28);
    assertNoPageErrors(errors, 'search Diameter');
  } finally { await page.close(); }
}

async function cancelNoMutation() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    await selectCircle(page);
    const before = JSON.stringify(await saveLocalDocument(page));
    await page.locator('.command-ribbon [data-command-id="dimension.diameter"]').click();
    await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Диаметральный размер' }).waitFor();
    await field(page).fill('77');
    await page.locator('.parameter-actions button:not(.primary)').click();
    const after = JSON.stringify(await saveLocalDocument(page));
    assert.equal(after, before);
    assert.equal(JSON.parse(after).dimensions.length, 0);
    assertNoPageErrors(errors, 'Diameter Cancel');
  } finally { await page.close(); }
}

try {
  console.log('\nASA-CAD M3-DIM-002 Diameter dimension browser');
  await desktopDiameter();
  await mobileDiameter();
  await searchDiameter();
  await cancelNoMutation();
  console.log('ASA-CAD M3-DIM-002 Diameter dimension browser PASS\n');
} finally {
  await browser.close();
}
