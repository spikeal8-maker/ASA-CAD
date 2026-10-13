import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const url = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ headless: true });

async function waitForShell(page) {
  await page.locator('.k-main-menu-bar, .brand-button').first().waitFor();
}


async function assertRibbonIntegrity(page, label) {
  const rects = await page.locator('.k-command-ribbon :is(.k-btn-t, .k-btn-i)').evaluateAll((nodes) => nodes
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
        svg: Boolean(node.querySelector('svg.k-ic')),
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
  await page.locator('.k-management-panel .k-panel-head').filter({ hasText: 'Дерево' }).waitFor();
  await page.locator('[data-scene-revision="reference"] canvas').waitFor();

  await assertRibbonIntegrity(page, 'Part ribbon');
  await page.getByRole('tab', { name: 'Библиотеки' }).waitFor();

  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'CAD browser route is not cross-origin isolated');

  // Shell boot must remain cheap: no OCC WASM until a solid feature is rebuilt.
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  assert.equal(resources.some((name) => /\.wasm(?:\?|$)/i.test(name)), false, 'M2 shell eagerly loaded WASM');
  assert.equal(failedRuntimeRequests.length, 0);

  const stateBeforeCancel = await page.locator('.cad-app').evaluate((node) => ({
    sketches: node.getAttribute('data-sketch-count'),
    features: node.getAttribute('data-feature-count'),
    refs: node.getAttribute('data-stable-reference-count'),
    dirty: document.querySelectorAll(':is(.dirty-dot, [data-document-dirty="true"])').length,
  }));

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Опорный объект', { exact: true }).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '0', 'opening Create Sketch mutated the document');
  await page.locator('.parameter-actions button:not(.primary), .k-pp-cancel').click();
  await page.getByText('Опорный объект', { exact: true }).waitFor({ state: 'detached' });

  const stateAfterCancel = await page.locator('.cad-app').evaluate((node) => ({
    sketches: node.getAttribute('data-sketch-count'),
    features: node.getAttribute('data-feature-count'),
    refs: node.getAttribute('data-stable-reference-count'),
    dirty: document.querySelectorAll(':is(.dirty-dot, [data-document-dirty="true"])').length,
  }));
  assert.deepEqual(stateAfterCancel, stateBeforeCancel, 'Cancel changed the new Part document');

  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Опорный объект', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.parameter-actions button.primary, .k-pp-ok').click();
  await page.getByText('Эскиз 1', { exact: true }).waitFor();
  await assertRibbonIntegrity(page, 'Sketch ribbon');

  await page.locator(':is(.new-tab-button, .k-command-ribbon [data-command-id="system.new"])').click();
  await page.getByRole('dialog',{name:'Есть несохранённые изменения'}).getByRole('button',{name:'Не сохранять'}).click();
  const dialog=page.getByRole('dialog',{name:'Новый документ'});
  for (const label of ['Деталь', 'Сборка', 'Чертеж', 'Фрагмент', 'Спецификация', 'Текстовый документ']) {
    await dialog.getByRole('button', { name: new RegExp(label) }).waitFor();
  }
  await dialog.getByRole('button', { name: /Сборка/ }).click();
  await page.getByText('Сборка', { exact: true }).first().waitFor();

  assert.deepEqual(pageErrors, [], `desktop page errors: ${pageErrors.join('; ')}`);
  await page.close();
}

async function runPartRibbonBoundaryMatrix() {
  for (const width of [768, 899, 900, 901]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await waitForShell(page);

      const snapshot = await page.evaluate(() => {
        const rect = (node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        };
        const kompas = document.querySelector('.k-command-ribbon');
        const ribbon = kompas ?? document.querySelector('.command-ribbon');
        const wrapper = kompas ?? document.querySelector('.part-command-groups');
        if (!(ribbon instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) return null;
        return {
          ribbon: { ...rect(ribbon), scrollWidth: ribbon.scrollWidth, clientWidth: ribbon.clientWidth },
          display: getComputedStyle(wrapper).display,
          groups: [...wrapper.querySelectorAll('.command-group, .k-cmd-panel')].map((node) => ({
            label: node.querySelector('.command-group-label, .k-cmd-panel-label')?.textContent?.trim() ?? '',
            ...rect(node),
          })),
        };
      });

      assert.ok(snapshot, `${width}x1024: Part ribbon snapshot missing`);
      assert.equal(snapshot.display, 'flex', `${width}x1024: Part wrapper must stay horizontal`);
      for (const group of snapshot.groups) {
        assert.ok(group.y >= snapshot.ribbon.y - 0.5, `${width}x1024: ${group.label} starts above ribbon`);
        assert.ok(group.bottom <= snapshot.ribbon.bottom + 0.5, `${width}x1024: ${group.label} falls below visible ribbon`);
      }
      for (let i = 0; i < snapshot.groups.length; i += 1) {
        for (let j = i + 1; j < snapshot.groups.length; j += 1) {
          const a = snapshot.groups[i], b = snapshot.groups[j];
          const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
          assert.ok(overlapX <= 0.5 || overlapY <= 0.5, `${width}x1024: ${a.label} overlaps ${b.label}`);
        }
      }
    } finally {
      await page.close();
    }
  }
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
  await runPartRibbonBoundaryMatrix();
  await runPhone();
  console.log('ASA-CAD M2 shell real-browser smoke PASS');
  console.log('  ✓ KOMPAS shell at 1920×1080: tree, rail and reference ribbon of #170');
  console.log('  ✓ Part command groups preserve order without overlap');
  console.log('  ✓ Create Sketch opens plane parameters; Cancel leaves the Part unchanged');
  console.log('  ✓ Part/Sketch ribbon bounding boxes do not overlap and use ASA SVG icons');
} finally {
  await browser.close();
}
