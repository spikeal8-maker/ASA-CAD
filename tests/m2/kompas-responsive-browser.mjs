import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const root = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const sizes = [[360,640],[390,844],[599,820],[600,820],[768,1024],[844,390],[899,768],[900,768],[901,768],[1366,768]];
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      const response = await page.goto(root + '/cad/', { waitUntil: 'networkidle', timeout: 30000 });
      assert.ok(response?.ok(), width + ' product route missing');
      for (const klass of ['.k-main-menu-bar','.k-document-tabs','.k-instrument-area','.k-command-ribbon','.k-content','.k-work-area']) {
        await page.locator(klass).waitFor();
      }
      assert.equal(await page.locator('.main-menu-bar,.content-area,.mobile-bottom-bar,.brand-button').count(),0,
        width + ': retired ASA shell must never be mounted');
      const layout = await page.evaluate(() => {
        const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
        return { workWidth: box('.k-work-area')?.width, appWidth:box('.cad-app')?.width,
          navVisible: getComputedStyle(document.querySelector('.k-mobile-navigation')).display !== 'none',
          menuVisible: getComputedStyle(document.querySelector('.k-main-menu-bar')).display !== 'none',
          ribbonVisible: getComputedStyle(document.querySelector('.k-command-ribbon')).display !== 'none' };
      });
      assert.equal(layout.menuVisible,true,width + ': KOMPAS menu hidden');
      assert.equal(layout.ribbonVisible,true,width + ': canonical toolset ribbon hidden');
      assert.ok(layout.workWidth > width * (width<600 ? 0.93 : width<900 ? 0.65 : 0.60),
        width + ': work area too narrow, got '+layout.workWidth);
      assert.ok(layout.appWidth <= width+1,width + ': horizontal overflow');
      assert.equal(layout.navVisible,width<900,width+': compact navigation state');
      if (width < 900) {
        const nav=page.locator('.k-mobile-navigation');
        assert.equal(await nav.getByRole('button').count(),3,width+': compact panel navigation lost');
        await nav.getByRole('button',{name:'Инструменты'}).click();
        await page.locator('[data-mobile-tools="true"]').waitFor();
        await nav.getByRole('button',{name:'Параметры'}).click();
        await page.locator('.k-content[data-panel-tab="params"]').waitFor();
        await nav.getByRole('button',{name:'Дерево'}).click();
        await page.locator('.k-content[data-panel-tab="tree"]').waitFor();
      }
      assert.deepEqual(errors,[],width+' runtime errors');
    } finally { await page.close(); }
  }
  const page = await browser.newPage({ viewport: { width: 901, height: 768 } });
  try {
    await page.goto(root + '/cad/',{waitUntil:'networkidle'});
    await page.locator('[data-toolset="surfaces"]').click();
    assert.equal(await page.locator('[data-toolset="surfaces"]').getAttribute('aria-selected'),'true');
    await page.setViewportSize({width:899,height:768});
    await page.locator('.k-mobile-navigation').waitFor();
    assert.equal(await page.locator('[data-toolset="surfaces"]').getAttribute('aria-selected'),'true',
      'shared workspace must survive desktop->compact resize');
    assert.equal(await page.locator('.main-menu-bar').count(),0,'resize mounted retired UI');
    await page.setViewportSize({width:901,height:768});
    assert.equal(await page.locator('[data-toolset="surfaces"]').getAttribute('aria-selected'),'true');
  } finally { await page.close(); }
  // Compact chrome receives CSS zoom; its grid rows must grow with the same UI Scale.
  // This catches clipping/overlap for saved 125–150% preferences after a resize.
  for (const [width, height, uiScale] of [[390,844,125],[390,844,150],[768,1024,125],[899,768,150],[844,390,150]]) {
    const scaled = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    scaled.on('pageerror', error => errors.push(error.message));
    try {
      await scaled.goto(root + '/cad/?uiScale=' + uiScale, { waitUntil: 'networkidle', timeout: 30000 });
      await scaled.locator('.k-main-menu-bar').waitFor();
      await scaled.locator('html[data-ui-scale="' + uiScale + '"]').waitFor();
      const positions = await scaled.evaluate(() => {
        const rect = selector => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const box = node.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height };
        };
        return { menu: rect('.k-main-menu-bar'), tabs: rect('.k-document-tabs'),
          tools: rect('.k-instrument-area'), content: rect('.k-content') };
      });
      const { menu, tabs, tools, content } = positions;
      assert.ok(menu && tabs && tools && content, width + ': KOMPAS scaled chrome missing');
      assert.ok(menu.bottom <= tabs.top + 2, width + ' UI' + uiScale + ': menu overlaps document tabs');
      assert.ok(tabs.bottom <= tools.top + 2, width + ' UI' + uiScale + ': tabs overlap toolsets');
      assert.ok(tools.bottom <= content.top + 2, width + ' UI' + uiScale + ': ribbon overlaps the CAD work area');
      assert.deepEqual(errors, [], width + ' UI' + uiScale + ': browser errors');
    } finally { await scaled.close(); }
  }
  console.log('ASA-CAD canonical KOMPAS #170 across 360–1366px, 900px transition and 125–150% UI Scale PASS');
} finally { await browser.close(); }
