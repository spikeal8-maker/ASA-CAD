import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

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

function isPlaneGcsWasm(name) {
  return /planegcs/i.test(name);
}

function nonPlaneGcsWasm(names) {
  return names.filter((name) => !isPlaneGcsWasm(name));
}

function near(actual, expected, tolerance = 0.2, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function parseVector(value, label) {
  assert.ok(value, `missing ${label}`);
  const result = value.split(',').map(Number);
  assert.equal(result.length, 3, `invalid ${label}: ${value}`);
  assert.ok(result.every(Number.isFinite), `non-finite ${label}: ${value}`);
  return result;
}

async function currentBounds() {
  const raw = await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw, 'viewport has no data-bounds');
  const values = raw.split(',').map(Number);
  assert.equal(values.length, 6, `invalid viewport bounds: ${raw}`);
  assert.ok(values.every(Number.isFinite), `non-finite viewport bounds: ${raw}`);
  return values;
}

async function assertBounds(expected, tolerance = 0.2) {
  const actual = await currentBounds();
  for (let index = 0; index < expected.length; index++) {
    near(actual[index], expected[index], tolerance, `bounds[${index}]`);
  }
}

async function clickProjectedWorldPoint(worldPoint) {
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'CAD viewport canvas has no usable bounds');

  // Project through the viewport's actual camera state. This deliberately does
  // not reproduce CadViewport's camera-placement formula: Fit/standard views
  // are allowed to change that formula without making topology-pick E2E stale.
  const cameraState = await viewport.evaluate((node) => ({
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
    up: node.getAttribute('data-camera-up'),
  }));
  const position = parseVector(cameraState.position, 'camera position');
  const target = parseVector(cameraState.target, 'camera target');
  const up = parseVector(cameraState.up, 'camera up');
  const bounds = await currentBounds();
  const diagonal = Math.max(
    Math.hypot(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]),
    10,
  );

  const camera = new THREE.PerspectiveCamera(34, box.width / box.height, Math.max(diagonal / 1000, 0.01), diagonal * 100);
  camera.position.set(...position);
  camera.up.set(...up);
  camera.lookAt(new THREE.Vector3(...target));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const ndc = new THREE.Vector3(...worldPoint).project(camera);
  assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `world point ${worldPoint.join(',')} projects outside viewport: ${ndc.x},${ndc.y}`);
  await canvas.click({
    position: {
      x: (ndc.x + 1) * box.width / 2,
      y: (1 - ndc.y) * box.height / 2,
    },
  });
}

async function applyPrimary() {
  const button = page.locator('.parameter-actions button.primary');
  await button.waitFor();
  await button.click();
}

async function finishSketch() {
  const button = page.getByRole('button', { name: /Завершить эскиз/ });
  await button.waitFor();
  await button.click();
  await page.getByText('Эскиз завершен', { exact: true }).waitFor();
}

async function createProtectedExtrude() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'CAD route must be cross-origin isolated');
  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded on initial shell boot');

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await applyPrimary();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  assert.deepEqual(await loadedWasmResources(), [], 'Any CAD WASM loaded while creating an empty sketch');
  const emptyOverlay = page.locator('[data-testid="cad-sketch-overlay"]');
  await emptyOverlay.waitFor();
  assert.equal(await emptyOverlay.getAttribute('data-overlay-source'), 'document');
  assert.equal(await emptyOverlay.getAttribute('data-entity-count'), '0');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');
  const height = page.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input');
  assert.equal(await width.inputValue(), '60');
  assert.equal(await height.inputValue(), '40');
  await applyPrimary();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();

  const solveStatus = page.locator('[data-testid="sketch-solve-status"][data-solve-status="solved"]');
  await solveStatus.waitFor({ timeout: 60_000 });
  const solvedOverlay = page.locator('[data-testid="cad-sketch-overlay"]');
  await solvedOverlay.waitFor();
  assert.equal(await solvedOverlay.getAttribute('data-overlay-source'), 'solver-preview');
  assert.equal(await solvedOverlay.getAttribute('data-entity-count'), '4');
  assert.equal(await page.locator('[data-testid="sketch-dof"]').textContent(), 'DoF: н/д');

  const sketchWasm = await loadedWasmResources();
  assert.ok(sketchWasm.some(isPlaneGcsWasm), 'PlaneGCS WASM was not loaded for active Sketch solve: ' + sketchWasm.join(', '));
  assert.deepEqual(nonPlaneGcsWasm(sketchWasm), [], 'OpenCascade/other WASM loaded during Sketch solve: ' + sketchWasm.join(', '));

  await finishSketch();
  await page.locator('[data-testid="cad-sketch-overlay"]').waitFor({ state: 'detached' });

  const extrudeButton = page.getByRole('button', { name: /Элемент выдавливания/i });
  assert.equal(await extrudeButton.isEnabled(), true, 'Extrude should be enabled after the rectangle sketch is finished');
  await extrudeButton.click();

  const distance = page.locator('.numeric-field').filter({ hasText: 'Расстояние' }).locator('input');
  assert.equal(await distance.inputValue(), '10');
  assert.deepEqual(nonPlaneGcsWasm(await loadedWasmResources()), [], 'OpenCascade WASM loaded before the solid command was committed');

  await applyPrimary();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
  await page.getByText('Тело 1', { exact: true }).waitFor();
  await page.getByText('Выдавливание 10 мм построено локально', { exact: true }).waitFor();
  await assertBounds([-30, -20, 0, 30, 20, 10]);

  const loadedWasm = await loadedWasmResources();
  assert.ok(loadedWasm.some(isPlaneGcsWasm), 'PlaneGCS WASM disappeared after solid operation');
  assert.ok(nonPlaneGcsWasm(loadedWasm).length >= 1, 'OpenCascade WASM was not loaded for the first solid operation: ' + loadedWasm.join(', '));
  assert.ok(wasmRequests.some(isPlaneGcsWasm), 'No PlaneGCS WASM network request was observed');
  assert.ok(nonPlaneGcsWasm(wasmRequests).length >= 1, 'No OpenCascade WASM network request was observed');

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

  console.log('  ✓ lazy kernels: PlaneGCS in Sketch, OpenCascade first solid (' + loadedWasm.length + ' WASM resource(s))');
  console.log(`  ✓ real B-Rep viewport: ${Math.round(viewport.width)}×${Math.round(viewport.height)}, ${viewport.revision}`);
}

async function createHoleAndFillet() {
  // New sketch must be attached through a persisted StableRef, not a transient face ordinal.
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Грань построения', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-viewport"][data-selection-mode="face"]').waitFor();
  await clickProjectedWorldPoint([0, 0, 10]);
  await page.locator('.cad-app[data-selected-kind="face"]').waitFor();
  await page.getByText('Грань выбрана', { exact: true }).waitFor();
  await applyPrimary();
  await page.getByText('Эскиз 2', { exact: true }).waitFor();
  await page.getByText('Создан эскиз на выбранной грани', { exact: true }).waitFor();

  await page.getByRole('button', { name: /Окружность/i }).click();
  const diameter = page.locator('.numeric-field').filter({ hasText: 'Диаметр' }).locator('input');
  assert.equal(await diameter.inputValue(), '12');
  await applyPrimary();
  await page.getByText('Окружность Ø12 мм создана', { exact: true }).waitFor();
  await finishSketch();

  const cutButton = page.getByRole('button', { name: /Вырезать выдавливанием/i });
  assert.equal(await cutButton.isEnabled(), true, 'Cut should be enabled after the circle sketch is finished');
  await cutButton.click();
  await page.getByText('Сквозь всё', { exact: true }).waitFor();
  await applyPrimary();
  await page.getByText('Сквозной вырез построен локально', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText('Вырезать выдавливанием 1', { exact: true }).waitFor();
  await assertBounds([-30, -20, 0, 30, 20, 10]);

  const filletButton = page.getByRole('button', { name: /Скругление/i });
  assert.equal(await filletButton.isEnabled(), true, 'Fillet should be enabled after through cut');
  await filletButton.click();
  await page.locator('[data-testid="cad-viewport"][data-selection-mode="edge"]').waitFor();
  await page.getByText('Выберите ребро в модели', { exact: true }).waitFor();
  await clickProjectedWorldPoint([0, -20, 0]);
  await page.locator('.cad-app[data-selected-kind="edge"]').waitFor();
  await page.getByText('Ребро выбрано', { exact: true }).waitFor();
  const radius = page.locator('.numeric-field').filter({ hasText: 'Радиус' }).locator('input');
  assert.equal(await radius.inputValue(), '1');
  await applyPrimary();
  await page.getByText('Скругление R1 построено локально', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText('Скругление 1', { exact: true }).waitFor();
  await assertBounds([-30, -20, 0, 30, 20, 10]);

  console.log('  ✓ top-face StableRef -> centered Ø12 through cut');
  console.log('  ✓ stable edge selection -> R1 fillet');
}

async function editWidthAndVerifyHistory() {
  const widthRow = page.getByRole('button', { name: /Ширина: 60 мм/ });
  await widthRow.waitFor();
  await widthRow.click();
  await page.getByText('Изменить размер', { exact: true }).waitFor();
  const value = page.locator('.numeric-field').filter({ hasText: 'Размер' }).locator('input');
  assert.equal(await value.inputValue(), '60');
  await value.fill('80');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByText('Ширина изменен на 80 мм; модель перестроена', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: /Ширина: 80 мм/ }).waitFor();
  await page.getByText('Вырезать выдавливанием 1', { exact: true }).waitFor();
  await page.getByText('Скругление 1', { exact: true }).waitFor();
  await assertBounds([-40, -20, 0, 40, 20, 10]);

  console.log('  ✓ driving width 60 -> 80 recomputes downstream cut + stable fillet');
}

async function saveAndInspectDocument() {
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();

  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(saved, 'saved Part document missing from localStorage');
  const document = JSON.parse(saved);
  assert.equal(document.kind, 'part');
  assert.equal(document.sketches.length, 2);
  assert.deepEqual(document.features.map((feature) => feature.type), ['extrude', 'cut-extrude', 'fillet']);
  assert.equal(document.bodies.length, 1);
  assert.equal(document.stableReferences.length, 2, 'expected one face StableRef and one edge StableRef');
  assert.equal(document.dimensions.find((item) => item.name === 'width')?.value, 80);
  assert.equal(document.dimensions.find((item) => item.name === 'height')?.value, 40);
  assert.equal(document.dimensions.find((item) => item.name === 'diameter')?.value, 12);
  assert.equal(saved.includes('TopoDS'), false, 'serialized document leaked OCC native types');
  assert.equal(saved.includes('faceIndex'), false, 'serialized document leaked transient face index');
  assert.equal(saved.includes('segmentIndex'), false, 'serialized document leaked transient edge segment index');

  console.log('  ✓ saved parametric JSON contains history + 2 StableRefs and no transient topology ordinals');
}

async function reloadReopenAndEditHole() {
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await page.getByText('Новая деталь', { exact: true }).waitFor();
  assert.deepEqual(await loadedWasmResources(), [], 'Reloaded empty shell eagerly loaded OpenCascade WASM');

  await page.getByTitle('Открыть').click();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
  await page.getByText('Вырезать выдавливанием 1', { exact: true }).waitFor();
  await page.getByText('Скругление 1', { exact: true }).waitFor();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
  await assertBounds([-40, -20, 0, 40, 20, 10]);

  const state = await page.locator('.cad-app').evaluate((node) => ({
    kind: node.getAttribute('data-document-kind'),
    runtime: node.getAttribute('data-runtime-status'),
  }));
  assert.deepEqual(state, { kind: 'part', runtime: 'ready' });

  // Reopened history is still editable, not a dumb mesh.
  await page.getByRole('button', { name: /Диаметр: 12 мм/ }).click();
  const value = page.locator('.numeric-field').filter({ hasText: 'Размер' }).locator('input');
  assert.equal(await value.inputValue(), '12');
  await value.fill('14');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByText('Диаметр изменен на 14 мм; модель перестроена', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: /Диаметр: 14 мм/ }).waitFor();
  await page.getByText('Скругление 1', { exact: true }).waitFor();
  await assertBounds([-40, -20, 0, 40, 20, 10]);

  console.log('  ✓ saved Part reopens/recomputes locally with editable history');
  console.log('  ✓ reopened Ø12 driving dimension edits to Ø14 without losing downstream fillet');
}

try {
  console.log('\nASA-CAD M2 protected Part browser slice');
  await createProtectedExtrude();
  await createHoleAndFillet();
  await editWidthAndVerifyHistory();
  await saveAndInspectDocument();
  await reloadReopenAndEditHole();
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('  ✓ M2 full protected Part browser workflow PASS\n');
} finally {
  await browser.close();
}
