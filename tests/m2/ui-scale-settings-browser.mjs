import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

async function desktopSettingsFlow() {
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

  const scaleState = () => page.evaluate(() => ({
    mode: document.documentElement.dataset.uiScaleMode,
    resolved: Number(document.documentElement.dataset.uiScale),
    stored: localStorage.getItem('asa-cad-ui-scale'),
    rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));

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
  console.log('  ✓ desktop Settings applies and persists UI 125%');

  await dialog.getByRole('button', { name: 'Закрыть настройки' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('html[data-ui-scale-mode="125"][data-ui-scale="125"]').waitFor();
  state = await scaleState();
  assert.equal(state.stored, '125');
  await page.getByTestId('ui-scale-status').getByText('UI 125%', { exact: true }).waitFor();
  console.log('  ✓ UI Scale survives desktop reload without query override');

  await page.getByTitle('Настройки').click();
  const dialogAfterReload = page.getByRole('dialog', { name: 'Настройки интерфейса' });
  await dialogAfterReload.getByRole('radio', { name: /^Авто/ }).click();
  await page.locator('html[data-ui-scale-mode="auto"][data-ui-scale="100"]').waitFor();
  state = await scaleState();
  assert.equal(state.stored, 'auto');
  assert.equal(state.resolved, 100);
  await page.getByTestId('ui-scale-status').getByText('UI 100%', { exact: true }).waitFor();
  console.log('  ✓ Auto on FHD resolves back to 100% and persists');

  assert.equal(wasmRequests.length, 0, 'desktop UI settings unexpectedly loaded OpenCascade WASM');
  assert.deepEqual(pageErrors, [], `desktop page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `desktop failed requests: ${failedRequests.join('; ')}`);
  await context.close();
}

async function phoneSettingsFlow() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const wasmRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('request', (request) => {
    if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  const launcher = page.getByRole('button', { name: 'Настройки интерфейса', exact: true });
  await launcher.waitFor();
  const launcherBox = await launcher.boundingBox();
  assert.ok(launcherBox && launcherBox.width >= 44 && launcherBox.height >= 44, `phone settings launcher is not 44×44: ${JSON.stringify(launcherBox)}`);

  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Настройки интерфейса' });
  await dialog.waitFor();
  const box = await dialog.boundingBox();
  assert.ok(box, 'phone settings sheet has no bounds');
  assert.ok(box.x >= -1 && box.x + box.width <= 391, `phone sheet exceeds viewport horizontally: ${JSON.stringify(box)}`);
  assert.ok(box.y >= -1 && box.y + box.height <= 845, `phone sheet exceeds viewport vertically: ${JSON.stringify(box)}`);
  assert.ok(box.y > 100, `phone settings should compose as a bottom sheet, got y=${box.y}`);

  await dialog.getByRole('radio', { name: /90%/ }).click();
  await page.locator('html[data-ui-scale-mode="90"][data-ui-scale="90"]').waitFor();
  const state = await page.evaluate(() => ({
    stored: localStorage.getItem('asa-cad-ui-scale'),
    rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    bottomButtonHeights: [...document.querySelectorAll('.mobile-bottom-bar button')].map((node) => node.getBoundingClientRect().height),
  }));
  assert.equal(state.stored, '90');
  assert.ok(state.rootFont >= 14, `phone UI90 shrank root text below touch/readability floor: ${state.rootFont}`);
  assert.ok(state.bottomButtonHeights.every((height) => height >= 44), `phone UI90 shrank touch targets: ${state.bottomButtonHeights.join(',')}`);
  console.log('  ✓ phone 390×844 opens bottom-sheet settings and keeps UI90 touch/readability floors');

  await dialog.getByRole('button', { name: 'Закрыть настройки' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(wasmRequests.length, 0, 'phone UI settings unexpectedly loaded OpenCascade WASM');
  assert.deepEqual(pageErrors, [], `phone page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `phone failed requests: ${failedRequests.join('; ')}`);
  await context.close();
}

try {
  await desktopSettingsFlow();
  await phoneSettingsFlow();
  console.log('ASA-CAD M2R visible persistent UI Scale settings PASS');
} finally {
  await browser.close();
}
