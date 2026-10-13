import assert from 'node:assert/strict';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { runView } from './shell-selectors.mjs';

// C1 / KOMPAS-CORE-INTERACTION-001 — Unified Part Viewport on the ordinary /cad/ route.
const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
const failed = [];
const wasm = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('request', (request) => { if (/\.wasm(?:\?|$)/i.test(request.url()) && !/planegcs/i.test(request.url())) wasm.push(request.url()); });

const viewport = () => page.locator('[data-testid="cad-viewport"]');
const sceneCanvas = () => page.locator('[data-testid="cad-viewport"][data-scene-revision="reference"] canvas');
const treePlane = (id) => page.locator(`[data-tree-node="plane-${id.toLowerCase()}"]`);

function vector(value, label) {
  const result = (value ?? '').split(',').map(Number);
  assert.ok(result.length === 3 && result.every(Number.isFinite), `invalid ${label}: ${value}`);
  return result;
}

async function camera() {
  return viewport().evaluate((node) => ({
    view: node.getAttribute('data-view-name'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
    changes: Number(node.getAttribute('data-view-change-count') ?? '0'),
  }));
}

async function openEmptyPart() {
  await page.goto(`${base}/cad/?uiScale=100`, { waitUntil: 'networkidle' });
  await page.locator('.k-main-menu-bar, .brand-button').first().waitFor();
  await page.locator('[data-testid="part-model-stage"][data-workarea-kind="part-empty"]').waitFor({ state: 'attached' });
  await sceneCanvas().waitFor();
}

async function projected(worldPoint) {
  const box = await sceneCanvas().boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'scene canvas has no usable bounds');
  const state = await camera();
  const cam = new THREE.PerspectiveCamera(34, box.width / box.height, 0.1, 100000);
  cam.position.set(...vector(state.position, 'camera position'));
  cam.up.set(...vector(state.up, 'camera up'));
  cam.lookAt(new THREE.Vector3(...vector(state.target, 'camera target')));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const ndc = new THREE.Vector3(...worldPoint).project(cam);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `point projects outside viewport: ${ndc.x},${ndc.y}`);
  return { x: box.x + (ndc.x + 1) * box.width / 2, y: box.y + (1 - ndc.y) * box.height / 2 };
}

// Points lie on exactly one origin plane and no other plane is crossed on the way from the camera.
const PLANE_POINTS = { XY: [30, -30, 0], XZ: [30, 0, 30], YZ: [0, -30, 30] };

async function clickScenePlane(id) {
  const point = await projected(PLANE_POINTS[id]);
  await page.mouse.click(point.x, point.y);
}

async function assertSelectedPlane(id) {
  const value = id ?? '';
  await page.locator(`[data-testid="cad-viewport"][data-selected-plane="${value}"]`).waitFor();
  await page.locator(`[data-testid="part-model-stage"][data-selected-base-plane="${value}"]`).waitFor({ state: 'attached' });
  if (await treePlane('XY').count()) {
    for (const plane of ['XY', 'XZ', 'YZ']) {
      const state = await treePlane(plane).evaluate((node) => node.getAttribute('aria-pressed') ?? node.getAttribute('aria-selected'));
      assert.equal(state, String(plane === id), `tree selection mismatch for ${plane}`);
    }
  }
}

async function savedDocument() {
  await page.locator(':is(.global-actions, .k-command-ribbon) [data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const raw = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw, 'saved Part document missing');
  return JSON.parse(raw);
}

// ENTRY-04: the whole control is visible above the status bar and every corner takes the click.
async function assertReachable(locator, label) {
  const state = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const status = document.querySelector('.status-bar')?.getBoundingClientRect();
    const probes = [[0.5, 0.5], [0.08, 0.12], [0.92, 0.12], [0.08, 0.88], [0.92, 0.88]].map(([fx, fy]) => {
      const top = document.elementFromPoint(rect.left + rect.width * fx, rect.top + rect.height * fy);
      return Boolean(top && (top === node || node.contains(top)));
    });
    return { rect: rect.toJSON(), statusTop: status ? status.top : innerHeight, probes, width: innerWidth, height: innerHeight };
  });
  const { rect } = state;
  assert.ok(rect.width > 0 && rect.height > 0, `${label} is not rendered`);
  assert.ok(rect.top >= 0 && rect.left >= 0 && rect.right <= state.width && rect.bottom <= state.height, `${label} is clipped: ${JSON.stringify(rect)}`);
  assert.ok(rect.bottom <= state.statusTop + 0.5, `${label} runs under the status bar: bottom ${rect.bottom} > ${state.statusTop}`);
  assert.ok(state.probes.every(Boolean), `${label} is partly covered by another element: ${state.probes}`);
}

try {
  // 1. Empty Part: persistent spatial scene instead of a splash, no kernel.
  await openEmptyPart();
  assert.equal(await viewport().getAttribute('data-reference-planes'), 'XY,XZ,YZ');
  assert.equal(await viewport().getAttribute('data-runtime-revision'), '', 'empty Part built B-Rep');
  assert.equal(await page.getByText('Новая деталь', { exact: true }).count(), 0, 'splash replaced the work area');
  await assertSelectedPlane(null);
  console.log('  ✓ empty Part opens on origin + XY/XZ/YZ scene, no splash, no B-Rep');

  // 2. One selection state for scene and tree.
  await clickScenePlane('XZ');
  await assertSelectedPlane('XZ');
  await treePlane('YZ').click();
  await assertSelectedPlane('YZ');
  await clickScenePlane('XY');
  await assertSelectedPlane('XY');
  await page.locator('.cad-app').focus();
  await page.keyboard.press('Escape');
  await assertSelectedPlane(null);
  console.log('  ✓ scene ↔ tree plane selection is one state; Esc clears it');

  // 3. Standard views and mouse navigation on the same camera without any body.
  const initial = await camera();
  assert.equal(initial.view, 'isometric');
  await runView(page, 'view.top');
  await page.locator('[data-testid="cad-viewport"][data-view-name="top"]').waitFor();
  const top = await camera();
  const topDirection = vector(top.position, 'top position').map((value, index) => value - vector(top.target, 'top target')[index]);
  assert.ok(topDirection[2] > 0 && Math.abs(topDirection[0]) < 1e-3 && Math.abs(topDirection[1]) < 1e-3, `top view direction ${topDirection}`);
  await runView(page, 'view.iso');
  await page.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
  const iso = await camera();

  const box = await sceneCanvas().boundingBox();
  const cx = box.x + box.width * 0.72;
  const cy = box.y + box.height * 0.25;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  const rotated = await camera();
  assert.notEqual(rotated.position, iso.position, 'RMB drag did not rotate');
  assert.equal(rotated.target, iso.target, 'RMB rotate moved the target');

  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cx - 90, cy + 30, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  const panned = await camera();
  assert.notEqual(panned.target, rotated.target, 'MMB drag did not pan');

  const distance = (state) => Math.hypot(...vector(state.position, 'p').map((value, index) => value - vector(state.target, 't')[index]));
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -600);
  await page.waitForFunction((before) => Number(document.querySelector('[data-testid="cad-viewport"]').getAttribute('data-view-change-count')) > before, panned.changes);
  const zoomed = await camera();
  assert.ok(distance(zoomed) < distance(panned), 'wheel did not zoom in');
  assert.equal(await page.locator('[data-testid="cad-viewport"] canvas').count(), 1, 'navigation replaced the scene');
  console.log('  ✓ views + RMB rotate / MMB pan / wheel zoom work on the empty Part');

  // 4. "Select, then command": the selected scene plane is the Sketch support.
  await runView(page, 'view.iso');
  await page.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
  await clickScenePlane('XZ');
  await assertSelectedPlane('XZ');
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  const panel = page.locator(':is(.parameter-panel, .k-pp)');
  await panel.waitFor();
  const chosen = panel.locator('.plane-grid button.selected, [aria-label^="Плоскость "][aria-pressed="true"]');
  assert.match(await chosen.evaluate((node) => node.getAttribute('aria-label') ?? node.textContent ?? ''), /XZ/, 'parameters disagree with scene selection');
  await assertSelectedPlane('XZ');
  for (const size of [{ width: 1600, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    await assertReachable(panel.locator('.parameter-actions button.primary, .k-pp-ok'), `Создать at ${size.width}×${size.height}`);
    await assertReachable(panel.locator('.parameter-actions button:not(.primary), .k-pp-cancel'), `Отмена at ${size.width}×${size.height}`);
    // The KOMPAS shell has no status bar; the compact shell must keep it unclipped.
    const status = await page.locator('.k-main-menu-bar').count() ? null : await page.locator('.status-bar').boundingBox();
    if (await page.locator('.k-main-menu-bar').count() === 0) assert.ok(status && status.height >= 20 && status.y + status.height <= size.height, `status bar clipped at ${size.width}×${size.height}`);
  }
  await page.setViewportSize({ width: 1600, height: 900 });
  await panel.locator('.parameter-actions button.primary, .k-pp-ok').click();
  await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
  const first = await savedDocument();
  assert.equal(first.sketches[0].support, 'XZ', 'Sketch was not created on the selected plane');
  console.log('  ✓ select XZ, then «Создать эскиз» → Sketch support XZ; buttons reachable at 1600×900 and 1366×768');

  // 5. "Command, then select": the parameters plane follows a scene pick.
  await openEmptyPart();
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await panel.waitFor();
  await assertSelectedPlane('XY');
  await clickScenePlane('YZ');
  await assertSelectedPlane('YZ');
  const followed = panel.locator('.plane-grid button.selected, [aria-label^="Плоскость "][aria-pressed="true"]');
  assert.match(await followed.evaluate((node) => node.getAttribute('aria-label') ?? node.textContent ?? ''), /YZ/, 'parameters did not follow the scene pick');
  await panel.locator('.parameter-actions button.primary, .k-pp-ok').click();
  await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
  const second = await savedDocument();
  assert.equal(second.sketches[0].support, 'YZ', 'Sketch was not created on the plane picked during the command');
  console.log('  ✓ «Создать эскиз», then pick YZ in the scene → Sketch support YZ');

  // 6. Cancel leaves the document untouched.
  await openEmptyPart();
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await panel.waitFor();
  await panel.locator('.parameter-actions button:not(.primary), .k-pp-cancel').click();
  await page.locator('.cad-app[data-sketch-count="0"]').waitFor();
  assert.equal(await page.locator(':is(.dirty-dot, [data-document-dirty="true"])').count(), 0, 'cancelled command dirtied the document');
  console.log('  ✓ cancel keeps the empty Part unchanged');

  assert.deepEqual(wasm, [], `origin scene / Sketch creation loaded OpenCascade: ${wasm.join(', ')}`);
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed, [], `failed requests: ${failed.join(' | ')}`);
  console.log('ASA-CAD C1 unified Part viewport PASS');
} finally {
  await browser.close();
}
