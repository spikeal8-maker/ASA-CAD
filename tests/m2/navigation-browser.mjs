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

function parseVector(value) {
  assert.ok(value, 'missing camera vector');
  const vector = value.split(',').map(Number);
  assert.equal(vector.length, 3);
  assert.ok(vector.every(Number.isFinite), `invalid camera vector: ${value}`);
  return vector;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function viewportState() {
  return page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    viewChangeCount: Number(node.getAttribute('data-view-change-count') ?? 0),
    canvasCount: node.querySelectorAll('canvas').length,
  }));
}

async function createExtrudedPart() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();

  await page.getByRole('button', { name: /Завершить эскиз/ }).click();
  await page.getByText('Эскиз завершен', { exact: true }).waitFor();

  await page.getByRole('button', { name: /Элемент выдавливания/i }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Выдавливание 10 мм построено локально', { exact: true }).waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
}

async function testNavigation() {
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 600 && box.height > 400, 'viewport canvas is not usable');

  const initial = await viewportState();
  assert.match(initial.revision ?? '', /^occ-\d+$/);
  assert.equal(initial.canvasCount, 1);
  const initialPosition = parseVector(initial.position);
  const initialTarget = parseVector(initial.target);
  const initialWasmCount = wasmRequests.length;

  // Wheel zoom must move the camera without touching the CAD runtime revision.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(100);
  const zoomed = await viewportState();
  const zoomedPosition = parseVector(zoomed.position);
  assert.ok(distance(initialPosition, zoomedPosition) > 0.5, 'wheel zoom did not move the camera');
  assert.equal(zoomed.revision, initial.revision, 'wheel zoom triggered CAD recompute');
  assert.ok(zoomed.viewChangeCount > initial.viewChangeCount, 'wheel zoom produced no camera change event');

  // Middle-drag is pan: target must move while the B-Rep runtime revision stays fixed.
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.48, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(100);
  const panned = await viewportState();
  const pannedTarget = parseVector(panned.target);
  assert.ok(distance(initialTarget, pannedTarget) > 0.1, 'middle-drag did not pan the camera target');
  assert.equal(panned.revision, initial.revision, 'pan triggered CAD recompute');
  assert.ok(panned.viewChangeCount > zoomed.viewChangeCount, 'pan produced no camera change event');

  // Right-drag is orbit: camera direction changes, target remains the navigation pivot.
  const beforeOrbitPosition = parseVector(panned.position);
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.54);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width * 0.70, box.y + box.height * 0.43, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  const orbited = await viewportState();
  const orbitedPosition = parseVector(orbited.position);
  assert.ok(distance(beforeOrbitPosition, orbitedPosition) > 0.5, 'right-drag did not orbit the camera');
  assert.equal(orbited.revision, initial.revision, 'orbit triggered CAD recompute');
  assert.ok(orbited.viewChangeCount > panned.viewChangeCount, 'orbit produced no camera change event');

  assert.equal(wasmRequests.length, initialWasmCount, 'camera navigation caused an additional WASM request');
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);

  console.log('ASA-CAD M2I viewport navigation PASS');
  console.log('  ✓ wheel = zoom, middle drag = pan, right drag = orbit');
  console.log(`  ✓ runtime stayed ${initial.revision}; no recompute/WASM reload during camera navigation`);
}

try {
  await createExtrudedPart();
  await testNavigation();
} finally {
  await browser.close();
}
