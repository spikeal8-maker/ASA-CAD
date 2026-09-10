import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const failedRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

function parseVector(value) {
  assert.ok(value, 'missing viewport camera vector');
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3);
  assert.ok(result.every(Number.isFinite), `invalid camera vector: ${value}`);
  return result;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v) {
  const l = length(v);
  assert.ok(l > 1e-6, 'zero camera direction');
  return v.map((value) => value / l);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

async function createExtrudedPart() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByRole('button', { name: /Завершить эскиз/ }).click();
  await page.getByRole('button', { name: /Элемент выдавливания/i }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Выдавливание 10 мм построено локально', { exact: true }).waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
}

async function cameraState() {
  return page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    view: node.getAttribute('data-view-name'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
  }));
}

async function assertView(label, view, expectedDirection) {
  await page.getByRole('button', { name: new RegExp(label) }).click();
  await page.locator(`[data-testid="cad-viewport"][data-view-name="${view}"]`).waitFor();
  const state = await cameraState();
  const direction = normalize(subtract(parseVector(state.position), parseVector(state.target)));
  const expected = normalize(expectedDirection);
  assert.ok(dot(direction, expected) > 0.999, `${label}: wrong camera direction ${direction.join(',')}`);
  return state;
}

try {
  await createExtrudedPart();
  const initial = await cameraState();
  assert.match(initial.revision ?? '', /^occ-\d+$/);

  await page.getByRole('tab', { name: 'Вид', exact: true }).click();

  const front = await assertView('Спереди', 'front', [0, -1, 0]);
  const back = await assertView('Сзади', 'back', [0, 1, 0]);
  const top = await assertView('Сверху', 'top', [0, 0, 1]);
  const bottom = await assertView('Снизу', 'bottom', [0, 0, -1]);
  const left = await assertView('Слева', 'left', [-1, 0, 0]);
  const right = await assertView('Справа', 'right', [1, 0, 0]);
  const iso = await assertView('Изометрия', 'isometric', [1, -1, 1]);

  for (const state of [front, back, top, bottom, left, right, iso]) {
    assert.equal(state.revision, initial.revision, `${state.view} triggered CAD recompute`);
  }

  // Deliberately zoom away from the fitted isometric view, then Fit must restore
  // the model framing while preserving the current view direction.
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  const box = await canvas.boundingBox();
  assert.ok(box, 'viewport canvas has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1100);
  await page.waitForTimeout(100);
  const zoomed = await cameraState();
  const zoomedPosition = parseVector(zoomed.position);
  const zoomedTarget = parseVector(zoomed.target);
  const zoomedDirection = normalize(subtract(zoomedPosition, zoomedTarget));
  const zoomedDistance = length(subtract(zoomedPosition, zoomedTarget));

  await page.getByTitle('Показать всё').click();
  await page.locator('[data-testid="cad-viewport"][data-view-name="fit"]').waitFor();
  const fitted = await cameraState();
  const fittedPosition = parseVector(fitted.position);
  const fittedTarget = parseVector(fitted.target);
  const fittedDirection = normalize(subtract(fittedPosition, fittedTarget));
  const fittedDistance = length(subtract(fittedPosition, fittedTarget));

  assert.ok(dot(zoomedDirection, fittedDirection) > 0.999, 'Fit changed the current viewing direction');
  assert.ok(Math.abs(fittedDistance - zoomedDistance) > 0.5, 'Fit did not change camera distance after zoom');
  assert.equal(fitted.revision, initial.revision, 'Fit triggered CAD recompute');
  await page.getByText('Показать всё', { exact: true }).waitFor();

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2I standard views PASS');
  console.log('  ✓ front/back/top/bottom/left/right/isometric are real camera commands');
  console.log('  ✓ Fit restores framing without CAD recompute');
} finally {
  await browser.close();
}
