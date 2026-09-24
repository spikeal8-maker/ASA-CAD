import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const fileTrigger = () => page.getByRole('button', { name: 'Файл', exact: true });
const fileMenu = () => page.getByRole('menu', { name: 'Файл', exact: true });
const dirtyGuard = () => page.getByRole('dialog', { name: 'Есть несохранённые изменения', exact: true });

async function shellGeometry() {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing geometry node: ${selector}`);
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      tabs: rect('.document-tabs'),
      instrument: rect('.instrument-area'),
      work: rect('.work-area'),
    };
  });
}

function assertGeometryEqual(before, after, label) {
  for (const key of Object.keys(before)) {
    for (const field of ['x', 'y', 'width', 'height']) {
      assert.ok(
        Math.abs(before[key][field] - after[key][field]) < 0.2,
        `${label}: ${key}.${field} shifted (${before[key][field]} -> ${after[key][field]})`,
      );
    }
  }
}

async function assertFileMenuContract() {
  const trigger = fileTrigger();
  const before = await shellGeometry();

  await trigger.click();
  const menu = fileMenu();
  await menu.waitFor();
  const expected = [
    ['Новый', 'system.new'],
    ['Открыть', 'system.open'],
    ['Сохранить', 'system.save'],
  ];
  for (const [label, id] of expected) {
    const item = menu.getByRole('menuitem', { name: label, exact: true });
    await item.waitFor();
    assert.equal(await item.getAttribute('data-command-id'), id);
    assert.equal(await item.isEnabled(), true, `${id} should be enabled`);
  }
  assertGeometryEqual(before, await shellGeometry(), 'open File menu');

  await trigger.click();
  assert.equal(await fileMenu().count(), 0, 'second File click did not close popup');

  await trigger.click();
  await fileMenu().waitFor();
  await page.locator('.work-area').click();
  assert.equal(await fileMenu().count(), 0, 'outside click did not close popup');

  await trigger.focus();
  await trigger.press('Enter');
  await fileMenu().waitFor();
  await trigger.press('Escape');
  assert.equal(await fileMenu().count(), 0, 'Escape did not close File popup from trigger');
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, 'Escape did not restore File focus');

  await trigger.press('ArrowDown');
  const menu2 = fileMenu();
  await menu2.waitFor();
  const newItem = menu2.getByRole('menuitem', { name: 'Новый', exact: true });
  const openItem = menu2.getByRole('menuitem', { name: 'Открыть', exact: true });
  assert.equal(await newItem.evaluate((node) => document.activeElement === node), true, 'ArrowDown did not focus first item');
  await newItem.press('ArrowDown');
  assert.equal(await openItem.evaluate((node) => document.activeElement === node), true, 'ArrowDown did not move to next item');
  await openItem.press('ArrowUp');
  assert.equal(await newItem.evaluate((node) => document.activeElement === node), true, 'ArrowUp did not move to previous item');
  await newItem.press('Escape');
  assert.equal(await fileMenu().count(), 0, 'Escape did not close File popup from item');
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, 'item Escape did not restore File focus');
}

async function openMenuCommand(label) {
  await fileTrigger().click();
  const item = fileMenu().getByRole('menuitem', { name: label, exact: true });
  await item.waitFor();
  await item.click();
}

async function createCleanPartFromFile() {
  await openMenuCommand('Новый');
  const dialog = page.getByRole('dialog', { name: 'Новый документ', exact: true });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  assert.equal(await dialog.count(), 0, 'New dialog did not close');

  await openMenuCommand('Новый');
  const dialog2 = page.getByRole('dialog', { name: 'Новый документ', exact: true });
  await dialog2.waitFor();
  await dialog2.getByRole('button', { name: /Деталь/ }).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"]').waitFor();
}

async function createRectangleSketch() {
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  const app = page.locator('.cad-app');
  await page.waitForFunction(() => Boolean(document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id')));
  const sketchId = await app.getAttribute('data-active-sketch-id');
  assert.ok(sketchId, 'active Sketch id missing');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const panel = page.locator('.parameter-panel');
  await panel.waitFor();
  assert.equal(await panel.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input').inputValue(), '60');
  assert.equal(await panel.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input').inputValue(), '40');
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();
  return sketchId;
}

async function addCircle() {
  await page.getByRole('button', { name: /Окружность/i }).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const panel = page.locator('.parameter-panel');
  await panel.waitFor();
  assert.equal(await panel.locator('.numeric-field').filter({ hasText: 'Диаметр' }).locator('input').inputValue(), '12');
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Окружность Ø12 мм создана', { exact: true }).waitFor();
}

async function sketchEntityIds() {
  return page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').evaluateAll(
    (nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-sketch-entity-id')).filter(Boolean))].sort(),
  );
}

async function cancelGuardAndAssertUnchanged(expectedSketchId, expectedEntityIds) {
  const guard = dirtyGuard();
  await guard.waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Новый документ', exact: true }).count(), 0, 'replacement dialog bypassed guard');
  await guard.getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.equal(await guard.count(), 0, 'guard did not close on Cancel');
  assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), expectedSketchId);
  assert.deepEqual(await sketchEntityIds(), expectedEntityIds, 'Cancel changed current Sketch entities');
  assert.equal(await page.locator('.dirty-dot').count(), 1, 'Cancel cleared dirty state');
}

try {
  await page.goto(`${base}/cad/?uiScale=100`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();

  await assertFileMenuContract();
  await createCleanPartFromFile();

  const sketchId = await createRectangleSketch();
  await openMenuCommand('Сохранить');
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  assert.equal(await page.locator('.dirty-dot').count(), 0, 'File Save did not clear dirty state');

  const savedRaw = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(savedRaw, 'File Save did not persist document');
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.sketches?.[0]?.id, sketchId, 'saved Sketch identity mismatch');

  await addCircle();
  assert.equal(await page.locator('.dirty-dot').count(), 1, 'UI edit did not mark document dirty');
  const dirtyEntityIds = await sketchEntityIds();
  assert.equal(dirtyEntityIds.length, 5, 'dirty Sketch should contain rectangle plus circle');

  await openMenuCommand('Новый');
  await cancelGuardAndAssertUnchanged(sketchId, dirtyEntityIds);

  await openMenuCommand('Открыть');
  await cancelGuardAndAssertUnchanged(sketchId, dirtyEntityIds);

  const search = page.getByRole('textbox', { name: 'Поиск команд', exact: true });
  await search.fill('Открыть');
  const searchOpen = page.locator('.command-search-results button[data-command-id="system.open"]');
  await searchOpen.waitFor();
  assert.equal(await searchOpen.isEnabled(), true, 'search Open should use enabled shared action');
  await searchOpen.click();
  await cancelGuardAndAssertUnchanged(sketchId, dirtyEntityIds);

  await page.getByTitle('Открыть').click();
  await cancelGuardAndAssertUnchanged(sketchId, dirtyEntityIds);

  await openMenuCommand('Открыть');
  const guard = dirtyGuard();
  await guard.waitFor();
  await guard.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(await page.locator('.dirty-dot').count(), 0, 'save-and-continue left document dirty');

  const continuedRaw = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(continuedRaw, 'save-and-continue lost persisted document');
  const continued = JSON.parse(continuedRaw);
  const continuedSketch = continued.sketches.find((item) => item.id === sketchId);
  assert.ok(continuedSketch, 'save-and-continue lost Sketch identity');
  assert.deepEqual(
    continuedSketch.entities.map((item) => item.id).sort(),
    dirtyEntityIds,
    'save-and-continue did not persist dirty entities before Open',
  );

  await search.fill('Новый');
  const searchNew = page.locator('.command-search-results button[data-command-id="system.new"]');
  await searchNew.waitFor();
  assert.equal(await searchNew.isEnabled(), true, 'system.new is not bound into shared CadUiAction catalog');

  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  console.log('✓ File popup click/outside/Escape/Arrow keyboard contract PASS');
  console.log('✓ system.new/open/save shared actions PASS');
  console.log('✓ dirty New/Open cancel and save-and-continue PASS');
  console.log('✓ global/search Open share replacement guard PASS');
} finally {
  await browser.close();
}
