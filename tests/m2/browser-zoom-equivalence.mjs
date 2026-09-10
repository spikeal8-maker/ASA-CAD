import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });

// Chrome desktop zoom changes the effective CSS viewport and reported DPR.
// Model that observable contract directly instead of using CSS zoom/transform,
// which would not represent browser behavior and can hide pointer-coordinate bugs.
const zoomCases = [
  { zoom: 80, width: 2400, height: 1350, dpr: 0.8 },
  { zoom: 100, width: 1920, height: 1080, dpr: 1 },
  { zoom: 125, width: 1536, height: 864, dpr: 1.25 },
  { zoom: 150, width: 1280, height: 720, dpr: 1.5 },
  { zoom: 200, width: 960, height: 540, dpr: 2 },
];

async function shellCase(testCase) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: testCase.dpr,
  });
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/?uiScale=100`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `zoom ${testCase.zoom}% navigation failed`);
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  const metrics = await page.evaluate(() => {
    const work = document.querySelector('.work-area')?.getBoundingClientRect();
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      workWidth: work?.width ?? 0,
      workHeight: work?.height ?? 0,
      rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      uiScale: Number(document.documentElement.dataset.uiScale),
    };
  });
  assert.equal(metrics.width, testCase.width);
  assert.equal(metrics.height, testCase.height);
  assert.ok(Math.abs(metrics.dpr - testCase.dpr) <= 0.05, `zoom ${testCase.zoom}% DPR ${metrics.dpr}`);
  assert.equal(metrics.uiScale, 100, `zoom ${testCase.zoom}% unexpectedly changed explicit ASA UI Scale`);
  assert.ok(metrics.scrollWidth <= testCase.width + 1, `zoom ${testCase.zoom}% caused horizontal overflow ${metrics.scrollWidth}/${testCase.width}`);
  assert.ok(metrics.workWidth > 0 && metrics.workWidth <= testCase.width + 1, `zoom ${testCase.zoom}% invalid WorkArea width ${metrics.workWidth}`);
  assert.ok(metrics.workHeight >= testCase.height * 0.50, `zoom ${testCase.zoom}% WorkArea too short ${metrics.workHeight}/${testCase.height}`);
  assert.ok(metrics.rootFont >= 14, `zoom ${testCase.zoom}% shell text unexpectedly shrank`);
  await context.close();
  return metrics;
}

function parseVector(value, label) {
  assert.ok(value, `missing ${label}`);
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3, `invalid ${label}`);
  return result;
}

async function provePickingAtZoom150() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/dev/part/extrude?uiScale=100`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), '150% B-Rep fixture navigation failed');
  await page.locator('.cad-app[data-dev-fixture="extrude"][data-fixture-status="ready"]').waitFor({ timeout: 120_000 });
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  await canvas.waitFor({ timeout: 60_000 });
  const before = await viewport.evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    bounds: node.getAttribute('data-bounds'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
  }));
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, '150% B-Rep canvas has no bounds');
  const bounds = before.bounds?.split(',').map(Number) ?? [];
  assert.equal(bounds.length, 6);
  const diagonal = Math.max(Math.hypot(bounds[3]-bounds[0], bounds[4]-bounds[1], bounds[5]-bounds[2]), 10);
  const camera = new THREE.PerspectiveCamera(34, box.width / box.height, Math.max(diagonal / 1000, 0.01), diagonal * 100);
  camera.position.set(...parseVector(before.position, 'camera position'));
  camera.up.set(...parseVector(before.up, 'camera up'));
  camera.lookAt(new THREE.Vector3(...parseVector(before.target, 'camera target')));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const ndc = new THREE.Vector3(15, 0, 10).project(camera);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, '150% projected body point outside viewport');
  await canvas.click({ position: { x: (ndc.x + 1) * box.width / 2, y: (1 - ndc.y) * box.height / 2 } });
  await page.locator('.cad-app[data-selected-body-id]:not([data-selected-body-id=""])').waitFor();
  const selectedBodyId = await page.locator('.cad-app').getAttribute('data-selected-body-id');
  assert.ok(selectedBodyId, '150% browser-equivalent viewport failed body picking');
  assert.equal(await viewport.getAttribute('data-runtime-revision'), before.revision, 'browser-equivalent zoom/pick triggered recompute');
  assert.equal(await page.locator(`.tree-row[data-body-id="${selectedBodyId}"]`).getAttribute('aria-pressed'), 'true');
  await context.close();
  return selectedBodyId;
}

try {
  console.log('\nASA-CAD M2R browser zoom effective-viewport equivalence');
  for (const testCase of zoomCases) {
    const metrics = await shellCase(testCase);
    console.log(`  ✓ ${testCase.zoom}% => ${metrics.width}×${metrics.height} CSS @ DPR ${metrics.dpr}; work ${Math.round(metrics.workWidth)}×${Math.round(metrics.workHeight)}`);
  }
  const bodyId = await provePickingAtZoom150();
  console.log(`  ✓ 150% equivalent viewport preserves real B-Rep picking for ${bodyId}`);
  console.log('ASA-CAD M2R browser zoom equivalence PASS\n');
} finally {
  await browser.close();
}
