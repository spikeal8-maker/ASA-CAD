import assert from 'node:assert/strict';

function near(actual, expected, tolerance = 4, label = 'value') {
  assert.ok(Number.isFinite(actual), `${label} is not finite: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}±${tolerance}, got ${actual}`);
}

export async function assertDesktopGeometry(page) {
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error('missing shell region: ' + selector);
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    const menus = [...document.querySelectorAll('.main-menu-items .file-menu-trigger')].map((node) => {
      const b = node.getBoundingClientRect();
      return { label: node.textContent?.trim(), x: b.x, right: b.right, width: b.width };
    });
    const tools = [...document.querySelectorAll('.workspace-tabs button')].filter((node) => !node.disabled).map((node) => {
      const b = node.getBoundingClientRect();
      return { x: b.x, right: b.right, label: node.textContent?.trim() };
    });
    return {
      bar: box('.main-menu-bar'), menu: box('.main-menu-items'),
      tabs: box('.document-tabs'), document: box('.document-tab.active'),
      instrument: box('.instrument-area'), workspaces: box('.workspace-tabs'),
      ribbon: box('.command-ribbon'), search: box('.command-search-wrap'),
      globals: box('.global-actions'), rail: box('.management-rail'),
      panel: box('.management-panel'), work: box('.work-area'), menus, tools,
    };
  });
  near(metrics.bar.y, 0, 1, 'main top');
  near(metrics.bar.height, 28, 1, 'main height');
  near(metrics.tabs.y, 28, 1, 'document row y');
  near(metrics.tabs.height, 27, 1, 'document row height');
  near(metrics.instrument.y, 55, 1, 'instrument y');
  near(metrics.instrument.height, 93, 1, 'instrument height');
  near(metrics.rail.x, 3, 1, 'rail x');
  near(metrics.rail.width, 26, 1, 'rail width');
  near(metrics.panel.x, 29, 1, 'panel x');
  near(metrics.panel.width, 310, 1, 'panel width');
  near(metrics.work.x, 340, 1, 'graphics x');
  near(metrics.work.y, 148, 1, 'graphics y');
  near(metrics.work.width, 1577, 1, 'graphics width');
  near(metrics.work.height, 929, 1, 'graphics height');
  near(metrics.workspaces.y, metrics.instrument.y, 1, 'workspace strip top');
  near(metrics.ribbon.y, metrics.workspaces.bottom, 1, 'ribbon below workspaces');
  near(metrics.ribbon.bottom, metrics.instrument.bottom, 1, 'ribbon bottom');
  near(metrics.document.y + metrics.document.height, metrics.tabs.bottom, 2, 'document tab bottom');
  assert.deepEqual(metrics.menus.map((m) => m.label), ['Файл', 'Правка', 'Вид', 'Эскиз', 'Моделирование']);
  assert.ok(metrics.menu.right + 10 < metrics.search.x, 'U1A menus overlap search');
  assert.ok(metrics.search.right + 5 < metrics.globals.x, 'U1A search overlaps quick actions');
  assert.ok(metrics.globals.right <= metrics.bar.right - 1, 'global actions clipped');
  for (const m of metrics.menus) assert.ok(m.width >= 30, m.label + ' trigger too narrow');
  for (let i = 1; i < metrics.menus.length; i += 1)
    assert.ok(metrics.menus[i].x >= metrics.menus[i - 1].right - .5, 'overlapping menu triggers');
  for (let i = 1; i < metrics.tools.length; i += 1)
    assert.ok(metrics.tools[i].x >= metrics.tools[i - 1].right - .5, 'overlapping toolsets');
  assert.ok(metrics.tools.some((tool) => tool.label === 'Вид'), 'View workspace not exposed');
}

export async function assertPartSourceComposition(page) {
  const metrics = await page.evaluate(() => {
    const group = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error('missing ribbon group: ' + selector);
      const box = node.getBoundingClientRect();
      return { x: box.x, right: box.right, top: box.top, bottom: box.bottom, text: node.querySelector('.command-group-label')?.textContent?.trim() };
    };
    return {
      system: group('.part-system-group'),
      sketch: group('.part-sketch-group'),
      solid: group('.part-solid-group'),
      view: group('.part-view-group'),
      order: [...document.querySelectorAll('.part-command-groups [data-command-id]')].map((node) => node.getAttribute('data-command-id')),
      rebuild: document.querySelector('.part-system-command')?.getBoundingClientRect().width,
    };
  });
  assert.deepEqual([metrics.system.text, metrics.sketch.text, metrics.solid.text, metrics.view.text],
    ['Система', 'Эскиз', 'Элементы тела', 'Вид']);
  assert.ok(metrics.system.x < metrics.sketch.x && metrics.sketch.x < metrics.solid.x && metrics.solid.x < metrics.view.x);
  for (const [a, b] of [[metrics.system, metrics.sketch], [metrics.sketch, metrics.solid], [metrics.solid, metrics.view]])
    assert.ok(a.right <= b.x + .5, 'U1A Part command groups overlap');
  near(metrics.rebuild, 48, 2, 'compact system rebuild');
  assert.deepEqual(metrics.order.slice(0, 5), [
    'system.rebuild', 'part.sketch.create', 'part.extrude', 'part.cutExtrude', 'part.fillet',
  ]);
}
