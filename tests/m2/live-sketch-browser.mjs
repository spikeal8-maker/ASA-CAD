import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function createNewPart() {
  await page.locator('.new-tab-button').click();
  const dialog = page.getByRole('dialog', { name: 'Новый документ' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: /Деталь/ }).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"]').waitFor();
}

async function createSketch(support = 'XY') {
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: new RegExp(support) }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  const app = page.locator('.cad-app');
  await app.locator('xpath=..').waitFor();
  const id = await app.getAttribute('data-active-sketch-id');
  assert.ok(id, `${support}: active Sketch id missing after create`);
  return id;
}

async function createRectangle() {
  await page.getByRole('button', { name: /Прямоугольник/i }).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const panel = page.locator('.parameter-panel');
  await panel.waitFor();
  const width = panel.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');
  const height = panel.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input');
  assert.equal(await width.inputValue(), '60');
  assert.equal(await height.inputValue(), '40');
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан', { exact: true }).waitFor();
}

async function finishSketch() {
  await page.getByRole('button', { name: /Завершить эскиз/i }).click();
  await page.getByText('Эскиз завершен', { exact: true }).waitFor();
  await page.locator('.cad-app[data-active-sketch-id=""]').waitFor();
  await page.getByRole('tab', { name: 'Твердотельное моделирование' }).waitFor();
  assert.equal(
    await page.getByRole('tab', { name: 'Твердотельное моделирование' }).getAttribute('aria-selected'),
    'true',
  );
}

async function waitReadOnly(id) {
  const stage = page.locator(`[data-testid="part-model-stage"][data-sketch-context="read-only"][data-sketch-id="${id}"]`);
  await stage.waitFor();
  const overlay = stage.locator(`[data-testid="cad-sketch-overlay"][data-sketch-id="${id}"]`);
  await overlay.waitFor();
  assert.equal(await page.getByText('1 эскиз(а)', { exact: true }).count(), 0);
  return { stage, overlay };
}

async function saveAndRead() {
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально', { exact: true }).waitFor();
  const raw = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw, 'saved Part document missing');
  return { raw, document: JSON.parse(raw) };
}

function sketchIdentity(document, sketchId) {
  const sketch = document.sketches.find((item) => item.id === sketchId);
  assert.ok(sketch, `saved Sketch missing: ${sketchId}`);
  return {
    id: sketch.id,
    support: sketch.support,
    entityIds: sketch.entities.map((item) => item.id),
    dimensionIds: [...sketch.dimensionIds],
  };
}

async function assertRectangleOverlay(overlay, width, height, label) {
  const lines = await overlay.locator('line[data-sketch-entity-id]').evaluateAll((nodes) => nodes.map((line) => ({
    x1: Number(line.getAttribute('x1')), y1: Number(line.getAttribute('y1')),
    x2: Number(line.getAttribute('x2')), y2: Number(line.getAttribute('y2')),
  })));
  assert.equal(lines.length, 4, `${label}: expected four rectangle edges`);
  const horizontal = lines.filter((line) => Math.abs(line.y1 - line.y2) < 0.2);
  const vertical = lines.filter((line) => Math.abs(line.x1 - line.x2) < 0.2);
  assert.equal(horizontal.length, 2, `${label}: expected two horizontal edges`);
  assert.equal(vertical.length, 2, `${label}: expected two vertical edges`);
  for (const line of horizontal) {
    assert.ok(Math.abs(Math.abs(line.x2 - line.x1) - width) < 0.2, `${label}: horizontal edge is not ${width} mm`);
  }
  for (const line of vertical) {
    assert.ok(Math.abs(Math.abs(line.y2 - line.y1) - height) < 0.2, `${label}: vertical edge is not ${height} mm`);
  }
  const xs = lines.flatMap((line) => [line.x1, line.x2]);
  const ys = lines.flatMap((line) => [line.y1, line.y2]);
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) - width) < 0.2, `${label}: width span mismatch`);
  assert.ok(Math.abs((Math.max(...ys) - Math.min(...ys)) - height) < 0.2, `${label}: height span mismatch`);
}

async function selectSketch(id) {
  const tree = page.locator('.tree-panel');
  await tree.locator(`[data-sketch-id="${id}"]`).click();
  await page.locator(`.tree-panel[data-selected-sketch-id="${id}"]`).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), '');
}

async function editSelectedSketch(id) {
  await page.locator(`[data-sketch-edit-id="${id}"]`).click();
  await page.locator(`.cad-app[data-active-sketch-id="${id}"]`).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Эскиз' }).getAttribute('aria-selected'), 'true');
  await page.locator('[data-testid="part-model-stage"][data-sketch-context="isolated-2d"]').waitFor();
}

async function setWidth80() {
  await page.getByRole('button', { name: /Ширина: 60 мм/ }).click();
  const value = page.locator('.numeric-field').filter({ hasText: 'Размер' }).locator('input');
  await value.waitFor();
  assert.equal(await value.inputValue(), '60');
  await value.fill('80');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByText('Ширина изменен на 80 мм; модель перестроена', { exact: true }).waitFor({ timeout: 60_000 });
}

async function supportRegression(support) {
  await createNewPart();
  const id = await createSketch(support);
  await finishSketch();
  const { stage } = await waitReadOnly(id);
  assert.equal(await stage.getAttribute('data-sketch-support'), support);
  await selectSketch(id);
  await editSelectedSketch(id);
  assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), id);
}

try {
  await page.goto(`${base}/cad/?uiScale=100`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await createNewPart();

  const sketchId = await createSketch('XY');
  await createRectangle();
  const initialSaved = await saveAndRead();
  const initialIdentity = sketchIdentity(initialSaved.document, sketchId);
  assert.equal(initialIdentity.support, 'XY');
  assert.equal(initialIdentity.entityIds.length, 4);
  assert.equal(initialIdentity.dimensionIds.length, 2);

  await finishSketch();
  const firstFinished = await waitReadOnly(sketchId);
  assert.equal(await firstFinished.stage.getAttribute('data-sketch-support'), 'XY');
  assert.equal(await firstFinished.overlay.getAttribute('data-entity-count'), '4');
  await firstFinished.stage.getByText('Ширина: 60 мм', { exact: true }).waitFor();
  await firstFinished.stage.getByText('Высота: 40 мм', { exact: true }).waitFor();
  await assertRectangleOverlay(firstFinished.overlay, 60, 40, 'finished 60×40');

  await selectSketch(sketchId);
  const afterSelect = await saveAndRead();
  assert.equal(afterSelect.raw, initialSaved.raw, 'Sketch selection mutated serialized CadDocument');

  await editSelectedSketch(sketchId);
  assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '1');
  const reeditIds = await page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').evaluateAll(
    (nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-sketch-entity-id')).filter(Boolean))].sort(),
  );
  assert.deepEqual(reeditIds, [...initialIdentity.entityIds].sort(), 're-edit changed entity ids');

  await setWidth80();
  assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), sketchId);
  assert.equal(await page.getByRole('tab', { name: 'Эскиз' }).getAttribute('aria-selected'), 'true');
  await finishSketch();

  const secondFinished = await waitReadOnly(sketchId);
  await secondFinished.stage.getByText('Ширина: 80 мм', { exact: true }).waitFor();
  await secondFinished.overlay.locator('line').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-overlay-source') === 'solver-preview'
  ));
  await assertRectangleOverlay(secondFinished.overlay, 80, 40, 'finished 80×40');

  const finalSaved = await saveAndRead();
  const finalIdentity = sketchIdentity(finalSaved.document, sketchId);
  assert.deepEqual(finalIdentity, initialIdentity, 'same Sketch/support/entity/dimension ids were not preserved');
  assert.equal(finalSaved.document.sketches.length, 1, 'duplicate Sketch created');
  assert.equal(finalSaved.document.dimensions.find((item) => item.name === 'width')?.value, 80);
  assert.equal(finalSaved.document.dimensions.find((item) => item.name === 'height')?.value, 40);

  await page.getByTitle('Открыть').click();
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor({ timeout: 60_000 });
  await page.locator('.cad-app[data-active-sketch-id=""][data-sketch-count="1"]').waitFor();
  const reopened = await waitReadOnly(sketchId);
  assert.equal(await reopened.stage.getAttribute('data-sketch-support'), 'XY');
  await reopened.stage.getByText('Ширина: 80 мм', { exact: true }).waitFor();
  await assertRectangleOverlay(reopened.overlay, 80, 40, 'reopened 80×40');
  const reopenedSaved = await saveAndRead();
  assert.deepEqual(sketchIdentity(reopenedSaved.document, sketchId), initialIdentity);

  await selectSketch(sketchId);
  await editSelectedSketch(sketchId);
  assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '1');

  await supportRegression('XZ');
  await supportRegression('YZ');

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('CAD-VIS-002 live Sketch browser PASS');
  console.log(`  ✓ same Sketch id: ${sketchId}`);
  console.log('  ✓ Finish clears edit; read-only geometry stays visible');
  console.log('  ✓ select does not mutate serialized document; explicit re-edit uses same id');
  console.log('  ✓ width 60 -> 80; Save/Open preserves ids/support; XZ/YZ support identity PASS');
} finally {
  await browser.close();
}
