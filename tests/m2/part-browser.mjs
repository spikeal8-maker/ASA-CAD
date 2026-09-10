import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const failedRequests = [];
const wasmRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});

async function loadedWasmResources() {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\.wasm(?:\?|$)/i.test(name)),
  );
}

async function createProtectedExtrude() {
  await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'CAD route must be cross-origin isolated');
  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded on initial shell boot');

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded while creating an empty sketch');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');
  const height = page.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input');
  assert.equal(await width.inputValue(), '60');
  assert.equal(await height.inputValue(), '40');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();

  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded during 2D rectangle authoring');

  await page.getByRole('button', { name: 'Завершить эскиз', exact: true }).click();
  await page.getByText('Эскиз завершен', { exact: true }).waitFor();

  const extrudeButton = page.getByRole('button', { name: /Элемент выдавливания/i });
  assert.equal(await extrudeButton.isEnabled(), true, 'Extrude should be enabled after the rectangle sketch is finished');
  await extrudeButton.click();

  const distance = page.locator('.numeric-field').filter({ hasText: 'Расстояние' }).locator('input');
  assert.equal(await distance.inputValue(), '10');
  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded before the solid command was committed');

  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
  await page.getByText('Тело 1', { exact: true }).waitFor();
  await page.getByText('Выдавливание 10 мм построено локально', { exact: true }).waitFor();

  const loadedWasm = await loadedWasmResources();
  assert.ok(loadedWasm.length >= 1, 'OpenCascade WASM was not loaded for the first solid operation');
  assert.ok(wasmRequests.length >= 1, 'No WASM network request was observed');

  const viewport = await page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    width: node.getBoundingClientRect().width,
    height: node.getBoundingClientRect().height,
    canvasCount: node.querySelectorAll('canvas').length,
  }));
  assert.match(viewport.revision ?? '', /^occ-\d+$/);
  assert.ok(viewport.width > 400, `viewport width too small: ${viewport.width}`);
  assert.ok(viewport.height > 300, `viewport height too small: ${viewport.height}`);
  assert.equal(viewport.canvasCount, 1);

  console.log(`  ✓ lazy WASM: ${loadedWasm.length} resource(s), first solid only`);
  console.log(`  ✓ real B-Rep viewport: ${Math.round(viewport.width)}×${Math.round(viewport.height)}, ${viewport.revision}`);
}

async function saveReloadReopen() {
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Новая деталь', { exact: true }).waitFor();
  assert.deepEqual(await loadedWasmResources(), [], 'Reloaded empty shell eagerly loaded OpenCascade WASM');

  await page.getByTitle('Открыть').click();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
  await page.getByText('Тело 1', { exact: true }).waitFor();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();

  const state = await page.locator('.cad-app').evaluate((node) => ({
    kind: node.getAttribute('data-document-kind'),
    runtime: node.getAttribute('data-runtime-status'),
  }));
  assert.deepEqual(state, { kind: 'part', runtime: 'ready' });
  console.log('  ✓ serialized Part reopened after page reload and rebuilt locally');
}

try {
  console.log('\nASA-CAD M2 protected Part browser slice');
  await createProtectedExtrude();
  await saveReloadReopen();
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('  ✓ M2 rectangle -> extrude browser workflow PASS\n');
} finally {
  await browser.close();
}
