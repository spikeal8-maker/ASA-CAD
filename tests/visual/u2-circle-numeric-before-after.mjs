import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = process.env.ASA_CAD_CAPTURE_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { createXYSketch, interactionBox, launchM3Browser, sketchViewState, squarePoint } =
  await import(pathToFileURL(join(repo, 'tests/m3/M3BrowserHarness.mjs')).href);
const output = process.env.ASA_CAD_CIRCLE_EVIDENCE_ROOT ?? 'ui-core-u1-evidence/u2-circle-numeric';
const mode = process.env.ASA_CAD_CIRCLE_CAPTURE_MODE ?? 'both';
assert.ok(['before-only', 'after-only', 'both'].includes(mode));
const viewport = { width: 1600, height: 900 };
const center = [-10, 5], right = [10, 5], up = [-10, 25], radius = 20, toleranceMm = 0.15;
const panel = '[data-testid="sketch-circle-numeric"]';
const interaction = '[data-testid="cad-sketch-interaction"][data-tool="circle"]';
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
  for (let i = 0; i < 2; i++) {
    near(a.center[i], b.center[i], tolerance, 'center[' + i + ']');
    if (a.pointer && b.pointer) near(a.pointer[i], b.pointer[i], tolerance, 'pointer[' + i + ']');
  }
  near(a.radius, b.radius, tolerance, 'radius');
}
async function point(page, box, world, action) {
  const screen = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await page.mouse[action](screen.x, screen.y);
}
async function state(page) {
  return page.locator(interaction).evaluate((layer) => {
    const anchor = layer.querySelector('[data-testid="sketch-circle-center"]');
    const line = layer.querySelector('[data-testid="sketch-circle-radius-line"]');
    const ghost = layer.querySelector('[data-testid="sketch-circle-ghost"]');
    if (!anchor || !ghost) throw new Error('Circle preview missing');
    const c = [Number(anchor.getAttribute('cx')), -Number(anchor.getAttribute('cy'))];
    // The baseline layer has no radius line; pointer is observed only when present.
    const p = line ? [Number(line.getAttribute('x2')), -Number(line.getAttribute('y2'))] : null;
    const numeric = document.querySelector('[data-testid="sketch-circle-numeric"]');
    const style = getComputedStyle(ghost), bounds = layer.getBoundingClientRect();
    return {
      phase: layer.getAttribute('data-circle-phase'),
      persistedEntities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')
        ?.getAttribute('data-entity-count')),
      geometry: { center: c, pointer: p, radius: Number(ghost.getAttribute('r')) },
      paint: { parentWidth: bounds.width, parentHeight: bounds.height, stroke: style.stroke,
        strokeWidth: Number.parseFloat(style.strokeWidth), opacity: Number(style.opacity),
        display: style.display, visibility: style.visibility },
      numericControlsPresent: !!numeric,
      fields: numeric ? Object.fromEntries([...numeric.querySelectorAll('input[data-circle-field]')]
        .map((e) => [e.getAttribute('data-circle-field'), e.value])) : null,
      diameterLocked: numeric ? numeric.getAttribute('data-diameter-locked') === 'true' : null,
    };
  });
}
async function capture(page, source, name, pointer, phase) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
  });
  const observed = await state(page);
  assert.equal(observed.phase, phase);
  assert.equal(observed.persistedEntities, 0, 'Preview must not commit');
  assert.ok(observed.paint.parentWidth > 120 && observed.paint.parentHeight > 120);
  assert.ok(observed.paint.stroke !== 'none' && observed.paint.strokeWidth > 0 && observed.paint.opacity > 0);
  assert.notEqual(observed.paint.display, 'none'); assert.equal(observed.paint.visibility, 'visible');
  near(observed.geometry.radius, radius, toleranceMm, 'ghost radius');
  const camera = await sketchViewState(page);
  assert.deepEqual(camera, { span: 100, center: [0, 0] });
  const bounds = { stage: await page.locator(interaction).boundingBox(),
    parameters: await page.locator('.k-management-panel').boundingBox() };
  const file = source.side + '/' + name + '.png';
  const png = await page.screenshot({ path: join(output, file), fullPage: false });
  assert.equal(png.readUInt32BE(16), viewport.width);
  assert.equal(png.readUInt32BE(20), viewport.height);
  return { ...source, name, file, bytes: png.length, sha256: hash(png), viewport, camera, bounds,
    pointer, observed };
}

await mkdir(output, { recursive: true });
const manifest = { schemaVersion: 1, mode, status: 'RUNNING',
  purpose: 'Ordinary product Circle preview before/after numeric-entry slice', sources,
  setup: 'New Part -> Create Sketch -> XY -> Apply -> Circle; no fixture or hidden mutation',
  expected: { center, radius, pointerStates: [right, up], diameter: radius * 2, toleranceMm },
  states: ['awaiting-point-pointer', 'diameter-locked-preview'], images: [],
  baselinePolicy: 'Baseline already ships the numeric Circle input (Circle slice merged into the base); pointer-geometry and diameter-lock parity is verified between the two builds.',
  automatedParityClaim: 'NONE', visualAcceptance: 'OWNER_REQUIRED', browserClosed: false };
let browser;
try {
  if (mode === 'after-only') {
    const file = process.env.ASA_CAD_CIRCLE_BASELINE_MANIFEST;
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
      await page.locator('.k-command-ribbon [data-command-id="sketch.circle"]').click();
      await page.locator('.k-content[data-panel-tab="params"]').waitFor();
      assert.equal(await page.locator('.k-management-panel').isVisible(), true);
      assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
      const { box } = await interactionBox(page, 'circle');
      await point(page, box, center, 'click');
      await page.locator(interaction + '[data-circle-phase="awaiting-point"]').waitFor();
      await point(page, box, right, 'move');
      await page.locator('[data-testid="sketch-circle-ghost"]').waitFor({ state: 'attached' });
      const numeric = await page.locator(panel).count() === 1;
      assert.equal(numeric, true, source.side + ' numeric Circle panel missing');
      const first = await capture(page, source, 'awaiting-point-pointer', right, 'awaiting-point');
      assert.equal(first.observed.diameterLocked, false, 'Pointer preview must not be locked');
      manifest.images.push(first);
      await page.keyboard.type(String(radius * 2));
      await page.locator(panel + '[data-diameter-locked="true"]').waitFor();
      await point(page, box, up, 'move');
      const second = await capture(page, source, 'diameter-locked-preview', up, 'awaiting-point');
      assert.equal(second.observed.fields.diameter, String(radius * 2));
      assert.equal(second.observed.diameterLocked, true);
      near(second.observed.geometry.radius, radius, 1e-8, 'locked diameter preview');
      manifest.images.push(second);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  if (mode !== 'before-only') manifest.matches = manifest.states.map((name) => {
    const before = manifest.images.find((x) => x.side === 'before' && x.name === name);
    const after = manifest.images.find((x) => x.side === 'after' && x.name === name);
    assert.deepEqual(before.viewport, after.viewport); assert.deepEqual(before.camera, after.camera);
    assert.deepEqual(before.bounds, after.bounds);
    const locked = name === 'diameter-locked-preview';
    assert.equal(before.observed.diameterLocked, locked, 'Baseline lock matches the captured state');
    assert.equal(after.observed.diameterLocked, locked, 'Candidate lock matches the captured state');
    compareGeometry(before.observed.geometry, after.observed.geometry, toleranceMm);
    return { name, sameViewportCameraBounds: true, bothDiameterLocked: locked, geometryWithinToleranceMm: toleranceMm };
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
