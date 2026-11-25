import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const root = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const evidence = process.env.ASA_CAD_EVIDENCE_DIR;
const browser = await chromium.launch({ headless: true });
async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(root + '/cad/?uiScale=100', { waitUntil: 'networkidle' });
  await page.locator('.k-tree-rows').waitFor({ state: 'attached' });
  return page;
}
try {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    for (const [width, height] of [[360,640], [768,1024], [844,390], [1600,900]]) {
      const page = await open(width, height);
      await page.screenshot({ path: join(evidence, `kompas-${width}x${height}.png`) });
      await page.close();
    }
  }
  for (const [width, height] of [[360,640], [390,844], [768,1024], [844,390], [899,768]]) {
    const page = await open(width, height);
    try {
      const layout = await page.evaluate(() => {
        const rows = document.querySelector('.k-tree-rows').getBoundingClientRect();
        const row = document.querySelector('.k-tree-row').getBoundingClientRect();
        const panel = document.querySelector('.k-management-panel').getBoundingClientRect();
        const launcher = document.querySelector('.mobile-ui-settings-launcher');
        const launcherBox = launcher.getBoundingClientRect();
        return {
          rowCount: rows.height / row.height,
          font: parseFloat(getComputedStyle(document.querySelector('.k-toolset')).fontSize),
          clippedMenus: [...document.querySelectorAll('.k-menu-item')].filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.textContent),
          clippedToolsets: [...document.querySelectorAll('.k-toolset')].filter(n => {
            const label = n.querySelector('span'), child = label.getBoundingClientRect(), parent = n.getBoundingClientRect();
            return child.right > parent.right + 1 || child.top < parent.top - 1 || child.bottom > parent.bottom + 1
              || label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1;
          }).map(n => n.textContent),
          overlappingCommands: [...document.querySelectorAll('.k-command-ribbon .k-btn-t > span:not(.k-var)')].filter(n => {
            const label = n.getBoundingClientRect(), button = n.parentElement.getBoundingClientRect();
            return label.top < button.top - 1 || label.bottom > button.bottom + 1;
          }).map(n => n.textContent),
          blockedQuickActions: ['sketch','fit','normal','iso','orient'].filter(key => {
            const node = document.querySelector(`[data-qa="${key}"]`);
            const r = node.getBoundingClientRect();
            return !node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
          settingsOverlapsPanel: getComputedStyle(launcher).display !== 'none'
            && launcherBox.left < panel.right && launcherBox.right > panel.left
            && launcherBox.top < panel.bottom && launcherBox.bottom > panel.top,
        };
      });
      assert.ok(layout.font >= 12, `${width}: toolset readability ${layout.font}px`);
      assert.ok(layout.rowCount >= 3, `${width}: fewer than 3 tree rows visible (${layout.rowCount})`);
      assert.deepEqual(layout.clippedMenus, [], `${width}: menu labels overlap`);
      assert.deepEqual(layout.clippedToolsets, [], `${width}: toolset labels clipped`);
      assert.deepEqual(layout.overlappingCommands, [], `${width}: ribbon command rows overlap`);
      assert.deepEqual(layout.blockedQuickActions, [], `${width}: quick actions covered`);
      assert.equal(layout.settingsOverlapsPanel, false, `${width}: settings covers tree`);
      await page.locator('.k-tree-row[data-plane-id="XY"]').click();
      assert.equal(await page.locator('.k-tree-row[data-plane-id="XY"]').getAttribute('aria-selected'), 'true');
      await page.locator('[data-qa="iso"]').click();
      await page.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
    } finally { await page.close(); }
  }
  for (const [width, height] of [[360,640], [768,1024], [844,390]]) {
    const scaled = await open(width, height);
    try {
      await scaled.goto(root + '/cad/?uiScale=150', { waitUntil: 'networkidle' });
      const visibleRows = await scaled.locator('.k-tree-rows').evaluate(n => {
        const row = n.querySelector('.k-tree-row');
        return n.getBoundingClientRect().height / row.getBoundingClientRect().height;
      });
      assert.ok(visibleRows >= 1, `${width} UI150: tree has no complete visible row (${visibleRows})`);
      await scaled.locator('.k-tree-row[data-plane-id="XY"]').click();
      await scaled.locator('[data-qa="iso"]').click();
      await scaled.locator('[data-testid="cad-viewport"][data-view-name="isometric"]').waitFor();
    } finally { await scaled.close(); }
  }
  const page = await open(1600, 900);
  try {
    // Browsing toolsets cannot start a command or leave the active sketch.
    await page.locator('[data-toolset="sketch"]').click();
    assert.equal(await page.locator('.k-content[data-panel-tab="params"]').count(), 0);
    assert.equal(await page.locator('.k-qa-cancel').count(), 0, 'toolset browsing started Create Sketch');
    await page.locator('[data-toolset="surfaces"]').click();
    await page.locator('[data-qa="sketch"]').click();
    assert.equal(await page.locator('[data-toolset="surfaces"]').getAttribute('aria-selected'), 'true', 'plane selection changed toolset');
    await page.locator('.k-pp [aria-label="Создать объект"]').click();
    await page.locator('.k-sketch-exit').waitFor();
    await page.locator('[data-toolset="solid"]').click();
    assert.equal(await page.locator('[data-toolset="solid"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.k-sketch-exit').count(), 1, 'browsing exited sketch');
    await page.locator('[data-toolset="sketch"]').click();
    await page.locator('.k-command-ribbon [data-command-id="sketch.rectangle"]').click();
    await page.locator('.k-content[data-panel-tab="params"] .k-pp[data-command-title="Прямоугольник"]').waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Ширина, мм', exact: true }).isVisible(), true);
    await page.locator('.k-command-ribbon [data-command-id="sketch.rectangle"]').click();
    await page.getByRole('textbox', { name: 'Ширина, мм', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Параметры', exact: true }).click();
    await page.locator('.k-content.k-collapsed').waitFor();
    await page.getByRole('tab', { name: 'Параметры', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ширина, мм', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.k-content.k-collapsed').waitFor();
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator('.k-content[data-panel-tab="params"]').waitFor();
  } finally { await page.close(); }
  const resized = await open(390, 844);
  try {
    await resized.locator('.k-mobile-navigation').getByRole('button', { name: 'Инструменты', exact: true }).click();
    await resized.setViewportSize({ width: 1600, height: 900 });
    await resized.locator('.k-content[data-panel-tab="tree"]').waitFor();
    assert.equal(await resized.getByRole('tab', { name: 'Дерево', exact: true }).getAttribute('aria-selected'), 'true');
  } finally { await resized.close(); }
  console.log('ASA-CAD KOMPAS usability PASS (readable menu/tree, reachable quick actions, desktop parameters, toolset browsing, resize)');
} finally { await browser.close(); }
