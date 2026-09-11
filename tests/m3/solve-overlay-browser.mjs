import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
const failedRequests = [];
const wasmRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});

async function applyPrimary() {
  const button = page.locator('.parameter-actions button.primary');
  await button.waitFor();
  await button.click();
}

try {
  console.log('\nASA-CAD M3.1 active Sketch solve-overlay');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-runtime-status'), 'idle');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').count(), 0);
  assert.equal(await page.locator('[data-testid="sketch-solve-status"]').count(), 0);

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await applyPrimary();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  const app = page.locator('.cad-app');
  const activeSketchId = await app.getAttribute('data-active-sketch-id');
  assert.ok(activeSketchId, 'new Sketch did not become explicitly active');
  assert.equal(await app.getAttribute('data-runtime-status'), 'idle', 'OpenCascade must remain unloaded for empty Sketch');
  assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').count(), 0, 'empty Sketch should not create overlay geometry');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await applyPrimary();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();

  const overlay = page.locator('[data-testid="cad-sketch-overlay"]');
  await overlay.waitFor({ timeout: 60_000 });
  assert.equal(await overlay.getAttribute('data-sketch-id'), activeSketchId);
  assert.equal(await overlay.getAttribute('data-entity-count'), '4');

  const solveStatus = page.locator('[data-testid="sketch-solve-status"]');
  await solveStatus.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="sketch-solve-status"]');
    return node?.getAttribute('data-solve-status') === 'solved';
  }, { timeout: 60_000 });

  assert.equal(await solveStatus.getAttribute('data-sketch-id'), activeSketchId);
  assert.equal(await solveStatus.getAttribute('data-degrees-of-freedom'), '', 'PlaneGCS DoF is currently unavailable and must not be guessed');
  assert.equal(await overlay.getAttribute('data-overlay-source'), 'solver-preview');
  assert.equal(await app.getAttribute('data-runtime-status'), 'idle', 'OpenCascade must stay lazy while PlaneGCS solves 2D Sketch');
  assert.ok(wasmRequests.some((requestUrl) => /planegcs/i.test(requestUrl)), `PlaneGCS WASM request not observed: ${wasmRequests.join(', ')}`);

  // Solver preview must remain transient: persisted rectangle geometry is still
  // the command-authored 60x40 model, not a hidden solver mutation.
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'saved Sketch document missing');
  const document = JSON.parse(saved);
  const rectangle = document.sketches[0].entities.filter((entity) => entity.type === 'line');
  assert.equal(rectangle.length, 4);
  const xs = rectangle.flatMap((entity) => [entity.data.from[0], entity.data.to[0]]);
  const ys = rectangle.flatMap((entity) => [entity.data.from[1], entity.data.to[1]]);
  assert.equal(Math.min(...xs), -30);
  assert.equal(Math.max(...xs), 30);
  assert.equal(Math.min(...ys), -20);
  assert.equal(Math.max(...ys), 20);

  await page.getByRole('button', { name: /Завершить эскиз/ }).click();
  await page.getByText('Эскиз завершен', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"]').waitFor({ state: 'detached' });
  await page.locator('[data-testid="sketch-solve-status"]').waitFor({ state: 'detached' });
  assert.equal(await app.getAttribute('data-active-sketch-id'), activeSketchId, 'Finish must keep explicit Sketch target for downstream Part feature');
  assert.equal(await app.getAttribute('data-runtime-status'), 'idle', 'Finish alone must not load OpenCascade');

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('  ✓ explicit active Sketch -> PlaneGCS solve -> transient SVG preview');
  console.log('  ✓ solver preview does not mutate persisted document');
  console.log('  ✓ Finish clears solve/overlay while keeping Sketch id for downstream Part features');
  console.log('  ✓ OpenCascade remains lazy during Sketch-only M3.1 flow\n');
} finally {
  await browser.close();
}
