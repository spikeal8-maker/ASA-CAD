import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const sizes = [[1600, 900], [1366, 768]];

async function verifyLayout(page, width, height) {
  const layout = await page.evaluate(() => {
    const box = (node) => {
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    const one = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw Error('Missing U1A region: ' + selector);
      return box(node);
    };
    const menu = [...document.querySelectorAll('.main-menu-items .file-menu-trigger')].map((node) => ({
      name: node.textContent?.trim(), ...box(node),
    }));
    const tabs = [...document.querySelectorAll('.workspace-tabs button:not(:disabled)')].map((node) => ({
      name: node.textContent?.trim(), ...box(node),
    }));
    const ribbon = [...document.querySelectorAll('.command-ribbon .ribbon-command')].filter((node) => getComputedStyle(node).display !== 'none').map((node) => box(node));
    return {
      menu, tabs, ribbon,
      main: one('.main-menu-bar'), search: one('.command-search-wrap'), quick: one('.global-actions'),
      doc: one('.document-tab.active'), tabBar: one('.document-tabs'),
      strip: one('.workspace-tabs'), commands: one('.command-ribbon'),
      work: one('.work-area'),
    };
  });
  assert.deepEqual(layout.menu.map((m) => m.name), ['Файл', 'Правка', 'Вид', 'Эскиз', 'Моделирование']);
  assert.ok(layout.search.width >= 150 && layout.search.height >= 22);
  assert.ok(layout.search.right + 2 < layout.quick.x, 'Search covers global controls');
  assert.ok(layout.menu.every((m) => m.x >= 0 && m.right <= width), 'Main menu is clipped');
  for (let i = 1; i < layout.menu.length; i += 1)
    assert.ok(layout.menu[i].x >= layout.menu[i - 1].right - 1, 'Menu overlap');
  assert.ok(layout.menu[layout.menu.length - 1].right < layout.search.x - 6, 'Menus overlap search');
  assert.ok(layout.tabs.some((t) => t.name === 'Вид') && layout.tabs.some((t) => t.name === 'Проверка / Измерения'));
  for (let i = 1; i < layout.tabs.length; i += 1)
    assert.ok(layout.tabs[i].x >= layout.tabs[i - 1].right - 1, 'Workspace tabs overlap');
  assert.ok(layout.strip.bottom <= layout.commands.y + 1, 'Ribbon covers tab strip');
  assert.ok(layout.commands.bottom <= layout.work.y + 1, 'Ribbon covers work area');
  assert.ok(layout.work.width >= width - 350 && layout.work.height >= height - 155);
  assert.ok(layout.ribbon.length >= 5, 'No real action ribbon');
  assert.ok(await page.locator('[data-command-id="part.sketch.create"]').first().isEnabled());
  assert.ok((await page.locator('.document-title').textContent())?.trim() === 'Деталь 1');
  assert.ok((await page.locator('.dirty-dot').count()) === 0, 'New document should be clean');
}

async function verifyRealActions(page) {
  await page.getByRole('button', { name: 'Файл', exact: true }).click();
  const file = page.getByRole('menu', { name: 'Файл', exact: true });
  await file.waitFor();
  assert.deepEqual(await file.locator('[data-command-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-command-id'))),
    ['system.new', 'system.open', 'system.save']);
  await file.getByRole('menuitem', { name: 'Новый', exact: true }).click();
  const choose = page.getByRole('dialog', { name: 'Новый документ' });
  await choose.waitFor();
  await choose.getByRole('button', { name: /Деталь/ }).click();
  await page.locator('.cad-app[data-document-kind="part"]').waitFor();

  await page.getByRole('button', { name: 'Вид', exact: true }).click();
  const view = page.getByRole('menu', { name: 'Вид', exact: true });
  await view.waitFor();
  const iso = view.locator('[data-command-id="view.iso"]');
  assert.equal(await iso.isEnabled(), true);
  await iso.click();
  await page.locator('.view-caption').filter({ hasText: 'Изометрия' }).waitFor();

  await page.getByRole('tab', { name: 'Каркас и поверхности', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'Каркас и поверхности', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByText('Команды каркаса и поверхностей ещё не зарегистрированы', { exact: false }).waitFor();
  await page.getByRole('tab', { name: 'Проверка / Измерения', exact: true }).click();
  await page.getByRole('tab', { name: 'Вид', exact: true }).click();
  await page.locator('.command-ribbon [data-command-id="view.iso"]').waitFor();
  await page.getByRole('tab', { name: 'Твердотельное моделирование', exact: true }).click();

  const search = page.getByRole('textbox', { name: 'Поиск команд', exact: true });
  await search.fill('Неизвестная_команда_123');
  await page.getByText('Команды не найдены', { exact: true }).waitFor();
  await search.press('Escape');
  assert.equal(await search.inputValue(), '');
  await search.fill('Создать эскиз');
  const create = page.locator('.command-search-results [data-command-id="part.sketch.create"]');
  await create.waitFor();
  assert.equal(await create.isEnabled(), true);
  await search.press('Enter');
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.waitForFunction(() => !!document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id'));
  await page.locator('.dirty-dot').waitFor();

  await search.fill('Прямоугольник');
  const rectangle = page.locator('.command-search-results [data-command-id="sketch.rectangle"]');
  await rectangle.waitFor();
  assert.equal(await rectangle.isEnabled(), true);
  await rectangle.click();
  await page.getByTitle('Параметры').click();
  const panel = page.locator('.parameter-panel');
  await panel.locator('.parameter-actions button.primary').waitFor();
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '1');
  assert.equal(await page.locator('.dirty-dot').count(), 1);
  await page.getByRole('button', { name: 'Файл', exact: true }).click();
  await page.getByRole('menu', { name: 'Файл', exact: true }).getByRole('menuitem', { name: 'Сохранить', exact: true }).click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  assert.equal(await page.locator('.dirty-dot').count(), 0);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('asa-cad-m2-shell-document') ?? 'null'));
  assert.ok(persisted?.sketches?.[0]?.entities?.length >= 4, 'CAD history did not persist real Sketch geometry');
}

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const response = await page.goto(base + '/cad/?uiScale=100', { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200);
      await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
      await verifyLayout(page, width, height);
      if (width === 1600) await verifyRealActions(page);
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log('U1A_OWNER_FLOW_PASS ' + width + 'x' + height);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
