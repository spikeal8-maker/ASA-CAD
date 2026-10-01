import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, launchM3Browser,
  loadFixture, near, newDesktopPage, newTouchPage, reopenFirstSketch,
  saveLocalDocument, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';
import {
  angularLinePairIds, assertAngular, chooseAngularLines, drawSecondFreeLine,
  rectangleAdjacentLineIds, solvedAngle,
} from './AngularDimensionBrowserHelpers.mjs';

const browser = await launchM3Browser();
const field = (page) => page.locator('.parameter-panel .numeric-field input');
const apply = (page) => page.locator('.parameter-actions button.primary');

async function desktopFreeLinePair(page, label) {
  await loadFixture(page, 'line', 1);
  const lineAction = page.locator('.command-ribbon [data-command-id="sketch.line"]');
  assert.equal(await lineAction.isEnabled(), true);
  await lineAction.click();
  await drawSecondFreeLine(page);
  await waitSolvedOverlay(page, 2, label);
  return angularLinePairIds(page);
}

async function desktopLifecycle() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    const { first, second } = await desktopFreeLinePair(page, 'Angular free Lines');
    const before = JSON.stringify(await saveLocalDocument(page));

    const action = page.locator('.command-ribbon [data-command-id="dimension.angular"]');
    assert.equal(await action.isEnabled(), true, 'desktop Angular action must enable for >=2 Lines');
    await action.click();
    await chooseAngularLines(page, first, second);
    const initialAngle = await solvedAngle(page, first, second);
    near(Number(await field(page).inputValue()), initialAngle, 0.1, 'initial Angular degrees');
    assert.equal(await page.locator('.parameter-panel .numeric-control small').textContent(), '°');
    assert.equal(JSON.stringify(await saveLocalDocument(page)), before, 'Line selection must not mutate CadDocument');

    await field(page).fill('180');
    assert.equal(await apply(page).isEnabled(), false, '180 degrees must be rejected by Parameters');
    await field(page).fill('60');
    assert.equal(await apply(page).isEnabled(), true);
    await apply(page).click();
    await waitSolvedOverlay(page, 2, 'Angular create');
    near(await solvedAngle(page, first, second), 60, 0.1, 'Angular solve');

    let saved = await saveLocalDocument(page);
    const dimensionId = assertAngular(saved, first, second, 60).id;
    await page.locator('[data-command-id="system.undo"]').click();
    await waitSolvedOverlay(page, 2, 'Angular undo');
    assert.equal((await saveLocalDocument(page)).dimensions.length, 0);
    await page.locator('[data-command-id="system.redo"]').click();
    await waitSolvedOverlay(page, 2, 'Angular redo');
    saved = await saveLocalDocument(page);
    assert.equal(assertAngular(saved, first, second, 60).id, dimensionId);

    await reopenFirstSketch(page, 2);
    await waitSolvedOverlay(page, 2, 'Angular reopen');
    near(await solvedAngle(page, first, second), 60, 0.1, 'Angular reopen solve');
    saved = JSON.parse(await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document')));
    assert.equal(assertAngular(saved, first, second, 60).id, dimensionId);

    await page.getByText('Угловой размер: 60 °', { exact: true }).click();
    await page.getByText('Изменить размер', { exact: true }).waitFor();
    await field(page).fill('45');
    await apply(page).click();
    await page.locator('[data-sketch-id]').first().click();
    await waitSolvedOverlay(page, 2, 'Angular edit');
    near(await solvedAngle(page, first, second), 45, 0.1, 'Angular edit solve');
    saved = await saveLocalDocument(page);
    assert.equal(saved.dimensions.length, 1);
    assert.equal(saved.dimensions[0]?.id, dimensionId, 'Angular value edit must preserve Dimension ID');
    assert.equal(saved.dimensions[0]?.value, 45);
    await assertSketchOnlyWasm(page, 'desktop Angular');
    assertNoPageErrors(errors, 'desktop Angular');
  } finally { await page.close(); }
}

async function searchCancelNoMutation() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    let search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Угловой размер');
    let action = page.locator('.command-search-results [data-command-id="dimension.angular"]');
    await action.waitFor();
    assert.equal(await action.isEnabled(), false);
    assert.equal(await action.getAttribute('title'), 'Создайте два отрезка эскиза');

    await search.fill('');
    const lineAction = page.locator('.command-ribbon [data-command-id="sketch.line"]');
    assert.equal(await lineAction.isEnabled(), true);
    await lineAction.click();
    await drawSecondFreeLine(page);
    await waitSolvedOverlay(page, 2, 'Angular search free Lines');
    const { first, second } = await angularLinePairIds(page);
    const before = JSON.stringify(await saveLocalDocument(page));

    search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Угловой размер');
    action = page.locator('.command-search-results [data-command-id="dimension.angular"]');
    assert.equal(await action.isEnabled(), true, 'search Angular must enable for >=2 Lines');
    await action.click();
    await chooseAngularLines(page, first, second);
    assert.equal(JSON.stringify(await saveLocalDocument(page)), before, 'search selection must not mutate before Apply');
    await field(page).fill('70');
    await page.locator('.parameter-actions button:not(.primary)').click();
    const after = JSON.stringify(await saveLocalDocument(page));
    assert.equal(after, before, 'Cancel must leave CadDocument unchanged');
    assert.equal(JSON.parse(after).dimensions.length, 0);
    assertNoPageErrors(errors, 'Angular search Cancel');
  } finally { await page.close(); }
}
async function mobileCreate() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await loadFixture(page, 'line', 1);
    await activateMobileTool(page, 'sketch.line', 'Line');
    await drawSecondFreeLine(page, true);
    await waitSolvedOverlay(page, 2, 'mobile Angular free Lines');
    const { first, second } = await angularLinePairIds(page);

    await activateMobileTool(page, 'dimension.angular', 'Angular');
    await page.locator('.content-area.panel-closed').waitFor();
    await chooseAngularLines(page, first, second, true);
    const initialAngle = await solvedAngle(page, first, second);
    near(Number(await field(page).inputValue()), initialAngle, 0.1, 'mobile initial Angular');
    await field(page).fill('75');
    await apply(page).click();
    await waitSolvedOverlay(page, 2, 'mobile Angular');
    near(await solvedAngle(page, first, second), 75, 0.1, 'mobile Angular solve');
    assertAngular(await saveLocalDocument(page), first, second, 75);
    await assertSketchOnlyWasm(page, 'mobile Angular');
    assertNoPageErrors(errors, 'mobile Angular');
  } finally { await context.close(); }
}

async function rectangleConflictFailsHonest() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await loadFixture(page, 'rectangle', 4);
    const { first, second } = await rectangleAdjacentLineIds(page);
    near(await solvedAngle(page, first, second), 90, 0.1, 'Rectangle initial adjacent angle');
    const before = await saveLocalDocument(page);
    const constraintIds = before.constraints.map((item) => item.id);
    assert.equal(constraintIds.length, 8, 'Rectangle must retain H/V + Coincident relations');

    const action = page.locator('.command-ribbon [data-command-id="dimension.angular"]');
    assert.equal(await action.isEnabled(), true);
    await action.click();
    await chooseAngularLines(page, first, second, false, 4);
    await field(page).fill('60');
    await apply(page).click();

    await page.locator('.status-left').getByText(/конфликтует с существующими ограничениями/i).waitFor();
    const after = await saveLocalDocument(page);
    assert.deepEqual(after.constraints.map((item) => item.id), constraintIds);
    assert.equal(after.dimensions.length, 0, 'conflicting Angular must not persist a Dimension');
    near(await solvedAngle(page, first, second), 90, 0.1, 'Rectangle angle after rejected Angular');
    await page.locator('.parameter-actions button:not(.primary)').click();
    await waitSolvedOverlay(page, 4, 'Rectangle conflict cancel');
    assertNoPageErrors(errors, 'Rectangle Angular conflict');
  } finally { await page.close(); }
}

try {
  console.log('\nASA-CAD M3 Angular Dimension productization browser');
  await desktopLifecycle();
  await searchCancelNoMutation();
  await mobileCreate();
  await rectangleConflictFailsHonest();
  console.log('ASA-CAD M3 Angular Dimension productization browser PASS\n');
} finally {
  await browser.close();
}
