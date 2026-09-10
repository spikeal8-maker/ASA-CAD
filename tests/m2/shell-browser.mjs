import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

async function runDesktop() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const pageErrors = [];
  const failedRuntimeRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (/\.wasm(?:\?|$)/i.test(request.url())) failedRuntimeRequests.push(request.url());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('ASA-CAD', { exact: true }).first().waitFor();
  await page.getByText('Твердотельное моделирование', { exact: true }).waitFor();
  await page.getByText('Дерево', { exact: true }).first().waitFor();
  await page.getByText('Новая деталь', { exact: true }).waitFor();

  // Shell boot must remain cheap: this M2 surface does not eagerly fetch OCC WASM.
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  assert.equal(resources.some((name) => /\.wasm(?:\?|$)/i.test(name)), false, 'M2 shell eagerly loaded WASM');
  assert.equal(failedRuntimeRequests.length, 0);

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  // New-document routing is ASA-owned for all six kinds.
  await page.getByRole('button', { name: 'Новый документ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый документ' });
  await dialog.waitFor();
  for (const label of ['Деталь', 'Сборка', 'Чертеж', 'Фрагмент', 'Спецификация', 'Текстовый документ']) {
    await dialog.getByRole('button', { name: new RegExp(label) }).waitFor();
  }
  await dialog.getByRole('button', { name: /Сборка/ }).click();
  await page.getByText('Сборка', { exact: true }).first().waitFor();

  assert.deepEqual(pageErrors, [], `desktop page errors: ${pageErrors.join('; ')}`);
  await page.close();
}

async function runPhone() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('ASA-CAD', { exact: true }).first().waitFor();

  const layout = await page.evaluate(() => {
    const ribbon = document.querySelector('.command-ribbon');
    const bottom = document.querySelector('.mobile-bottom-bar');
    const work = document.querySelector('.work-area');
    return {
      ribbonDisplay: ribbon ? getComputedStyle(ribbon).display : 'missing',
      bottomDisplay: bottom ? getComputedStyle(bottom).display : 'missing',
      workWidth: work?.getBoundingClientRect().width ?? 0,
      workHeight: work?.getBoundingClientRect().height ?? 0,
    };
  });
  assert.equal(layout.ribbonDisplay, 'none', 'desktop ribbon must not be squeezed into phone layout');
  assert.notEqual(layout.bottomDisplay, 'none', 'phone bottom navigation must be visible');
  assert.ok(layout.workWidth >= 360, `phone work area unexpectedly narrow: ${layout.workWidth}`);
  assert.ok(layout.workHeight >= 300, `phone work area unexpectedly short: ${layout.workHeight}`);
  assert.deepEqual(pageErrors, [], `phone page errors: ${pageErrors.join('; ')}`);
  await page.close();
}

try {
  await runDesktop();
  await runPhone();
  console.log('ASA-CAD M2 shell real-browser smoke PASS');
} finally {
  await browser.close();
}
