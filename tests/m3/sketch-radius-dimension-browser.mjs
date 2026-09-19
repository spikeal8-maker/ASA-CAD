import assert from 'node:assert/strict';
import {
  assertNoPageErrors, assertSketchOnlyWasm, launchM3Browser,
  loadFixture, near, newDesktopPage, newTouchPage, reopenFirstSketch,
  saveLocalDocument, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';
import {
  apply, arcRadius, assertRadius, circleDiameter, field, selectEntity, title,
} from './RadiusDimensionBrowserHelpers.mjs';

const browser = await launchM3Browser();

async function desktopCircle() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    const id = await selectEntity(page, 'circle');
    const action = page.locator('.command-ribbon [data-command-id="dimension.radius"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await title(page).filter({ hasText: 'Радиальный размер' }).waitFor();
    await page.getByText('Выбранная окружность', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-directional-dimension-target]').getAttribute('data-directional-dimension-target'), id);
    near(Number(await field(page).inputValue()), 12, 1e-6, 'initial Circle radius');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);

    await field(page).fill('15');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'Radius Circle create');
    near(await circleDiameter(page, id), 30, 0.1, 'Circle diameter');
    assert.equal(await page.locator('.cad-app').getAttribute('data-selected-sketch-entity-id'), id);
    let saved = await saveLocalDocument(page);
    const dimensionId = assertRadius(saved, id, 15, 'circle').id;

    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 1, 'Radius undo');
    near(await circleDiameter(page, id), 24, 0.1, 'undo Circle diameter');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 1, 'Radius redo');
    near(await circleDiameter(page, id), 30, 0.1, 'redo Circle diameter');

    await saveLocalDocument(page);
    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Radius reopen');
    near(await circleDiameter(page, id), 30, 0.1, 'reopen Circle diameter');
    saved = JSON.parse(await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document')));
    assert.equal(saved.schemaVersion, 2);
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.deepEqual(saved.dimensions[0]?.entityIds, [id]);

    await page.getByText('Радиальный размер: 15 мм', { exact: true }).click();
    await page.getByText('Изменить размер', { exact: true }).waitFor();
    await field(page).fill('20');
    await apply(page).click();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedOverlay(page, 1, 'Radius edit');
    near(await circleDiameter(page, id), 40, 0.1, 'edited Circle diameter');
    saved = await saveLocalDocument(page);
    assert.equal(saved.dimensions.length, 1);
    assert.equal(saved.dimensions[0]?.id, dimensionId);
    assert.equal(saved.dimensions[0]?.value, 20);
    await assertSketchOnlyWasm(page, 'desktop Radius Circle');
    assertNoPageErrors(errors, 'desktop Radius Circle');
  } finally { await page.close(); }
}

async function mobileArc() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'arc', 1);
    const id = await selectEntity(page, 'path', true);
    await page.getByRole('button', { name: /Инструменты/ }).click();
    const action = page.locator('[data-mobile-tools="true"] [data-command-id="dimension.radius"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await title(page).filter({ hasText: 'Радиальный размер' }).waitFor();
    await page.getByText('Выбранная дуга', { exact: true }).waitFor();
    near(Number(await field(page).inputValue()), 12, 1e-6, 'initial Arc radius');
    await field(page).fill('18');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'mobile Radius Arc');
    near(await arcRadius(page, id), 18, 0.1, 'mobile Arc radius');
    assertRadius(await saveLocalDocument(page), id, 18, 'arc');
    await assertSketchOnlyWasm(page, 'mobile Radius Arc');
    assertNoPageErrors(errors, 'mobile Radius Arc');
  } finally { await context.close(); }
}

async function searchRadius() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    await selectEntity(page, 'line');
    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Радиальный размер');
    let result = page.locator('.command-search-results [data-command-id="dimension.radius"]');
    await result.waitFor();
    assert.equal(await result.isEnabled(), false);
    assert.equal(await result.getAttribute('title'), 'Выберите окружность или дугу эскиза');

    await loadFixture(page, 'circle', 1);
    const id = await selectEntity(page, 'circle');
    await search.fill('Радиальный размер');
    result = page.locator('.command-search-results [data-command-id="dimension.radius"]');
    assert.equal(await result.isEnabled(), true);
    await result.click();
    await title(page).filter({ hasText: 'Радиальный размер' }).waitFor();
    await field(page).fill('14');
    await apply(page).click();
    await waitSolvedOverlay(page, 1, 'search Radius');
    near(await circleDiameter(page, id), 28, 0.1, 'search Circle diameter');
    assertRadius(await saveLocalDocument(page), id, 14, 'circle');
    assertNoPageErrors(errors, 'search Radius');
  } finally { await page.close(); }
}

async function cancelNoMutation() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'circle', 1);
    await selectEntity(page, 'circle');
    const before = JSON.stringify(await saveLocalDocument(page));
    await page.locator('.command-ribbon [data-command-id="dimension.radius"]').click();
    await title(page).filter({ hasText: 'Радиальный размер' }).waitFor();
    await field(page).fill('77');
    await page.locator('.parameter-actions button:not(.primary)').click();
    const after = JSON.stringify(await saveLocalDocument(page));
    assert.equal(after, before);
    assert.equal(JSON.parse(after).dimensions.length, 0);
    assertNoPageErrors(errors, 'Radius Cancel');
  } finally { await page.close(); }
}

try {
  console.log('\nASA-CAD M3-DIM-003B Radius dimension browser');
  await desktopCircle();
  await mobileArc();
  await searchRadius();
  await cancelNoMutation();
  console.log('ASA-CAD M3-DIM-003B Radius dimension browser PASS\n');
} finally {
  await browser.close();
}
