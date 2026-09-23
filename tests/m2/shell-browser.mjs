import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

async function waitForShell(page) {
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
}


function near(actual, expected, tolerance = 4, label = 'value') {
  assert.ok(Number.isFinite(actual), `${label} is not finite: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}±${tolerance}, got ${actual}`);
}

async function assertDesktopGeometry(page) {
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      mainBar: rect('.main-menu-bar'),
      menu: rect('.main-menu-items'),
      tabs: rect('.document-tabs'),
      instrument: rect('.instrument-area'),
      search: rect('.command-search-wrap'),
      rail: rect('.management-rail'),
      panel: rect('.management-panel'),
      work: rect('.work-area'),
      quick: rect('.viewport-quick-access'),
    };
  });

  for (const [name, value] of Object.entries(metrics)) {
    assert.ok(value, `missing desktop geometry node: ${name}`);
  }

  near(metrics.mainBar.y, 0, 1, 'main top');
  near(metrics.mainBar.height, 28, 1, 'main height');
  near(metrics.tabs.y, 28, 1, 'document row y');
  near(metrics.tabs.height, 27, 1, 'document row height');
  near(metrics.instrument.y, 55, 1, 'instrument y');
  near(metrics.instrument.height, 93, 1, 'instrument height');
  near(metrics.menu.x, 29, 1, 'main menu x');
  near(metrics.menu.width, 835, 1, 'main menu width');
  near(metrics.search.x, 1651, 1, 'search x');
  near(metrics.search.y, 5, 1, 'search y');
  near(metrics.search.width, 166, 1, 'search width');
  near(metrics.search.height, 22, 1, 'search height');
  near(metrics.rail.x, 3, 1, 'rail x');
  near(metrics.rail.width, 26, 1, 'rail width');
  near(metrics.panel.x, 29, 1, 'panel x');
  near(metrics.panel.width, 310, 1, 'panel width');
  near(metrics.work.x, 340, 1, 'graphics x');
  near(metrics.work.y, 148, 1, 'graphics y');
  near(metrics.work.width, 1577, 1, 'graphics width');
  near(metrics.work.height, 929, 1, 'graphics height');
  near(metrics.quick.x, 356, 1, 'quick access x');
  near(metrics.quick.y, 148, 1, 'quick access y');
  near(metrics.quick.width, 591, 1, 'quick access width');
  near(metrics.quick.height, 25, 1, 'quick access height');
}

async function assertPartSourceComposition(page) {
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, text: node.textContent?.trim() ?? '' };
    };
    return {
      system: rect('.part-system-group'),
      systemLabel: rect('.part-system-group .command-group-label'),
      rebuild: rect('.part-system-group [data-command-id="system.rebuild"]'),
      sketch: rect('.part-sketch-group'),
      sketchLabel: rect('.part-sketch-group .command-group-label'),
      solid: rect('.part-solid-group'),
      order: [...document.querySelectorAll('.part-command-groups [data-command-id]')].map((node) => node.getAttribute('data-command-id')),
    };
  });

  assert.ok(metrics.system && metrics.systemLabel && metrics.rebuild && metrics.sketch && metrics.sketchLabel && metrics.solid);
  near(metrics.system.x, 124, 1, 'Part SYSTEM x');
  near(metrics.system.width, 78, 1, 'Part SYSTEM command span');
  near(metrics.systemLabel.x, 124, 1, 'Part SYSTEM label x');
  near(metrics.systemLabel.y, 130, 1, 'Part SYSTEM label y');
  near(metrics.systemLabel.width, 66, 1, 'Part SYSTEM label width');
  near(metrics.rebuild.x, 124, 1, 'Part system.rebuild x');
  near(metrics.rebuild.y, 55, 1, 'Part system.rebuild y');
  near(metrics.rebuild.width, 26, 1, 'Part system.rebuild width');
  near(metrics.rebuild.height, 25, 1, 'Part system.rebuild height');
  near(metrics.sketch.x, 203, 1, 'Part Sketch group x');
  near(metrics.sketchLabel.width, 108, 1, 'Part Sketch label width');
  near(metrics.solid.x, 324, 1, 'Part Solid_elements group x');
  assert.equal(metrics.systemLabel.text, 'Система');
  assert.equal(metrics.sketchLabel.text, 'Эскиз');
  assert.deepEqual(metrics.order.slice(0, 5), [
    'system.rebuild',
    'part.sketch.create',
    'part.extrude',
    'part.cutExtrude',
    'part.fillet',
  ]);
}

async function assertRibbonIntegrity(page, label) {
  const rects = await page.locator('.command-ribbon .ribbon-command').evaluateAll((nodes) => nodes
    .filter((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    })
    .map((node) => {
      const box = node.getBoundingClientRect();
      return {
        id: node.getAttribute('data-command-id') ?? node.textContent?.trim() ?? 'unknown',
        x: box.x, y: box.y, width: box.width, height: box.height,
        svg: Boolean(node.querySelector('.ribbon-command-icon svg.cad-icon')),
      };
    }));

  assert.ok(rects.length > 0, `${label}: no visible commands`);
  for (const rect of rects) {
    assert.equal(rect.svg, true, `${label}: ${rect.id} is missing ASA-owned SVG icon`);
  }

  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i], b = rects[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(
        overlapX <= 0.5 || overlapY <= 0.5,
        `${label}: ${a.id} overlaps ${b.id} by ${overlapX.toFixed(1)}×${overlapY.toFixed(1)}px`,
      );
    }
  }
}

async function runDesktop() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const pageErrors = [];
  const failedRuntimeRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (/\.wasm(?:\?|$)/i.test(request.url())) failedRuntimeRequests.push(request.url());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForShell(page);
  await page.getByText('Твердотельное моделирование', { exact: true }).waitFor();
  await page.locator('.management-panel .panel-title-row strong').filter({ hasText: 'Дерево' }).waitFor();
  await page.getByText('Новая деталь', { exact: true }).waitFor();

  await assertDesktopGeometry(page);
  await assertPartSourceComposition(page);
  await assertRibbonIntegrity(page, 'Part ribbon');
  await page.locator('.management-rail button[title^="Библиотеки"]').waitFor();

  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'CAD browser route is not cross-origin isolated');

  // Shell boot must remain cheap: no OCC WASM until a solid feature is rebuilt.
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  assert.equal(resources.some((name) => /\.wasm(?:\?|$)/i.test(name)), false, 'M2 shell eagerly loaded WASM');
  assert.equal(failedRuntimeRequests.length, 0);

  const stateBeforeCancel = await page.locator('.cad-app').evaluate((node) => ({
    sketches: node.getAttribute('data-sketch-count'),
    features: node.getAttribute('data-feature-count'),
    refs: node.getAttribute('data-stable-reference-count'),
    dirty: document.querySelectorAll('.dirty-dot').length,
  }));

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '0', 'opening Create Sketch mutated the document');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor({ state: 'detached' });

  const stateAfterCancel = await page.locator('.cad-app').evaluate((node) => ({
    sketches: node.getAttribute('data-sketch-count'),
    features: node.getAttribute('data-feature-count'),
    refs: node.getAttribute('data-stable-reference-count'),
    dirty: document.querySelectorAll('.dirty-dot').length,
  }));
  assert.deepEqual(stateAfterCancel, stateBeforeCancel, 'Cancel changed the new Part document');

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Плоскость построения', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();
  await assertRibbonIntegrity(page, 'Sketch ribbon');

  // New-document routing is ASA-owned for all six kinds.
  await page.locator('.new-tab-button').click();
  const dialog = page.getByRole('dialog', { name: 'Новый документ' });
  await dialog.waitFor();
  for (const label of ['Деталь', 'Сборка', 'Чертеж', 'Фрагмент', 'Спецификация', 'Текстовый документ']) {
    await dialog.getByRole('button', { name: new RegExp(label) }).waitFor();
  }
  await dialog.getByRole('button', { name: /Сборка/ }).click();
  await page.getByText('Сборка', { exact: true }).first().waitFor();

  assert.deepEqual(pageErrors, [], `desktop page errors: ${pageErrors.join('; ')}`);
  await page.close();
}

async function runPhone() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForShell(page);

  const layout = await page.evaluate(() => {
    const ribbon = document.querySelector('.command-ribbon');
    const bottom = document.querySelector('.mobile-bottom-bar');
    const work = document.querySelector('.work-area');
    return {
      ribbonDisplay: ribbon ? getComputedStyle(ribbon).display : 'missing',
      bottomDisplay: bottom ? getComputedStyle(bottom).display : 'missing',
      workWidth: work?.getBoundingClientRect().width ?? 0,
      workHeight: work?.getBoundingClientRect().height ?? 0,
      isolated: crossOriginIsolated,
    };
  });
  assert.equal(layout.ribbonDisplay, 'none', 'desktop ribbon must not be squeezed into phone layout');
  assert.notEqual(layout.bottomDisplay, 'none', 'phone bottom navigation must be visible');
  assert.ok(layout.workWidth >= 360, `phone work area unexpectedly narrow: ${layout.workWidth}`);
  assert.ok(layout.workHeight >= 300, `phone work area unexpectedly short: ${layout.workHeight}`);
  assert.equal(layout.isolated, true, 'phone CAD route is not cross-origin isolated');
  assert.deepEqual(pageErrors, [], `phone page errors: ${pageErrors.join('; ')}`);
  await page.close();
}

try {
  await runDesktop();
  await runPhone();
  console.log('ASA-CAD M2 shell real-browser smoke PASS');
  console.log('  ✓ captured 1920×1080 geometry within ±4 CSS px');
  console.log('  ✓ Part source groups start at SYSTEM x124, Sketch x203, Solid_elements x324');
  console.log('  ✓ Create Sketch opens plane parameters; Cancel leaves the Part unchanged');
  console.log('  ✓ Part/Sketch ribbon bounding boxes do not overlap and use ASA SVG icons');
} finally {
  await browser.close();
}
