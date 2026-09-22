import assert from 'node:assert/strict';
import { mkdir, rm, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const baseUrl = (process.env.ASA_CAD_OWNER_REVIEW_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, '');
const outputRoot = process.env.ASA_CAD_SCREENSHOT_ROOT ?? 'owner-visual-review/screenshots';

const captures = [
  { route: '/cad/dev/part/empty', fixture: 'empty', status: 'ready', width: 1920, height: 1080, relative: '1920x1080/part-empty.png' },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 1920, height: 1080, relative: '1920x1080/part-sketch.png' },
  { route: '/cad/dev/part/extrude', fixture: 'extrude', status: 'ready', width: 1920, height: 1080, relative: '1920x1080/part-extrude.png', canvas: true },
  { route: '/cad/dev/part/reference', fixture: 'reference', status: 'ready', width: 1920, height: 1080, relative: '1920x1080/part-reference.png', canvas: true },
  { route: '/cad/dev/part/rebuild-error', fixture: 'rebuild-error', status: 'error', width: 1920, height: 1080, relative: '1920x1080/part-rebuild-error.png' },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 2560, height: 1440, relative: 'responsive/sketch-2560x1440.png' },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 3440, height: 1440, relative: 'responsive/sketch-3440x1440.png' },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 1366, height: 768, relative: 'responsive/sketch-1366x768.png' },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 768, height: 1024, relative: 'responsive/sketch-768x1024.png', touch: true },
  { route: '/cad/dev/part/sketch', fixture: 'sketch', status: 'ready', width: 390, height: 844, relative: 'responsive/sketch-390x844.png', touch: true, mobile: true },
];

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), 'file is not a PNG');
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', 'PNG IHDR missing');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function capture(browser, item) {
  const context = await browser.newContext({
    viewport: { width: item.width, height: item.height },
    deviceScaleFactor: 1,
    hasTouch: Boolean(item.touch),
    isMobile: Boolean(item.mobile),
  });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

  try {
    const response = await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'networkidle', timeout: 30_000 });
    assert.ok(response?.ok(), `${item.relative}: navigation failed with ${response?.status()}`);

    await page.locator(
      `.cad-app[data-dev-fixture="${item.fixture}"][data-fixture-status="${item.status}"]`,
    ).waitFor({ timeout: 120_000 });

    if (item.canvas) {
      await page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
    }

    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      visualScale: window.visualViewport?.scale ?? 1,
      baseHref: document.querySelector('base')?.getAttribute('href') ?? null,
    }));

    assert.equal(metrics.innerWidth, item.width, `${item.relative}: viewport width mismatch`);
    assert.equal(metrics.innerHeight, item.height, `${item.relative}: viewport height mismatch`);
    assert.equal(metrics.dpr, 1, `${item.relative}: deviceScaleFactor is not 1`);
    assert.ok(Math.abs(metrics.visualScale - 1) < 0.001, `${item.relative}: browser zoom/page scale is not 100%`);
    assert.equal(metrics.baseHref, '/cad/', `${item.relative}: not the production /cad build`);
    assert.deepEqual(errors, [], `${item.relative}: page errors: ${errors.join('; ')}`);
    assert.deepEqual(failedRequests, [], `${item.relative}: failed requests: ${failedRequests.join('; ')}`);

    const path = join(outputRoot, item.relative);
    await mkdir(join(path, '..'), { recursive: true });
    await page.screenshot({ path, fullPage: false });

    const info = await stat(path);
    assert.ok(info.size > 0, `${item.relative}: screenshot is empty`);
    const png = await readFile(path);
    const dimensions = pngDimensions(png);
    assert.deepEqual(dimensions, { width: item.width, height: item.height }, `${item.relative}: PNG dimensions mismatch`);

    console.log(`PASS ${item.relative} ${dimensions.width}x${dimensions.height} ${info.size} bytes`);
  } finally {
    await context.close();
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const item of captures) await capture(browser, item);
} finally {
  await browser.close();
}

assert.equal(captures.length, 10, 'owner visual review must contain exactly the required 10 captures');
console.log('OWNER_SCREENSHOT_CAPTURE PASS — 10 real ASA-CAD PNG screenshots validated');
