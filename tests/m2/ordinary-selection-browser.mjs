import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const failedRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

function parseVector(value, label) {
  assert.ok(value, `missing ${label}`);
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3, `invalid ${label}: ${value}`);
  assert.ok(result.every(Number.isFinite), `non-finite ${label}: ${value}`);
  return result;
}

async function viewportState() {
  return page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    selectedBodyId: node.getAttribute('data-selected-body-id') ?? '',
    bounds: node.getAttribute('data-bounds'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
  }));
}

async function clickProjectedWorldPoint(worldPoint) {
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'CAD canvas has no usable bounds');

  const state = await viewportState();
  const bounds = state.bounds?.split(',').map(Number) ?? [];
  assert.equal(bounds.length, 6, `invalid viewport bounds: ${state.bounds}`);
  const diagonal = Math.max(
    Math.hypot(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]),
    10,
  );
  const camera = new THREE.PerspectiveCamera(34, box.width / box.height, Math.max(diagonal / 1000, 0.01), diagonal * 100);
  camera.position.set(...parseVector(state.position, 'camera position'));
  camera.up.set(...parseVector(state.up, 'camera up'));
  camera.lookAt(new THREE.Vector3(...parseVector(state.target, 'camera target')));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const ndc = new THREE.Vector3(...worldPoint).project(camera);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `projected point outside viewport: ${ndc.x},${ndc.y}`);
  await canvas.click({
    position: {
      x: (ndc.x + 1) * box.width / 2,
      y: (1 - ndc.y) * box.height / 2,
    },
  });
}

async function createSimpleExtrude() {
  await page.goto(url, { waitUntil: 'networkidle' });
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

try {
  await createSimpleExtrude();
  const before = await viewportState();
  assert.match(before.revision ?? '', /^occ-\d+$/);
  assert.equal(before.selectedBodyId, '');

  // Viewport -> application -> tree. The click resolves a durable ASA bodyId,
  // never a Three.js object/index, and must not run OpenCascade recompute.
  await clickProjectedWorldPoint([0, 0, 10]);
  await page.locator('.cad-app[data-selected-body-id]:not([data-selected-body-id=""])').waitFor();
  await page.getByText('Тело выбрано', { exact: true }).waitFor();
  const appBodyId = await page.locator('.cad-app').getAttribute('data-selected-body-id');
  assert.ok(appBodyId, 'viewport click did not produce an ASA body id');
  const selectedTreeRow = page.locator(`.tree-row[data-body-id="${appBodyId}"]`);
  await selectedTreeRow.waitFor();
  assert.equal(await selectedTreeRow.getAttribute('aria-pressed'), 'true');
  assert.equal(await selectedTreeRow.evaluate((node) => node.classList.contains('selected')), true);
  assert.equal((await viewportState()).selectedBodyId, appBodyId);
  assert.equal((await viewportState()).revision, before.revision, 'ordinary viewport selection triggered CAD recompute');
  console.log(`  ✓ viewport -> tree selection synchronized by bodyId ${appBodyId}`);

  // Esc clears ordinary selection in both surfaces and remains camera/runtime-only.
  await page.locator('[data-testid="cad-viewport"] canvas').focus();
  await page.keyboard.press('Escape');
  await page.locator('.cad-app[data-selected-body-id=""]').waitFor();
  await page.getByText('Выбор очищен', { exact: true }).waitFor();
  assert.equal(await selectedTreeRow.getAttribute('aria-pressed'), 'false');
  assert.equal((await viewportState()).selectedBodyId, '');
  assert.equal((await viewportState()).revision, before.revision, 'Esc selection clear triggered CAD recompute');
  console.log('  ✓ Esc clears synchronized ordinary selection without recompute');

  // Tree -> application -> viewport uses the exact same bodyId and visual state.
  await selectedTreeRow.click();
  await page.locator(`.cad-app[data-selected-body-id="${appBodyId}"]`).waitFor();
  assert.equal(await selectedTreeRow.getAttribute('aria-pressed'), 'true');
  assert.equal((await viewportState()).selectedBodyId, appBodyId);
  assert.equal((await viewportState()).revision, before.revision, 'tree selection triggered CAD recompute');
  console.log('  ✓ tree -> viewport selection synchronized through ASA state');

  // A command-specific selection mode must clear ordinary body selection rather
  // than mixing body selection with face/edge command input.
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.locator('[data-testid="cad-viewport"][data-selection-mode="face"]').waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-selected-body-id'), '');
  assert.equal((await viewportState()).selectedBodyId, '');
  assert.equal(await selectedTreeRow.getAttribute('aria-pressed'), 'false');
  assert.equal((await viewportState()).revision, before.revision, 'entering face-pick mode triggered CAD recompute');
  console.log('  ✓ command-specific face picking remains separate from ordinary body selection');

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2I ordinary body/tree selection PASS');
} finally {
  await browser.close();
}
