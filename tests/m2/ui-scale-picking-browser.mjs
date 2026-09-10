import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
const pageErrors = [];
const failedRequests = [];
const wasmRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});

function parseVector(value, label) {
  assert.ok(value, `missing ${label}`);
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3, `invalid ${label}: ${value}`);
  assert.ok(result.every(Number.isFinite), `non-finite ${label}: ${value}`);
  return result;
}

async function viewportState() {
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const box = await viewport.locator('canvas').boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'CAD canvas has no usable bounds');
  const state = await viewport.evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    selectedBodyId: node.getAttribute('data-selected-body-id') ?? '',
    bounds: node.getAttribute('data-bounds'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
  }));
  const shell = await page.evaluate(() => ({
    mode: document.documentElement.dataset.uiScaleMode,
    scale: Number(document.documentElement.dataset.uiScale),
    rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));
  return { ...state, box, shell };
}

async function clickProjectedWorldPoint(worldPoint) {
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  const state = await viewportState();
  const bounds = state.bounds?.split(',').map(Number) ?? [];
  assert.equal(bounds.length, 6, `invalid viewport bounds: ${state.bounds}`);
  const diagonal = Math.max(
    Math.hypot(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]),
    10,
  );
  const camera = new THREE.PerspectiveCamera(
    34,
    state.box.width / state.box.height,
    Math.max(diagonal / 1000, 0.01),
    diagonal * 100,
  );
  camera.position.set(...parseVector(state.position, 'camera position'));
  camera.up.set(...parseVector(state.up, 'camera up'));
  camera.lookAt(new THREE.Vector3(...parseVector(state.target, 'camera target')));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const ndc = new THREE.Vector3(...worldPoint).project(camera);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `world point projects outside viewport: ${ndc.x},${ndc.y}`);
  await canvas.click({
    position: {
      x: (ndc.x + 1) * state.box.width / 2,
      y: (1 - ndc.y) * state.box.height / 2,
    },
  });
}

async function setUiScale(preference, expectedResolved) {
  await page.evaluate((next) => {
    const controller = window.__ASA_CAD_UI_SCALE__;
    if (!controller) throw new Error('ASA UI Scale controller is not installed');
    controller.setPreference(next);
  }, preference);
  await page.locator(`html[data-ui-scale="${expectedResolved}"]`).waitFor();
  const state = await viewportState();
  assert.equal(state.shell.mode, String(preference));
  assert.equal(state.shell.scale, expectedResolved);
  return state;
}

async function clearSelection() {
  await page.locator('[data-testid="cad-viewport"] canvas').focus();
  await page.keyboard.press('Escape');
  await page.locator('.cad-app[data-selected-body-id=""]').waitFor();
}

async function assertSameBodyPick(expectedBodyId, expectedRevision) {
  await clickProjectedWorldPoint([20, 0, 10]);
  await page.locator('.cad-app[data-selected-body-id]:not([data-selected-body-id=""])').waitFor();
  const bodyId = await page.locator('.cad-app').getAttribute('data-selected-body-id');
  assert.ok(bodyId, 'ordinary body pick did not produce an ASA bodyId');
  if (expectedBodyId) assert.equal(bodyId, expectedBodyId, 'UI Scale changed selected ASA body identity');
  const treeRow = page.locator(`.tree-row[data-body-id="${bodyId}"]`);
  await treeRow.waitFor();
  assert.equal(await treeRow.getAttribute('aria-pressed'), 'true');
  assert.equal((await viewportState()).revision, expectedRevision, 'UI Scale/body picking triggered CAD recompute');
  return bodyId;
}

try {
  console.log('\nASA-CAD M2R UI Scale + real B-Rep picking');
  const response = await page.goto(`${baseUrl}/dev/part/reference?uiScale=100`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `fixture navigation failed: ${response?.status()}`);
  await page.locator('.cad-app[data-dev-fixture="reference"][data-fixture-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });

  const initial = await viewportState();
  assert.equal(initial.shell.scale, 100);
  assert.match(initial.revision ?? '', /^occ-\d+$/);
  assert.equal(wasmRequests.length, 1, 'reference fixture should load OpenCascade once');
  const bodyId = await assertSameBodyPick(null, initial.revision);
  console.log(`  ✓ UI 100% picks body ${bodyId}`);
  await clearSelection();

  const scale125 = await setUiScale(125, 125);
  assert.equal(scale125.revision, initial.revision, 'UI 125 triggered CAD recompute');
  assert.ok(scale125.shell.rootFont > initial.shell.rootFont, 'UI 125 did not enlarge shell text');
  assert.ok(scale125.box.width > 1000 && scale125.box.height > 700, 'UI 125 collapsed B-Rep viewport');
  await assertSameBodyPick(bodyId, initial.revision);
  console.log(`  ✓ UI 125% keeps real B-Rep picking and runtime ${initial.revision}`);
  await clearSelection();

  const scale90 = await setUiScale(90, 90);
  assert.equal(scale90.revision, initial.revision, 'UI 90 triggered CAD recompute');
  assert.ok(scale90.shell.rootFont >= 12, `UI 90 text fell below readability floor: ${scale90.shell.rootFont}px`);
  await assertSameBodyPick(bodyId, initial.revision);
  console.log('  ✓ UI 90% keeps the same body identity and readable text floor');
  await clearSelection();

  const auto = await setUiScale('auto', 110);
  assert.equal(auto.revision, initial.revision, 'Auto scale triggered CAD recompute');
  await assertSameBodyPick(bodyId, initial.revision);
  console.log('  ✓ Auto => 110% on 2560×1440 and picking remains correct');

  assert.equal(wasmRequests.length, 1, 'UI Scale change reloaded OpenCascade WASM');
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2R UI Scale + B-Rep picking PASS\n');
} finally {
  await browser.close();
}
