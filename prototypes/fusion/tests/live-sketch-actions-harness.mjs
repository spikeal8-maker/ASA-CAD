import assert from 'node:assert/strict';

export const tool = (page, id) => page.locator('.live-tool[data-command-id="' + id + '"]');
export const quick = (page, id) => page.locator('.live-quickbar [data-command-id="' + id + '"]');
export const overlay = page => page.locator('[data-testid="cad-sketch-overlay"]');
export const entity = (page, id) => overlay(page).locator('[data-sketch-entity-id="' + id + '"]');
export const stage = page => page.locator('[data-testid="part-model-stage"]');
export const near = (actual, expected, label, tolerance = 1e-4) => assert.ok(
  Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' != ' + expected);
const labels = {
  'constraint.horizontal': 'Горизонтальность',
  'constraint.pointOnCurve': 'Точка на кривой',
  'dimension.linear': 'Линейный размер',
  'dimension.horizontal': 'Горизонтальный размер',
  'dimension.vertical': 'Вертикальный размер',
  'dimension.radius': 'Радиус',
  'dimension.angular': 'Угловой размер',
  'sketch.arc': 'Дуга из центра',
  'sketch.entity.delete': 'Удалить выбранное',
};

export async function searchAction(page, id) {
  assert.ok(labels[id], 'Known public search label required: ' + id);
  await page.getByRole('textbox', { name: 'Поиск команд', exact: true }).fill(labels[id]);
  const result = page.locator('.live-search-results [data-command-id="' + id + '"]');
  await result.waitFor();
  assert.equal(await result.count(), 1, 'Search must resolve one action: ' + id);
  return result;
}
export async function invoke(page, id) {
  const control = labels[id] ? await searchAction(page, id) : tool(page, id);
  assert.equal(await control.isEnabled(), true, id + ' must be enabled by the common CadUiAction');
  await control.click();
}
export async function idle(page) {
  await page.waitForFunction(() => document.querySelector('.live-workarea')?.getAttribute('data-active-command') === '');
}
export async function solved(page, count) {
  await page.waitForFunction(count => document.querySelector('[data-testid="cad-sketch-overlay"]')
    ?.getAttribute('data-entity-count') === String(count), count);
  if (count) {
    await page.waitForFunction(() => ['solved', 'error'].includes(
      document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status') || ''));
    assert.equal(await page.locator('[data-testid="sketch-solve-status"]').getAttribute('data-solve-status'), 'solved');
    assert.equal(await overlay(page).getAttribute('data-overlay-source'), 'solver-preview');
  }
}
export async function startSketch(browser, url) {
  const page = await browser.newPage({ viewport: { width: 2048, height: 1137 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(url);
  await tool(page, 'part.sketch.create').click();
  await page.getByLabel('Плоскость эскиза', { exact: true }).selectOption('XY');
  await page.locator('.live-commit').click();
  await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
  await solved(page, 0);
  await page.locator('[data-sketch-option="snap"]').uncheck();
  return { page, errors };
}
export async function clickPoint(page, point) {
  assert.equal(await page.evaluate(({ x, y }) =>
    !!document.elementFromPoint(x, y)?.closest('[data-testid="part-model-stage"]'), point), true,
  'The visible pointer target must be in the field, not behind another panel');
  await page.mouse.click(point.x, point.y);
}
export async function clickWorld(page, world) {
  const svg = page.locator('[data-testid="cad-sketch-interaction"],[data-testid="cad-sketch-selection-layer"]').first();
  const box = await svg.boundingBox(), frame = (await svg.getAttribute('viewBox')).split(/\s+/).map(Number);
  assert.ok(box && frame.length === 4);
  const scale = Math.min(box.width / frame[2], box.height / frame[3]);
  await clickPoint(page, { x: box.x + (box.width - frame[2] * scale) / 2 + (world[0] - frame[0]) * scale,
    y: box.y + (box.height - frame[3] * scale) / 2 + (-world[1] - frame[1]) * scale });
}
export async function screenPoint(locator, center = false) {
  await locator.waitFor({ state: 'attached' });
  return locator.evaluate((node, useCenter) => {
    if (!(node instanceof SVGGeometryElement)) throw new Error('Expected a rendered SVG target');
    const matrix = node.getScreenCTM();
    if (!matrix) throw new Error('Target has no screen transform');
    const local = useCenter && node instanceof SVGCircleElement
      ? new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy')))
      : node.getPointAtLength(node.getTotalLength() / 2);
    const p = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  }, center);
}
export async function pick(page, selector, center = false) {
  await clickPoint(page, await screenPoint(page.locator(selector), center));
}
export async function draw(page, kind, points) {
  const before = Number(await overlay(page).getAttribute('data-entity-count'));
  await invoke(page, 'sketch.' + kind);
  for (const point of points) await clickWorld(page, point);
  await solved(page, before + 1);
  await page.keyboard.press('Escape');
  await idle(page);
  const ids = await overlay(page).locator('[data-sketch-entity-id]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-sketch-entity-id')));
  assert.equal(ids.length, before + 1);
  return ids.at(-1);
}
export async function select(page, id) {
  await clickPoint(page, await screenPoint(entity(page, id)));
  await page.waitForFunction(id => document.querySelector('[data-testid="part-model-stage"]')
    ?.getAttribute('data-selected-sketch-entity-id') === id, id);
}
export async function geometry(page, ids) {
  return overlay(page).evaluate((root, selectedIds) => selectedIds.map(id => {
    const node = root.querySelector('[data-sketch-entity-id="' + id + '"]');
    if (node instanceof SVGLineElement) return ['x1', 'y1', 'x2', 'y2'].map(name => Number(node.getAttribute(name)));
    if (node instanceof SVGCircleElement) return ['cx', 'cy', 'r'].map(name => Number(node.getAttribute(name)));
    throw new Error('Expected solved line or circle: ' + id);
  }), ids);
}
export async function save(page) {
  const canonicalKey = 'asa-cad-m2-shell-document:state', mirrorKey = 'asa-cad-m2-shell-document';
  const before = await page.evaluate(key => localStorage.getItem(key), canonicalKey);
  await quick(page, 'system.save').click();
  await page.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before, { key: canonicalKey, before });
  await page.waitForFunction(() => document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
  const saved = await page.evaluate(({ canonicalKey, mirrorKey }) => ({
    canonical: localStorage.getItem(canonicalKey), mirror: localStorage.getItem(mirrorKey),
  }), { canonicalKey, mirrorKey });
  assert.ok(saved.canonical && saved.mirror, 'Public Save must write canonical and mirror document');
  const envelope = JSON.parse(saved.canonical);
  assert.ok(Number.isSafeInteger(envelope.revision) && envelope.revision > 0);
  assert.equal(envelope.serializedDocument, saved.mirror, 'Canonical and mirror bytes must agree');
  return JSON.parse(saved.mirror);
}
export async function reopen(page, count) {
  await save(page);
  await page.reload();
  await quick(page, 'system.open').click();
  await page.waitForFunction(() => document.querySelector('.live-status')?.textContent?.includes('Локальный документ открыт'));
  await page.locator('[data-timeline-sketch]').first().click();
  await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
  await solved(page, count);
}
export async function setDimension(page, id, value) {
  await invoke(page, id);
  await page.getByLabel('Размер', { exact: true }).fill(String(value));
  await page.locator('.live-parameters .live-commit').click();
  await idle(page);
}
export function constraintIntent(doc, type, ids) {
  const matches = doc.constraints.filter(c => c.type === type);
  assert.equal(matches.length, 1, 'Exactly one real ' + type + ' constraint');
  const constraint = matches[0];
  assert.deepEqual([...constraint.entityIds].sort(), [...ids].sort(), 'Stable entity references');
  return constraint;
}
export function dimensionIntent(doc, type, ids, value) {
  assert.equal(doc.dimensions.length, 1);
  const dimension = doc.dimensions[0];
  assert.equal(dimension.type, type);
  assert.deepEqual(dimension.entityIds, ids);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  return dimension;
}
export const vector = line => [line[2] - line[0], line[3] - line[1]];
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const pointLineDistance = (p, line) => {
  const v = vector(line);
  return Math.abs((p[0] - line[0]) * v[1] - (p[1] - line[1]) * v[0]) / Math.hypot(...v);
};
export function residual(kind, geoms) {
  const [a, b, axis] = geoms, av = vector(a), bv = vector(b);
  if (kind === 'coincident') return distance(a.slice(2), b.slice(0, 2));
  if (kind === 'equal') return Math.abs(Math.hypot(...av) - Math.hypot(...bv));
  if (kind === 'parallel') return Math.abs(av[0] * bv[1] - av[1] * bv[0]) / (Math.hypot(...av) * Math.hypot(...bv));
  if (kind === 'perpendicular') return Math.abs(av[0] * bv[0] + av[1] * bv[1]) / (Math.hypot(...av) * Math.hypot(...bv));
  if (kind === 'tangent') return Math.abs(pointLineDistance(b, a) - b[2]);
  if (kind === 'concentric') return distance(a, b);
  if (kind === 'pointOnCurve') return pointLineDistance(a.slice(0, 2), b);
  if (kind === 'symmetric') {
    const p = a.slice(2), q = b.slice(0, 2), v = vector(axis);
    return Math.max(pointLineDistance([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], axis),
      Math.abs((p[0] - q[0]) * v[0] + (p[1] - q[1]) * v[1]) / Math.hypot(...v));
  }
  throw new Error('Unknown residual: ' + kind);
}
