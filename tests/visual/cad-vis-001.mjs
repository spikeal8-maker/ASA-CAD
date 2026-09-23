import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const baseUrl = (process.env.ASA_CAD_VIS_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, '');
const outputRoot = process.env.ASA_CAD_VIS_ROOT ?? 'cad-vis-001';
const beforeFull = process.env.ASA_CAD_BEFORE_FULL ?? join(outputRoot, 'before/full-1920x1080.png');
const beforeCrop = process.env.ASA_CAD_BEFORE_CROP ?? join(outputRoot, 'before/instrument-1920x1080.png');

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), 'file is not a PNG');
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', 'PNG IHDR missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function fileEvidence(path, expected) {
  const info = await stat(path);
  assert.ok(info.size > 0, `${path}: empty evidence file`);
  const bytes = await readFile(path);
  assert.deepEqual(pngDimensions(bytes), expected, `${path}: PNG dimensions mismatch`);
  return {
    path,
    bytes: info.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...expected,
  };
}

async function openEmptyFixture(browser, width, height, mobile = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

  const response = await page.goto(`${baseUrl}/cad/dev/part/empty?uiScale=100`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });
  assert.ok(response?.ok(), `empty fixture navigation failed: ${response?.status()}`);
  await page.locator('.cad-app[data-dev-fixture="empty"][data-fixture-status="ready"]').waitFor({ timeout: 120_000 });
  await page.getByText('Fixture empty готов', { exact: true }).waitFor({ timeout: 120_000 });
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });

  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    zoom: window.visualViewport?.scale ?? 1,
    uiScale: document.documentElement.dataset.uiScale,
    baseHref: document.querySelector('base')?.getAttribute('href') ?? null,
  }));
  assert.deepEqual(metrics, {
    width,
    height,
    dpr: 1,
    zoom: 1,
    uiScale: '100',
    baseHref: '/cad/',
  });
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join('; ')}`);
  return { context, page, metrics };
}

async function captureAfter(browser) {
  const afterDir = join(outputRoot, 'after');
  await mkdir(afterDir, { recursive: true });

  const desktop = await openEmptyFixture(browser, 1920, 1080);
  const full1920 = join(afterDir, 'full-1920x1080.png');
  const crop1920 = join(afterDir, 'instrument-1920x1080.png');
  await desktop.page.screenshot({ path: full1920, fullPage: false });
  await desktop.page.screenshot({
    path: crop1920,
    fullPage: false,
    clip: { x: 3, y: 55, width: 1914, height: 93 },
  });
  await desktop.context.close();

  const compact = await openEmptyFixture(browser, 1366, 768);
  const full1366 = join(afterDir, 'full-1366x768.png');
  await compact.page.screenshot({ path: full1366, fullPage: false });
  await compact.context.close();

  const phone = await openEmptyFixture(browser, 390, 844, true);
  const phone390 = join(afterDir, 'phone-390x844.png');
  await phone.page.screenshot({ path: phone390, fullPage: false });
  await phone.context.close();

  return [
    await fileEvidence(full1920, { width: 1920, height: 1080 }),
    await fileEvidence(crop1920, { width: 1914, height: 93 }),
    await fileEvidence(full1366, { width: 1366, height: 768 }),
    await fileEvidence(phone390, { width: 390, height: 844 }),
  ];
}

async function verifyOrdinaryCreateSketch(browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/cad/?uiScale=100`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
    await page.locator('.new-tab-button').click();
    const dialog = page.getByRole('dialog', { name: 'Новый документ' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: /Деталь/ }).click();
    await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();

    const before = await page.locator('.cad-app').evaluate((node) => ({
      sketches: node.getAttribute('data-sketch-count'),
      features: node.getAttribute('data-feature-count'),
      refs: node.getAttribute('data-stable-reference-count'),
      dirty: document.querySelectorAll('.dirty-dot').length,
    }));

    await page.getByRole('button', { name: /Создать эскиз/i }).click();
    await page.getByText('Плоскость построения', { exact: true }).waitFor();
    assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '0');
    await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    await page.getByText('Плоскость построения', { exact: true }).waitFor({ state: 'detached' });

    const after = await page.locator('.cad-app').evaluate((node) => ({
      sketches: node.getAttribute('data-sketch-count'),
      features: node.getAttribute('data-feature-count'),
      refs: node.getAttribute('data-stable-reference-count'),
      dirty: document.querySelectorAll('.dirty-dot').length,
    }));
    assert.deepEqual(after, before, 'Cancel changed the ordinary new Part document');
    return { route: '/cad/', action: 'new Part -> Create Sketch -> Cancel', before, after, pass: true };
  } finally {
    await context.close();
  }
}

await mkdir(dirname(beforeFull), { recursive: true });
const before = [
  await fileEvidence(beforeFull, { width: 1920, height: 1080 }),
  await fileEvidence(beforeCrop, { width: 1914, height: 93 }),
];

const browser = await chromium.launch({ headless: true });
let after;
let flow;
let browserVersion;
try {
  browserVersion = browser.version();
  after = await captureAfter(browser);
  flow = await verifyOrdinaryCreateSketch(browser);
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: 1,
  package: 'CAD-VIS-001',
  reference: {
    id: 'kompas25-part-shell',
    planCommit: 'b4fefb3deb4634517747de920de61dd01031ec40',
    captureCommit: 'dfa849513ad957c8782c8de4f618ca14b883a59f',
    sourceState: 'part-empty',
    confirmedSourceGeometry: {
      SYSTEM: { x: 124, y: 130, width: 66, height: 18, commandWidth: 26 },
      Sketch: { x: 203, y: 130, width: 108, height: 18 },
      Solid_elements: { x: 324, y: 130, width: 468, height: 18 },
    },
  },
  baseline: {
    productHead: 'a9d37cafef043e2db4a4b04334e71755d7df9d29',
    actualCheckoutSha: 'e20acba71cdfff83f459f40e85bcece3072f79aa',
    artifactId: 10691312625,
    workflowRunId: 35721665516,
  },
  result: {
    productHead: process.env.ASA_CAD_RESULT_SHA ?? null,
    actualCheckoutSha: process.env.ASA_CAD_ACTUAL_CHECKOUT_SHA ?? null,
    workflowRunId: process.env.GITHUB_RUN_ID ?? null,
  },
  environment: {
    browser: `Chromium ${browserVersion}`,
    os: `${process.platform} ${process.arch}`,
    uiScale: 100,
    browserZoomPercent: 100,
    deviceScaleFactor: 1,
  },
  before,
  after,
  flow,
  parity: 'PARTIAL',
  remaining: [
    'Solid_elements source group contains additional KOMPAS controls not implemented in ASA-CAD.',
    'Later KOMPAS groups and proprietary artwork are outside CAD-VIS-001.',
  ],
};
await writeFile(join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('CAD-VIS-001 screenshot evidence PASS');
