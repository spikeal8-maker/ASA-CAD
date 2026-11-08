import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createXYSketch, interactionBox, launchM3Browser, sketchViewState, squarePoint,
} from '../m3/M3BrowserHarness.mjs';

const output = process.env.ASA_CAD_LINE_EVIDENCE_ROOT ?? 'ui-core-u1-evidence/u2-line-numeric';
const viewport = { width: 1600, height: 900 };
const anchor = [-20, 5];
const length = 40, angle = 30;
const endpoint = [anchor[0] + length * Math.cos(angle * Math.PI / 180),
  anchor[1] + length * Math.sin(angle * Math.PI / 180)];
const toleranceMm = 0.15; // Pointer coordinates are quantized to browser pixels.
const panel = '[data-testid="sketch-line-numeric"]';
const ghost = '[data-testid="sketch-line-ghost"]';
const interaction = '[data-testid="cad-sketch-interaction"][data-tool="line"]';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = ['BEFORE', 'AFTER'].map((side) => {
  const url = process.env['ASA_CAD_' + side + '_URL'];
  const sha = process.env['ASA_CAD_' + side + '_SHA'];
  const sourceState = process.env['ASA_CAD_' + side + '_SOURCE_STATE'] ?? 'committed';
  assert.ok(url, side + ' URL required');
  assert.match(sha ?? '', /^[a-f0-9]{40}$/, side + ' exact checkout SHA required');
  assert.ok(['committed', 'working-tree'].includes(sourceState));
  assert.ok(![8094, 8098, 8099].includes(Number(new URL(url).port)), 'Protected origin');
  return { side: side.toLowerCase(), url: url.replace(/\/$/, ''), checkoutSha: sha, sourceState };
});

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': expected ' + expected + ', got ' + actual);
}
function compareGeometry(a, b, tolerance) {
  for (const key of ['from', 'to']) for (let axis = 0; axis < 2; axis++) {
    near(a[key][axis], b[key][axis], tolerance, key + '[' + axis + ']');
  }
}
async function point(page, box, world, action) {
  const screen = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await page.mouse[action](screen.x, screen.y);
}
async function state(page) {
  return page.locator(interaction).evaluate((layer) => {
    const line = layer.querySelector('[data-testid="sketch-line-ghost"]');
    if (!line) throw new Error('Line preview missing');
    const numeric = document.querySelector('[data-testid="sketch-line-numeric"]');
    return {
      phase: layer.getAttribute('data-line-phase'),
      persistedEntities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')
        ?.getAttribute('data-entity-count')),
      geometry: {
        from: [Number(line.getAttribute('x1')), -Number(line.getAttribute('y1'))],
        to: [Number(line.getAttribute('x2')), -Number(line.getAttribute('y2'))],
      },
      numericControlsPresent: !!numeric,
      fields: numeric ? Object.fromEntries([...numeric.querySelectorAll('input[data-line-field]')]
        .map((e) => [e.getAttribute('data-line-field'), e.value])) : null,
      locks: numeric ? Object.fromEntries([...numeric.querySelectorAll('[data-line-lock]')]
        .map((e) => [e.getAttribute('data-line-lock'), e.getAttribute('data-locked') === 'true'])) : null,
    };
  });
}
async function capture(page, source, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const observed = await state(page);
  assert.equal(observed.phase, 'anchored');
  assert.equal(observed.persistedEntities, 0, 'Visual preview must not commit geometry');
  compareGeometry(observed.geometry, { from: anchor, to: endpoint }, toleranceMm);
  const camera = await sketchViewState(page);
  assert.deepEqual(camera, { span: 100, center: [0, 0] });
  const bounds = {
    stage: await page.locator(interaction).boundingBox(),
    parameters: await page.locator('.k-management-panel').boundingBox(),
  };
  const file = source.side + '/' + name + '.png';
  const png = await page.screenshot({ path: join(output, file), fullPage: false });
  assert.equal(png.readUInt32BE(16), viewport.width);
  assert.equal(png.readUInt32BE(20), viewport.height);
  return { ...source, name, file, bytes: png.length, sha256: sha256(png),
    viewport, camera, bounds, observed };
}

await mkdir(output, { recursive: true });
const browser = await launchM3Browser();
const manifest = {
  schemaVersion: 1,
  purpose: 'Ordinary product Line preview before/after numeric-entry slice',
  sources,
  environment: { browser: browser.version(), os: process.platform + ' ' + process.arch,
    viewport, deviceScaleFactor: 1, uiScale: 100, colorScheme: 'light' },
  setup: 'New Part -> Create Sketch -> XY -> Apply -> Line; no fixture or hidden mutation',
  expected: { support: 'XY', phase: 'anchored', anchor, endpoint, length, angle, toleranceMm },
  states: ['pointer-preview', 'numeric-locked-preview'],
  baselinePolicy: 'If numeric entry is absent, retain equivalent pointer preview and record its absence.',
  images: [],
  automatedParityClaim: 'NONE',
  visualAcceptance: 'OWNER_REQUIRED',
};
try {
  for (const source of sources) {
    await mkdir(join(output, source.side), { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const response = await page.goto(source.url + '/cad/?uiScale=100', { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200);
      await page.locator('.cad-app[data-document-kind="part"]').waitFor();
      await page.locator('[data-testid="cad-viewport"][data-scene-revision="reference"] canvas').waitFor();
      await createXYSketch(page);
      await page.locator('.k-command-ribbon [data-command-id="sketch.line"]').click();
      await page.locator('.k-content[data-panel-tab="params"]').waitFor();
      assert.equal(await page.locator('.k-management-panel').isVisible(), true);
      assert.equal(await page.locator('[data-testid="part-model-stage"]')
        .getAttribute('data-sketch-support'), 'XY');
      const { box } = await interactionBox(page, 'line');
      await point(page, box, anchor, 'click');
      await page.locator(interaction + '[data-line-phase="anchored"]').waitFor();
      await point(page, box, endpoint, 'move');
      await page.locator(ghost).waitFor();
      const numeric = await page.locator(panel).count() === 1;
      if (source.side === 'after') assert.equal(numeric, true, 'Candidate numeric Parameters missing');
      if (numeric) assert.equal(await page.locator(panel + ' [data-locked="true"]').count(), 0);
      manifest.images.push(await capture(page, source, 'pointer-preview'));

      if (numeric) {
        // Ordinary keyboard entry from the focused drawing surface, then native Tab order.
        await page.keyboard.type(String(length));
        await page.keyboard.press('Tab');
        await page.keyboard.type(String(angle));
        await page.locator(panel + ' [data-line-lock="length"][data-locked="true"]').waitFor();
        await page.locator(panel + ' [data-line-lock="angle"][data-locked="true"]').waitFor();
      }
      const locked = await capture(page, source, 'numeric-locked-preview');
      if (numeric) {
        assert.equal(locked.observed.fields.length, String(length));
        assert.equal(locked.observed.fields.angle, String(angle));
        const { from, to } = locked.observed.geometry;
        near(Math.hypot(to[0] - from[0], to[1] - from[1]), length, 1e-8, 'locked length');
        near(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI, angle, 1e-8, 'locked angle');
      }
      manifest.images.push(locked);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  manifest.matches = manifest.states.map((name) => {
    const before = manifest.images.find((item) => item.side === 'before' && item.name === name);
    const after = manifest.images.find((item) => item.side === 'after' && item.name === name);
    assert.deepEqual(before.viewport, after.viewport);
    assert.deepEqual(before.camera, after.camera);
    assert.deepEqual(before.bounds, after.bounds);
    compareGeometry(before.observed.geometry, after.observed.geometry, toleranceMm);
    return { name, sameViewportCameraBounds: true,
      maximumEndpointDeltaMm: Math.max(...['from', 'to'].flatMap((key) =>
        before.observed.geometry[key].map((value, i) => Math.abs(value - after.observed.geometry[key][i])))) };
  });
  manifest.status = 'PASS';
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('U2 Line visual capture PASS: two matched preview pairs; visual acceptance remains owner-required.');
} finally { await browser.close(); }
