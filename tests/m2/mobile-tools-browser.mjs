import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function wasmResources() {
  return page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\.wasm(?:\?|$)/i.test(name)));
}

function nonPlaneGcsWasm(names) {
  return names.filter((name) => !/planegcs/i.test(name));
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  assert.deepEqual(await wasmResources(), [], 'mobile empty shell eagerly loaded OpenCascade');

  const toolsTab = page.getByRole('button', { name: /Инструменты/ });
  const tabBox = await toolsTab.boundingBox();
  assert.ok(tabBox && tabBox.width >= 44 && tabBox.height >= 44, 'mobile Tools tab must remain touch-sized');
  await toolsTab.click();

  const tools = page.locator('[data-mobile-tools="true"]');
  await tools.waitFor();
  await tools.getByText('Инструменты', { exact: true }).waitFor();

  const createSketch = tools.locator('[data-command-id="part.sketch.create"]');
  assert.equal(await createSketch.isEnabled(), true, 'Create Sketch must be enabled through the mobile shared action');
  assert.equal(await tools.locator('[data-command-id="system.save"]').count(), 1, 'mobile tools must expose shared Save action');
  assert.equal(await tools.locator('[data-command-id="system.open"]').count(), 1, 'mobile tools must expose shared Open action');

  await createSketch.click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  const parametersTab = page.getByRole('button', { name: /Параметры/ });
  assert.equal(await parametersTab.getAttribute('aria-pressed'), 'true', 'command action must switch mobile panel to Parameters');
  assert.deepEqual(await wasmResources(), [], 'starting Create Sketch from mobile tools eagerly loaded OpenCascade');

  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();

  await toolsTab.click();
  await tools.waitFor();
  const line = tools.locator('[data-command-id="sketch.line"]');
  const rectangle = tools.locator('[data-command-id="sketch.rectangle"]');
  const circle = tools.locator('[data-command-id="sketch.circle"]');
  const finish = tools.locator('[data-command-id="sketch.finish"]');
  assert.equal(await line.isEnabled(), true, 'Sketch Line must be enabled through the shared mobile action');
  assert.equal(await rectangle.isEnabled(), true, 'Sketch Rectangle must be enabled in mobile Sketch tools');
  assert.equal(await circle.isEnabled(), true, 'Sketch Circle must be enabled in mobile Sketch tools');
  assert.equal(await finish.isEnabled(), true, 'Finish Sketch must be enabled in mobile Sketch tools');

  await line.tap();
  const lineLayer = page.locator('[data-testid="sketch-line-interaction-layer"]');
  await lineLayer.waitFor();
  const lineBox = await lineLayer.boundingBox();
  assert.ok(lineBox && lineBox.width > 200 && lineBox.height > 250, 'mobile Line workplane is not usable');
  await lineLayer.tap({ position: { x: lineBox.width * 0.35, y: lineBox.height * 0.55 } });
  await page.locator('[data-testid="sketch-line-ghost"]').waitFor();
  await lineLayer.tap({ position: { x: lineBox.width * 0.65, y: lineBox.height * 0.42 } });
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor({ timeout: 30_000 });
  assert.deepEqual(nonPlaneGcsWasm(await wasmResources()), [], 'touch Line path loaded OpenCascade');

  await toolsTab.tap();
  await tools.waitFor();
  await tools.locator('[data-command-id="system.undo"]').tap();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.keyboard.press('Escape');
  console.log('  ✓ shared mobile Line action commits by two taps and undoes in one step');

  await toolsTab.tap();
  await tools.waitFor();
  await rectangle.tap();
  await page.locator('.parameter-panel h3').filter({ hasText: /^Размеры$/ }).waitFor();
  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');
  const height = page.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input');
  assert.equal(await width.inputValue(), '60');
  assert.equal(await height.inputValue(), '40');
  assert.deepEqual(nonPlaneGcsWasm(await wasmResources()), [], 'mobile 2D command path eagerly loaded OpenCascade');

  assert.deepEqual(errors, [], `mobile tools page errors: ${errors.join(' | ')}`);
  console.log('ASA-CAD mobile shared actions PASS (Tools -> Create Sketch -> Sketch tools, no desktop DOM delegation)');
} finally {
  await browser.close();
}
