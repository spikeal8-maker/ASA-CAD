import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = process.env.ASA_CAD_CAPTURE_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { createXYSketch, interactionBox, launchM3Browser, sketchViewState, squarePoint } =
  await import(pathToFileURL(join(repo, 'tests/m3/M3BrowserHarness.mjs')).href);
const output = process.env.ASA_CAD_ARC_EVIDENCE_ROOT ?? 'ui-core-u1-evidence/u2-arc-numeric';
const mode = process.env.ASA_CAD_ARC_CAPTURE_MODE ?? 'both';
assert.ok(['before-only', 'after-only', 'both'].includes(mode));
const viewport = { width: 1600, height: 900 };
const center = [-10, 5], start = [10, 5], end = [-10, 25], radius = 20, toleranceMm = 0.15;
const panel = '[data-testid="sketch-arc-numeric"]';
const interaction = '[data-testid="cad-sketch-interaction"][data-tool="arc"]';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = (mode === 'both' ? ['BEFORE', 'AFTER'] : [mode === 'before-only' ? 'BEFORE' : 'AFTER'])
  .map((side) => {
    const url = process.env['ASA_CAD_' + side + '_URL'];
    const checkoutSha = process.env['ASA_CAD_' + side + '_SHA'];
    const sourceState = process.env['ASA_CAD_' + side + '_SOURCE_STATE'] ?? 'committed';
    assert.ok(url, side + ' URL required');
    assert.match(checkoutSha ?? '', /^[a-f0-9]{40}$/);
    assert.ok(['committed', 'working-tree'].includes(sourceState));
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
    assert.ok(![8094, 8098, 8099].includes(Number(new URL(url).port)));
    return { side: side.toLowerCase(), url: url.replace(/\/$/, ''), checkoutSha, sourceState };
  });
function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' != ' + expected);
}
function compareGeometry(a, b, tolerance) {
  for (const key of ['center', 'start', 'end']) {
    if (a[key] === null || b[key] === null) assert.equal(a[key], b[key]);
    else for (let i = 0; i < 2; i++) near(a[key][i], b[key][i], tolerance, key + '[' + i + ']');
  }
  near(a.radius, b.radius, tolerance, 'radius');
}
function assertQuarterPath(observed) {
  if (observed.path === null) return;
  const n = observed.path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
  assert.equal(n.length, 9);
  near(n[2], radius, toleranceMm, 'SVG rx'); near(n[3], radius, toleranceMm, 'SVG ry');
  near(n[2], n[3], 1e-10, 'circular SVG radii');
  assert.deepEqual(n.slice(4, 7), [0, 0, 0], 'Expected circular CAD CCW quarter arc');
}
async function point(page, box, world, action) {
  const screen = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await page.mouse[action](screen.x, screen.y);
}
async function state(page) {
  return page.locator(interaction).evaluate((layer) => {
    const anchor = layer.querySelector('[data-testid="sketch-arc-center"]');
    const line = layer.querySelector('[data-testid="sketch-arc-radius-ghost"]');
    const arc = layer.querySelector('[data-testid="sketch-arc-ghost"]');
    if (!anchor || (!line && !arc)) throw new Error('Arc preview missing');
    const c = [Number(anchor.getAttribute('cx')), -Number(anchor.getAttribute('cy'))];
    const numbers = arc?.getAttribute('d')?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number);
    if (arc && numbers?.length !== 9) throw new Error('Unexpected canonical SVG arc path');
    const s = line ? [Number(line.getAttribute('x2')), -Number(line.getAttribute('y2'))]
      : [numbers[0], -numbers[1]];
    const numeric = document.querySelector('[data-testid="sketch-arc-numeric"]');
    const style = getComputedStyle(arc ?? line), bounds = layer.getBoundingClientRect();
    return {
      phase: layer.getAttribute('data-arc-phase'),
      persistedEntities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')
        ?.getAttribute('data-entity-count')),
      geometry: { center: c, start: s, end: arc ? [numbers[7], -numbers[8]] : null,
        radius: arc ? numbers[2] : Math.hypot(s[0] - c[0], s[1] - c[1]) },
      path: arc?.getAttribute('d') ?? null,
      paint: { parentWidth: bounds.width, parentHeight: bounds.height, stroke: style.stroke,
        strokeWidth: Number.parseFloat(style.strokeWidth), opacity: Number(style.opacity),
        display: style.display, visibility: style.visibility },
      numericControlsPresent: !!numeric,
      fields: numeric ? Object.fromEntries([...numeric.querySelectorAll('input[data-arc-field]')]
        .map((e) => [e.getAttribute('data-arc-field'), e.value])) : null,
      radiusLocked: numeric ? numeric.getAttribute('data-radius-locked') === 'true' : null,
    };
  });
}
async function capture(page, source, name, phase) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const observed = await state(page);
  assert.equal(observed.phase, phase);
  assert.equal(observed.persistedEntities, 0, 'Preview must not commit');
  assert.ok(observed.paint.parentWidth > 120 && observed.paint.parentHeight > 120);
  assert.ok(observed.paint.stroke !== 'none' && observed.paint.strokeWidth > 0 && observed.paint.opacity > 0);
  assert.notEqual(observed.paint.display, 'none'); assert.equal(observed.paint.visibility, 'visible');
  compareGeometry(observed.geometry, { center, start, end: phase === 'awaiting-end' ? end : null, radius }, toleranceMm);
  assertQuarterPath(observed);
  const camera = await sketchViewState(page);
  assert.deepEqual(camera, { span: 100, center: [0, 0] });
  const bounds = { stage: await page.locator(interaction).boundingBox(),
    parameters: await page.locator('.k-management-panel').boundingBox() };
  const file = source.side + '/' + name + '.png';
  const png = await page.screenshot({ path: join(output, file), fullPage: false });
  assert.equal(png.readUInt32BE(16), viewport.width);
  assert.equal(png.readUInt32BE(20), viewport.height);
  return { ...source, name, file, bytes: png.length, sha256: hash(png), viewport, camera, bounds, observed };
}

await mkdir(output, { recursive: true });
const manifest = { schemaVersion: 1, mode, status: 'RUNNING',
  purpose: 'Ordinary product Arc preview before/after numeric-entry slice', sources,
  setup: 'New Part -> Create Sketch -> XY -> Apply -> Arc; no fixture or hidden mutation',
  expected: { center, radius, start, end, sweepDegrees: 90, toleranceMm },
  states: ['radius-locked-preview', 'sweep-preview'], images: [],
  baselinePolicy: 'Equivalent pointer geometry when numeric fields are absent; absence is recorded.',
  automatedParityClaim: 'NONE', visualAcceptance: 'OWNER_REQUIRED', browserClosed: false };
let browser;
try {
  if (mode === 'after-only') {
    const file = process.env.ASA_CAD_ARC_BASELINE_MANIFEST;
    assert.ok(file, 'Saved baseline manifest required');
    const bytes = await readFile(file), before = JSON.parse(bytes);
    assert.equal(before.status, 'PASS');
    assert.equal(before.mode, 'before-only');
    assert.deepEqual(before.expected, manifest.expected);
    assert.deepEqual(before.states, manifest.states);
    manifest.baselineManifest = { sha256: hash(bytes), bytes: bytes.length };
    manifest.baselineEnvironment = before.environment;
    for (const item of before.images) {
      assert.equal(item.side, 'before');
      const png = await readFile(join(dirname(file), item.file));
      assert.equal(hash(png), item.sha256); assert.equal(png.length, item.bytes);
      await mkdir(join(output, 'before'), { recursive: true });
      await writeFile(join(output, item.file), png, { flag: 'wx' });
      manifest.images.push(item);
    }
    assert.equal(manifest.images.length, 2);
  }
  browser = await launchM3Browser();
  manifest.environment = { browser: browser.version(), node: process.version,
    os: process.platform + ' ' + process.arch, viewport, deviceScaleFactor: 1, uiScale: 100, colorScheme: 'light' };
  if (mode === 'after-only') assert.deepEqual(manifest.environment, manifest.baselineEnvironment,
    'Matched capture must preserve browser, Node, OS, viewport, scale and theme');
  for (const source of sources) {
    await mkdir(join(output, source.side), { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const response = await page.goto(source.url + '/cad/?uiScale=100', { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200);
      await page.locator('.cad-app[data-document-kind="part"]').waitFor();
      await page.locator('[data-testid="cad-viewport"][data-scene-revision="reference"] canvas').waitFor();
      await createXYSketch(page);
      await page.locator('.k-command-ribbon [data-command-id="sketch.arc"]').click();
      await page.locator('.k-content[data-panel-tab="params"]').waitFor();
      assert.equal(await page.locator('.k-management-panel').isVisible(), true);
      assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
      const { box } = await interactionBox(page, 'arc');
      await point(page, box, center, 'click');
      await page.locator(interaction + '[data-arc-phase="awaiting-start"]').waitFor();
      await point(page, box, start, 'move');
      await page.locator('[data-testid="sketch-arc-radius-ghost"]').waitFor({ state: 'attached' });
      const numeric = await page.locator(panel).count() === 1;
      if (source.side === 'after') assert.equal(numeric, true, 'Candidate numeric panel missing');
      if (numeric) {
        await page.keyboard.type(String(radius));
        await page.locator(panel + '[data-radius-locked="true"]').waitFor();
      }
      const first = await capture(page, source, 'radius-locked-preview', 'awaiting-start');
      if (numeric) {
        assert.equal(first.observed.fields.radius, String(radius));
        near(first.observed.geometry.radius, radius, 1e-8, 'locked radius');
      }
      manifest.images.push(first);
      await point(page, box, start, 'click');
      await page.locator(interaction + '[data-arc-phase="awaiting-end"]').waitFor();
      await point(page, box, end, 'move');
      await page.locator('[data-testid="sketch-arc-ghost"]').waitFor();
      const second = await capture(page, source, 'sweep-preview', 'awaiting-end');
      if (numeric) {
        const sweep = page.locator(panel + ' [data-arc-field="sweep"]');
        assert.equal(await sweep.evaluate((e) => e.readOnly && e.tabIndex === -1), true);
        near(Number(second.observed.fields.sweep.replace(',', '.')), 90, 0.6, 'displayed CCW sweep');
        near(second.observed.geometry.radius, radius, 1e-8, 'end preview radius');
      }
      manifest.images.push(second);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  if (mode !== 'before-only') manifest.matches = manifest.states.map((name) => {
    const before = manifest.images.find((x) => x.side === 'before' && x.name === name);
    const after = manifest.images.find((x) => x.side === 'after' && x.name === name);
    assert.deepEqual(before.viewport, after.viewport); assert.deepEqual(before.camera, after.camera);
    assert.deepEqual(before.bounds, after.bounds);
    assertQuarterPath(before.observed); assertQuarterPath(after.observed);
    compareGeometry(before.observed.geometry, after.observed.geometry, toleranceMm);
    return { name, sameViewportCameraBounds: true, geometryWithinToleranceMm: toleranceMm };
  });
  manifest.status = 'PASS';
} catch (error) {
  manifest.status = 'FAIL'; manifest.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  if (browser) { await browser.close(); manifest.browserClosed = !browser.isConnected(); }
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ status: manifest.status, mode, images: manifest.images.length,
    browserClosed: manifest.browserClosed, visualAcceptance: manifest.visualAcceptance }));
}
