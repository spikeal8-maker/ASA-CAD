import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
const client = await context.newCDPSession(page);
const pageErrors = [];
const failedRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

function vector(value, label) {
  assert.ok(value, `missing ${label}`);
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3, `invalid ${label}: ${value}`);
  assert.ok(result.every(Number.isFinite), `non-finite ${label}: ${value}`);
  return result;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function state() {
  return page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
    bounds: node.getAttribute('data-bounds'),
    selectedBodyId: node.getAttribute('data-selected-body-id') ?? '',
  }));
}

async function canvasBox() {
  const box = await page.locator('[data-testid="cad-viewport"] canvas').boundingBox();
  assert.ok(box && box.width > 180 && box.height > 220, `phone CAD canvas unusable: ${JSON.stringify(box)}`);
  return box;
}

async function touch(type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      x: point.x,
      y: point.y,
      radiusX: 4,
      radiusY: 4,
      force: 1,
      id: point.id,
    })),
  });
}

async function singleFingerDrag(start, end, steps = 5) {
  await touch('touchStart', [{ id: 1, ...start }]);
  for (let index = 1; index <= steps; index++) {
    await touch('touchMove', [{
      id: 1,
      x: start.x + (end.x - start.x) * index / steps,
      y: start.y + (end.y - start.y) * index / steps,
    }]);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(120);
}

async function twoFingerGesture(startA, startB, endA, endB, steps = 5) {
  await touch('touchStart', [
    { id: 1, ...startA },
    { id: 2, ...startB },
  ]);
  for (let index = 1; index <= steps; index++) {
    await touch('touchMove', [
      {
        id: 1,
        x: startA.x + (endA.x - startA.x) * index / steps,
        y: startA.y + (endA.y - startA.y) * index / steps,
      },
      {
        id: 2,
        x: startB.x + (endB.x - startB.x) * index / steps,
        y: startB.y + (endB.y - startB.y) * index / steps,
      },
    ]);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(120);
}

async function tap(x, y) {
  await touch('touchStart', [{ id: 1, x, y }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(180);
}

async function projectedPoint(worldPoint) {
  const current = await state();
  const box = await canvasBox();
  const bounds = current.bounds?.split(',').map(Number) ?? [];
  assert.equal(bounds.length, 6, `invalid bounds: ${current.bounds}`);
  const diagonal = Math.max(Math.hypot(bounds[3]-bounds[0], bounds[4]-bounds[1], bounds[5]-bounds[2]), 10);
  const camera = new THREE.PerspectiveCamera(34, box.width / box.height, Math.max(diagonal / 1000, 0.01), diagonal * 100);
  camera.position.set(...vector(current.position, 'camera position'));
  camera.up.set(...vector(current.up, 'camera up'));
  camera.lookAt(new THREE.Vector3(...vector(current.target, 'camera target')));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const ndc = new THREE.Vector3(...worldPoint).project(camera);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `projected body point outside phone viewport: ${ndc.x},${ndc.y}`);
  return {
    x: box.x + (ndc.x + 1) * box.width / 2,
    y: box.y + (1 - ndc.y) * box.height / 2,
  };
}

try {
  console.log('\nASA-CAD M2I real touch interaction');
  const response = await page.goto(`${baseUrl}/dev/part/extrude?uiScale=100`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `phone fixture navigation failed: ${response?.status()}`);
  await page.locator('.cad-app[data-dev-fixture="extrude"][data-fixture-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });

  const initial = await state();
  assert.match(initial.revision ?? '', /^occ-\d+$/);
  const box = await canvasBox();
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  await singleFingerDrag({ x: cx, y: cy }, { x: cx + 55, y: cy - 28 });
  const afterOrbit = await state();
  assert.ok(distance(vector(initial.position, 'initial position'), vector(afterOrbit.position, 'orbit position')) > 0.5, 'one-finger touch did not orbit camera');
  assert.equal(afterOrbit.revision, initial.revision, 'one-finger orbit triggered CAD recompute');
  console.log('  ✓ one-finger drag orbits camera only');

  const panStartA = { x: cx - 42, y: cy };
  const panStartB = { x: cx + 42, y: cy };
  await twoFingerGesture(
    panStartA,
    panStartB,
    { x: panStartA.x + 28, y: panStartA.y + 24 },
    { x: panStartB.x + 28, y: panStartB.y + 24 },
  );
  const afterPan = await state();
  assert.ok(distance(vector(afterOrbit.target, 'orbit target'), vector(afterPan.target, 'pan target')) > 0.2, 'two-finger touch did not pan camera target');
  assert.equal(afterPan.revision, initial.revision, 'two-finger pan triggered CAD recompute');
  console.log('  ✓ two-finger parallel gesture pans camera only');

  const beforePinchDistance = distance(vector(afterPan.position, 'pan position'), vector(afterPan.target, 'pan target'));
  await twoFingerGesture(
    { x: cx - 36, y: cy },
    { x: cx + 36, y: cy },
    { x: cx - 82, y: cy },
    { x: cx + 82, y: cy },
  );
  const afterPinch = await state();
  const afterPinchDistance = distance(vector(afterPinch.position, 'pinch position'), vector(afterPinch.target, 'pinch target'));
  assert.ok(Math.abs(afterPinchDistance - beforePinchDistance) > 0.5, 'two-finger pinch did not change camera distance');
  assert.equal(afterPinch.revision, initial.revision, 'pinch zoom triggered CAD recompute');
  console.log('  ✓ two-finger pinch changes camera distance only');

  // Restore a deterministic view before tap-selection so the target point is
  // independent from the preceding touch navigation gestures.
  await page.locator('[data-testid="cad-viewport"] canvas').focus();
  await page.keyboard.press('0');
  await page.waitForTimeout(100);
  const point = await projectedPoint([15, 0, 10]);
  await tap(point.x, point.y);
  await page.locator('.cad-app[data-selected-body-id]:not([data-selected-body-id=""])').waitFor({ timeout: 5_000 });
  const bodyId = await page.locator('.cad-app').getAttribute('data-selected-body-id');
  assert.ok(bodyId, 'touch tap did not select ASA body');
  assert.equal(await page.locator(`.tree-row[data-body-id="${bodyId}"]`).getAttribute('aria-pressed'), 'true', 'touch-selected body did not synchronize Tree');
  assert.equal((await state()).revision, initial.revision, 'touch selection triggered CAD recompute');
  console.log(`  ✓ touch tap selects ${bodyId} and synchronizes Tree`);

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2I real touch interaction PASS\n');
} finally {
  await context.close();
  await browser.close();
}
