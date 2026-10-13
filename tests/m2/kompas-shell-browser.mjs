import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

// KOMPAS shell of the frozen reference #170 (ui-reference-20261004) over the real product.
const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const MENUS = ['Файл', 'Правка', 'Выделить', 'Вид', 'Эскиз', 'Моделирование', 'Оформление', 'Диагностика', 'Управление', 'Настройка', 'Приложения', 'Окно', 'Справка'];

function near(actual, expected, label, tolerance = 1) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}±${tolerance}, got ${actual}`);
}

async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/cad/?uiScale=100`, { waitUntil: 'networkidle' });
  await page.locator('.k-main-menu-bar').waitFor();
  await page.locator('[data-scene-revision="reference"] canvas').waitFor();
  return { page, errors };
}

async function toast(page) {
  await page.locator('.k-toast.k-show').waitFor();
  return (await page.locator('.k-toast').textContent())?.trim() ?? '';
}

async function geometry(width, height) {
  const { page, errors } = await open(width, height);
  const box = (selector) => page.locator(selector).first().evaluate((node) => {
    const b = node.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
  });
  const bar = await box('.k-main-menu-bar');
  const tabs = await box('.k-document-tabs');
  const instrument = await box('.k-instrument-area');
  const rail = await box('.k-management-rail');
  const panel = await box('.k-management-panel');
  const work = await box('.k-work-area');
  const toolsets = await box('.k-toolsets');
  near(bar.y, 0, 'menu y'); near(bar.height, 28, 'menu height');
  near(tabs.y, 28, 'documents y'); near(tabs.height, 27, 'documents height');
  near(instrument.y, 55, 'instrument y'); near(instrument.height, 93, 'instrument height');
  near(toolsets.width, 120, 'toolset column width');
  near(rail.x, 3, 'rail x'); near(rail.width, 26, 'rail width');
  near(panel.x, 29, 'panel x'); near(panel.width, 310, 'panel width');
  near(work.x, 340, 'graphics x'); near(work.right, width - 3, 'graphics right');
  near(work.bottom, height - 3, 'graphics bottom');
  const menus = await page.locator('.k-main-menu-items .k-menu-item').allTextContents();
  assert.deepEqual(menus, MENUS);
  const buttons = await page.locator('.k-command-ribbon :is(.k-btn-t, .k-btn-i)').evaluateAll((nodes) => nodes.map((node) => {
    const b = node.getBoundingClientRect();
    return { label: node.getAttribute('aria-label'), x: b.x, y: b.y, right: b.right, bottom: b.bottom, svg: Boolean(node.querySelector('svg.k-ic')) };
  }));
  assert.ok(buttons.length > 40, 'reference ribbon is not populated');
  for (const button of buttons) {
    assert.ok(button.svg, `${button.label} has no ASA icon`);
    assert.ok(button.y >= instrument.y - 0.5 && button.bottom <= instrument.bottom - 17.5, `${button.label} leaves its panel row`);
  }
  for (let i = 0; i < buttons.length; i += 1) {
    for (let j = i + 1; j < buttons.length; j += 1) {
      const a = buttons[i], b = buttons[j];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      assert.ok(overlapX <= 0.5 || overlapY <= 0.5, `${width}: ${a.label} overlaps ${b.label}`);
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
}

async function menusAndKeyboard() {
  const { page, errors } = await open(1600, 900);
  // Click opens, hover over a neighbour switches, submenus open on hover.
  await page.locator('.k-menu-item[data-menu="Файл"]').click();
  const level0 = page.locator('.k-pop[data-level="0"]');
  await level0.locator('[data-command-id="system.new"]').waitFor();
  await page.locator('.k-menu-item[data-menu="Моделирование"]').hover();
  await level0.getByText('Добавить элемент', { exact: true }).hover();
  await page.locator('.k-pop[data-level="1"] [data-command-id="part.extrude"]').waitFor();
  // Keyboard: Left closes the submenu level, Escape closes the menu and returns focus.
  await page.locator('.k-pop[data-level="1"] .k-mi').first().focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('.k-pop[data-level="1"]').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await level0.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-menu')), 'Моделирование');
  // Arrow navigation between main menus.
  await page.keyboard.press('ArrowDown');
  await level0.waitFor();
  await page.keyboard.press('ArrowRight');
  await page.locator('.k-menu-item[data-menu="Оформление"][aria-expanded="true"]').waitFor();
  await page.keyboard.press('Escape');

  // A running command survives Escape pressed inside a menu (shell keys never reach CAD shortcuts).
  await page.locator('[data-qa="sketch"]').click();
  await page.locator('[data-command-title="Создать эскиз"]').waitFor();
  await page.locator('.k-menu-item[data-menu="Вид"]').click();
  await level0.waitFor();
  await page.keyboard.press('Escape');
  await level0.waitFor({ state: 'detached' });
  await page.locator('[data-command-title="Создать эскиз"]').waitFor();
  await page.locator('.k-pp-cancel').click();
  await page.locator('[data-command-title="Создать эскиз"]').waitFor({ state: 'detached' });

  // Real product action from the reference menu.
  await page.locator('.k-menu-item[data-menu="Файл"]').click();
  await level0.locator('[data-command-id="system.new"]').click();
  await page.getByRole('dialog', { name: 'Новый документ' }).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  await page.close();
}

async function ribbonAndTools() {
  const { page, errors } = await open(1600, 900);
  // Toolsets.
  await page.locator('.k-toolset[data-toolset="surfaces"]').click();
  await page.locator('.k-cmd-panel[aria-label="Поверхности"]').waitFor();
  await page.locator('.k-toolset[data-toolset="solid"]').click();
  await page.locator('.k-cmd-panel[aria-label="Элементы тела"]').waitFor();
  // ▾ shows the commands KOMPAS hides in the collapsed panel; Escape collapses it.
  await page.locator('.k-cmd-panel[aria-label="Элементы тела"] .k-caret-btn').click();
  await page.locator('.k-panel-drop').getByRole('button', { name: 'Масштабировать' }).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.k-panel-drop').waitFor({ state: 'detached' });
  // ◢ variants of a command (right button).
  await page.locator('.k-command-ribbon [data-command-id="part.hole.simple"]').click({ button: 'right' });
  await page.locator('.k-pop[data-level="0"]').getByText('Отверстие с зенковкой', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  // Commands ASA-CAD does not have explain their registry status instead of pretending to work.
  await page.locator('.k-command-ribbon').getByRole('button', { name: 'Придать толщину' }).click();
  assert.match(await toast(page), /в ASA-CAD|в реестре ASA-CAD нет/);
  // Unavailable implemented commands are marked and explain why.
  const cut = page.locator('.k-command-ribbon [data-command-id="part.cutExtrude"]');
  assert.equal(await cut.getAttribute('aria-disabled'), 'true');
  assert.ok(await cut.getAttribute('data-dis'));
  // Alt+/ command search runs the shared product action.
  await page.keyboard.press('Alt+/');
  const search = page.getByRole('textbox', { name: 'Поиск по командам' });
  assert.equal(await search.evaluate((node) => node === document.activeElement), true);
  await search.fill('Изометр');
  await page.keyboard.press('Escape');
  assert.equal(await search.inputValue(), '');
  // Status marks and legend.
  await page.locator('.k-chip').click();
  await page.locator('.k-legend').getByText('Реализовано в ASA-CAD').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.kStatus), 'on');
  await page.locator('.k-chip').click();
  // Theme: the reference dark tokens.
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.kTheme), 'dark');
  const dark = await page.locator('.k-main-menu-bar').evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.equal(dark, 'rgb(51, 51, 51)');
  // Product surfaces follow the same theme model, not only the shell.
  await page.locator('.k-command-ribbon [data-command-id="system.new"]').click();
  const newDialog = page.locator('.new-document-dialog');
  assert.equal(await newDialog.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(72, 72, 72)');
  await newDialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.kTheme), 'light');
  // Rail: the active tab collapses the panel and gives the graphics area the width.
  await page.getByRole('tab', { name: 'Дерево' }).click();
  await page.locator('.k-content.k-collapsed').waitFor();
  near(await page.locator('.k-work-area').evaluate((node) => node.getBoundingClientRect().x), 30, 'collapsed graphics x');
  await page.getByRole('tab', { name: 'Дерево' }).click();
  await page.locator('.k-content:not(.k-collapsed)').waitFor();
  // Orientation grid of the quick-access toolbar drives the real camera.
  await page.locator('[data-qdrop="views"]').click();
  await page.locator('.k-pop.k-views').getByRole('button', { name: 'Сверху' }).click();
  await page.locator('[data-testid="cad-viewport"][data-view-name="top"]').waitFor();
  await page.locator('[data-qa="iso"]').click();
  await page.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
  // Tree and scene share one selection.
  await page.locator('.k-tree-row[data-plane-id="XZ"]').click();
  await page.locator('[data-testid="part-model-stage"][data-selected-base-plane="XZ"]').waitFor();
  assert.equal(await page.locator('.k-tree-row[data-plane-id="XZ"]').getAttribute('aria-selected'), 'true');
  assert.deepEqual(errors, []);
  await page.close();
}

async function dialogs() {
  const { page, errors } = await open(1600, 900);
  await page.locator('.k-menu-item[data-menu="Настройка"]').click();
  await page.locator('.k-pop[data-level="0"]').getByText('Параметры...', { exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Параметры', exact: true });
  await settings.getByRole('radio', { name: 'Тёмная' }).check();
  await settings.getByRole('button', { name: 'ОК', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.kTheme), 'dark');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await page.locator('.k-menu-item[data-menu="Файл"]').click();
  await page.locator('.k-pop[data-level="0"]').getByText('Информация о документе...', { exact: true }).click();
  const info = page.getByRole('dialog', { name: 'Информация о документе' });
  await info.getByText('Деталь 1', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await info.waitFor({ state: 'detached' });
  await page.locator('.k-menu-item[data-menu="Справка"]').click();
  await page.locator('.k-pop[data-level="0"]').getByText('О программе...', { exact: true }).click();
  await page.getByRole('dialog', { name: 'О программе', exact: true }).getByRole('button', { name: 'ОК', exact: true }).click();
  assert.deepEqual(errors, []);
  await page.close();
}

try {
  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768]]) await geometry(width, height);
  await menusAndKeyboard();
  await ribbonAndTools();
  await dialogs();
  console.log('ASA-CAD KOMPAS shell PASS');
  console.log('  ✓ reference geometry 28/27/93, rail 26, panel 310, graphics x 340 at 1920/1600/1366');
  console.log('  ✓ 13 menus, hover/keyboard navigation, submenus; Escape in a menu keeps the running command');
  console.log('  ✓ toolsets, ▾ panel drop, ◢ variants, statuses, search, theme, rail, orientation, dialogs');
} finally {
  await browser.close();
}
