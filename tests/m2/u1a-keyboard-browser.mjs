import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

// U1A review regression: shell menus, command search and Settings own their
// keys; Esc/arrows/view digits must not reach the central CAD shortcut handler.
const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const planePanel = () => page.getByText('Плоскость построения', { exact: true });
const viewCaption = () => page.locator('.view-caption').textContent();
const focused = () => page.evaluate(() => {
  const node = document.activeElement;
  return node ? (node.getAttribute('data-command-id') ?? node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '') : '';
});

async function assertCommandAlive(step) {
  assert.equal(await planePanel().isVisible(), true, 'Active "Создать эскиз" was cancelled by ' + step);
}

try {
  const response = await page.goto(base + '/cad/?uiScale=100', { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await page.locator('.command-ribbon [data-command-id="part.sketch.create"]').first().click();
  await planePanel().waitFor();
  const caption = await viewCaption();

  // Menu: Esc closes only the menu; arrows and digits stay inside it.
  const fileTrigger = page.getByRole('button', { name: 'Файл', exact: true });
  await fileTrigger.click();
  await page.getByRole('menu', { name: 'Файл', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await assertCommandAlive('Esc on the File menu');
  await fileTrigger.focus();
  await page.keyboard.press('ArrowDown');
  const fileMenu = page.getByRole('menu', { name: 'Файл', exact: true });
  await fileMenu.waitFor();
  assert.equal(await focused(), 'system.new');
  for (const key of ['ArrowDown', 'ArrowLeft', '1', 'f']) await page.keyboard.press(key);
  assert.equal(await focused(), 'system.open', 'Menu arrow navigation broke');
  assert.equal(await viewCaption(), caption, 'Keys inside the menu changed the CAD view');
  await page.keyboard.press('Escape');
  assert.equal(await fileMenu.count(), 0, 'Esc did not close the menu');
  assert.equal(await focused(), 'Файл', 'Esc did not return focus to the menu trigger');
  await assertCommandAlive('Esc inside the File menu');

  // Command search: list navigation, Esc back to the field, Esc clears it.
  const search = page.getByRole('textbox', { name: 'Поиск команд', exact: true });
  await search.fill('Сверху');
  await page.locator('.command-search-results [data-command-id="view.top"]').waitFor();
  await search.press('ArrowDown');
  assert.equal(await focused(), 'view.top');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  assert.equal(await focused(), 'Поиск команд', 'Esc in results did not return to the search field');
  await search.press('Escape');
  assert.equal(await search.inputValue(), '');
  await assertCommandAlive('Esc in command search');
  assert.equal(await viewCaption(), caption, 'Search keys changed the CAD view');

  // Planned-only match is hidden in production: show the empty state, not an empty popup.
  await search.fill('По сечениям');
  await page.getByText('Команды не найдены', { exact: true }).waitFor();
  assert.equal(await page.locator('.command-search-results').count(), 0);
  await search.press('Escape');

  // Esc still cancels the command when focus is not in a shell control.
  await page.locator('.cad-app').focus();
  await page.keyboard.press('Escape');
  await planePanel().waitFor({ state: 'hidden' });

  // Settings: focus enters the dialog, stays inside, radios use arrows, focus returns.
  const settings = page.locator('.global-actions').getByRole('button', { name: 'Настройки', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Настройки интерфейса' });
  await dialog.waitFor();
  assert.equal(await dialog.locator('[role="radio"][aria-checked="true"]').evaluate((node) => node === document.activeElement), true,
    'Settings did not move focus to the selected scale');
  await page.keyboard.press('ArrowDown');
  const checked = dialog.locator('[role="radio"][aria-checked="true"]');
  assert.equal(await checked.textContent().then((text) => text?.includes('110%')), true, 'Arrow did not select the next scale');
  assert.equal(await checked.evaluate((node) => node === document.activeElement), true);
  assert.equal(await dialog.locator('[role="radio"][tabindex="0"]').count(), 1, 'Radio group must have one tab stop');
  await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, 'Tab left the modal dialog');
  }
  await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, 'Shift+Tab left the modal dialog');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Настройки');

  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('U1A_KEYBOARD_PASS');
} finally {
  await browser.close();
}
