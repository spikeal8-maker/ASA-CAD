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
  const rectangle = tools.locator('[data-command-id="sketch.rectangle"]');
  const circle = tools.locator('[data-command-id="sketch.circle"]');
  const finish = tools.locator('[data-command-id="sketch.finish"]');
  assert.equal(await rectangle.isEnabled(), true, 'Sketch Rectangle must be enabled in mobile Sketch tools');
  assert.equal(await circle.isEnabled(), true, 'Sketch Circle must be enabled in mobile Sketch tools');
  assert.equal(await finish.isEnabled(), true, 'Finish Sketch must be enabled in mobile Sketch tools');

  await rectangle.click();
  await page.locator('.parameter-panel h3').filter({ hasText: /^Размеры$/ }).waitFor();
  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');
  const height = page.locator('.numeric-field').filter({ hasText: 'Высота' }).locator('input');
  assert.equal(await width.inputValue(), '60');
  assert.equal(await height.inputValue(), '40');
  assert.deepEqual(await wasmResources(), [], 'mobile 2D command path eagerly loaded OpenCascade');

  assert.deepEqual(errors, [], `mobile tools page errors: ${errors.join(' | ')}`);
  console.log('ASA-CAD mobile shared actions PASS (Tools -> Create Sketch -> Sketch tools, no desktop DOM delegation)');
} finally {
  await browser.close();
}
