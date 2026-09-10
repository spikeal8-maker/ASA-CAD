import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const pageErrors = [];
const failedRequests = [];
const wasmRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});

async function scaleState() {
  return page.evaluate(() => ({
    mode: document.documentElement.dataset.uiScaleMode,
    resolved: Number(document.documentElement.dataset.uiScale),
    stored: localStorage.getItem('asa-cad-ui-scale'),
    rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  let state = await scaleState();
  assert.equal(state.mode, 'auto');
  assert.equal(state.resolved, 100);
  await page.getByTestId('ui-scale-status').getByText('UI 100%', { exact: true }).waitFor();

  await page.getByTitle('Настройки').click();
  const dialog = page.getByRole('dialog', { name: 'Настройки интерфейса' });
  await dialog.waitFor();
  await dialog.getByRole('radio', { name: /125%/ }).click();
  await page.locator('html[data-ui-scale-mode="125"][data-ui-scale="125"]').waitFor();
  state = await scaleState();
  assert.equal(state.stored, '125');
  assert.ok(state.rootFont >= 17, `125% root font did not enlarge: ${state.rootFont}`);
  await page.getByTestId('ui-scale-status').getByText('UI 125%', { exact: true }).waitFor();
  console.log('  ✓ visible Settings dialog applies and persists UI 125%');

  await dialog.getByRole('button', { name: 'Закрыть настройки' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('html[data-ui-scale-mode="125"][data-ui-scale="125"]').waitFor();
  state = await scaleState();
  assert.equal(state.stored, '125');
  await page.getByTestId('ui-scale-status').getByText('UI 125%', { exact: true }).waitFor();
  console.log('  ✓ UI Scale survives reload without a query override');

  await page.getByTitle('Настройки').click();
  const dialogAfterReload = page.getByRole('dialog', { name: 'Настройки интерфейса' });
  await dialogAfterReload.getByRole('radio', { name: /^Авто/ }).click();
  await page.locator('html[data-ui-scale-mode="auto"][data-ui-scale="100"]').waitFor();
  state = await scaleState();
  assert.equal(state.stored, 'auto');
  assert.equal(state.resolved, 100);
  await page.getByTestId('ui-scale-status').getByText('UI 100%', { exact: true }).waitFor();
  console.log('  ✓ Auto on FHD resolves back to 100% and persists');

  assert.equal(wasmRequests.length, 0, 'UI settings unexpectedly loaded OpenCascade WASM');
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2R visible UI Scale settings PASS');
} finally {
  await context.close();
  await browser.close();
}
