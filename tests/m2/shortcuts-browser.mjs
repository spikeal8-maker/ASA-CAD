import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const failedRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

function vector(raw) {
  assert.ok(raw, 'missing camera vector');
  const value = raw.split(',').map(Number);
  assert.equal(value.length, 3);
  assert.ok(value.every(Number.isFinite));
  return value;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function cameraState() {
  return page.locator('[data-testid="cad-viewport"]').evaluate((node) => ({
    revision: node.getAttribute('data-runtime-revision'),
    view: node.getAttribute('data-view-name'),
    position: node.getAttribute('data-camera-position'),
    target: node.getAttribute('data-camera-target'),
  }));
}

async function createPartWithKeyboardCommit() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByRole('button', { name: /Завершить эскиз/ }).click();
  await page.getByRole('button', { name: /Элемент выдавливания/i }).click();

  const distanceInput = page.locator('.numeric-field').filter({ hasText: 'Расстояние' }).locator('input');
  await distanceInput.focus();
  assert.equal(await distanceInput.inputValue(), '10');
  await page.keyboard.press('Control+Enter');

  await page.getByText('Выдавливание 10 мм построено локально', { exact: true }).waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
}

try {
  await createPartWithKeyboardCommit();
  const viewport = page.locator('[data-testid="cad-viewport"]');
  const canvas = viewport.locator('canvas');
  const initial = await cameraState();
  assert.match(initial.revision ?? '', /^occ-\d+$/);

  // Focus-safe parameter editing: navigation/undo shortcuts stay with the input,
  // while Ctrl+S and command lifecycle keys are still allowed by policy.
  await page.getByRole('button', { name: /Ширина: 60 мм/ }).click();
  const dimensionInput = page.locator('.numeric-field').filter({ hasText: 'Размер' }).locator('input');
  await dimensionInput.focus();
  const beforeInputKeys = await cameraState();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('f');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  const afterInputKeys = await cameraState();
  assert.equal(afterInputKeys.view, beforeInputKeys.view, 'input focus leaked F into viewport Fit');
  assert.ok(distance(vector(afterInputKeys.target), vector(beforeInputKeys.target)) < 1e-6, 'input focus leaked ArrowRight into viewport pan');
  await page.getByText('Изменить размер', { exact: true }).waitFor();

  await page.keyboard.press('Control+s');
  await page.getByText(/Сохранено локально · ревизия \d+/).waitFor();
  const savedProject = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('asa-cad-project:'));
    return key ? localStorage.getItem(key) : null;
  });
  assert.ok(savedProject, 'Ctrl+S did not save through CadProjectHost');
  const savedRecord = JSON.parse(savedProject);
  assert.ok(Number.isSafeInteger(savedRecord.revision) && savedRecord.revision >= 1, 'Ctrl+S did not advance host revision');
  assert.equal(typeof savedRecord.serializedDocument, 'string', 'Ctrl+S host record has no CadDocument payload');

  await page.keyboard.press('Escape');
  await page.getByText('Команда отменена', { exact: true }).waitFor();

  // View shortcuts operate only on the camera and keep the same CAD revision.
  await canvas.focus();
  await page.keyboard.press('1');
  await viewport.locator('xpath=.').evaluate(() => undefined);
  await page.locator('[data-testid="cad-viewport"][data-view-name="front"]').waitFor();
  await page.keyboard.press('2');
  await page.locator('[data-testid="cad-viewport"][data-view-name="top"]').waitFor();
  await page.keyboard.press('3');
  await page.locator('[data-testid="cad-viewport"][data-view-name="left"]').waitFor();
  await page.keyboard.press('0');
  await page.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
  await page.keyboard.press('f');
  await page.locator('[data-testid="cad-viewport"][data-view-name="fit"]').waitFor();
  assert.equal((await cameraState()).revision, initial.revision, 'orientation shortcut triggered CAD recompute');

  const beforeZoom = await cameraState();
  await page.keyboard.press('Control+=');
  await page.locator('[data-testid="cad-viewport"][data-view-name="zoom-in"]').waitFor();
  const afterZoom = await cameraState();
  assert.ok(distance(vector(afterZoom.position), vector(beforeZoom.position)) > 0.1, 'Ctrl+= did not zoom camera');
  assert.equal(afterZoom.revision, beforeZoom.revision, 'zoom shortcut triggered CAD recompute');

  await page.keyboard.press('ArrowRight');
  await page.locator('[data-testid="cad-viewport"][data-view-name="pan-right"]').waitFor();
  const afterPan = await cameraState();
  assert.ok(distance(vector(afterPan.target), vector(afterZoom.target)) > 0.1, 'ArrowRight did not pan camera target');
  assert.equal(afterPan.revision, afterZoom.revision, 'pan shortcut triggered CAD recompute');

  // F5 must rebuild the CAD model, not reload the browser, and the user's camera
  // must survive the resulting render-model revision.
  const beforeRebuild = await cameraState();
  await page.keyboard.press('F5');
  await page.waitForFunction(
    (oldRevision) => document.querySelector('[data-testid="cad-viewport"]')?.getAttribute('data-runtime-revision') !== oldRevision,
    beforeRebuild.revision,
    { timeout: 60_000 },
  );
  await page.getByText('Перестроено', { exact: true }).waitFor();
  const afterRebuild = await cameraState();
  assert.match(afterRebuild.revision ?? '', /^occ-\d+$/);
  assert.notEqual(afterRebuild.revision, beforeRebuild.revision, 'F5 did not rebuild runtime revision');
  assert.ok(distance(vector(afterRebuild.position), vector(beforeRebuild.position)) < 0.05, 'camera position reset across F5 rebuild');
  assert.ok(distance(vector(afterRebuild.target), vector(beforeRebuild.target)) < 0.05, 'camera target reset across F5 rebuild');
  assert.equal(page.url(), url, 'F5 caused browser navigation/reload');

  // Undo/redo are dispatched through the same root shortcut layer.
  await page.locator('.cad-app').focus();
  await page.keyboard.press('Control+z');
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor({ state: 'detached', timeout: 60_000 });
  await page.locator('.cad-app').focus();
  await page.keyboard.press('Control+y');
  await page.getByText('Элемент выдавливания 1', { exact: true }).waitFor({ timeout: 120_000 });
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  console.log('ASA-CAD M2I browser shortcuts PASS');
  console.log('  ✓ Ctrl+Enter/Save/Esc dispatch through ASA command lifecycle');
  console.log('  ✓ numeric focus blocks navigation/undo leakage');
  console.log('  ✓ Fit/orientation/zoom/pan shortcuts stay camera-only');
  console.log('  ✓ F5 rebuild preserves camera and does not reload browser');
  console.log('  ✓ Ctrl+Z/Ctrl+Y drive ASA undo/redo');
} finally {
  await browser.close();
}
