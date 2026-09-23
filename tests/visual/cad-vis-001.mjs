import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const beforeUrl = (process.env.ASA_CAD_BEFORE_URL ?? 'http://127.0.0.1:8087').replace(/\/$/, '');
const afterUrl = (process.env.ASA_CAD_AFTER_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, '');
const outputRoot = process.env.ASA_CAD_VIS_ROOT ?? 'cad-vis-001-repair';

const SOURCE_SHA = process.env.ASA_CAD_SOURCE_SHA ?? 'd57aa7e8a2696caa53ec66f020aaa866b7911dec';
const RESULT_SHA = process.env.ASA_CAD_RESULT_SHA ?? null;
const sourceCheckoutSha = process.env.ASA_CAD_SOURCE_CHECKOUT_SHA ?? null;
const resultCheckoutSha = process.env.ASA_CAD_RESULT_CHECKOUT_SHA ?? null;
const sourceImageId = process.env.ASA_CAD_SOURCE_IMAGE_ID ?? null;
const resultImageId = process.env.ASA_CAD_RESULT_IMAGE_ID ?? null;

const layoutViewports = [
  { width: 768, height: 1024, label: 'tablet-768x1024' },
  { width: 899, height: 1024, label: 'boundary-899x1024' },
  { width: 900, height: 1024, label: 'boundary-900x1024' },
  { width: 901, height: 1024, label: 'boundary-901x1024' },
  { width: 1920, height: 1080, label: 'desktop-1920x1080' },
  { width: 1366, height: 768, label: 'compact-1366x768' },
];

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

async function openPage(browser, baseUrl, route, width, height, mobile = false) {
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
  page.on('requestfailed', (request) => failedRequests.push(
    `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
  ));

  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `${route}: navigation failed with ${response?.status()}`);
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
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
  assert.deepEqual(errors, [], `${route}: page errors: ${errors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `${route}: failed requests: ${failedRequests.join('; ')}`);
  return { context, page, metrics };
}

async function openEmptyFixture(browser, baseUrl, width, height) {
  const opened = await openPage(browser, baseUrl, '/cad/dev/part/empty?uiScale=100', width, height);
  await opened.page.locator('.cad-app[data-dev-fixture="empty"][data-fixture-status="ready"]').waitFor({ timeout: 120_000 });
  await opened.page.getByText('Fixture empty готов', { exact: true }).waitFor({ timeout: 120_000 });
  return opened;
}

async function ribbonSnapshot(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const ribbon = document.querySelector('.command-ribbon');
    const wrapper = document.querySelector('.part-command-groups');
    if (!(ribbon instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) return null;

    const groups = [...wrapper.querySelectorAll('.command-group')]
      .filter((node) => node instanceof HTMLElement && getComputedStyle(node).display !== 'none')
      .map((node) => ({
        className: node.className,
        ...rect(node),
        label: node.querySelector('.command-group-label')?.textContent?.trim() ?? '',
      }));

    const controls = [...wrapper.querySelectorAll('.ribbon-command, .command-group-label')]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      })
      .map((node) => ({
        id: node.getAttribute('data-command-id') ?? `label:${node.textContent?.trim() ?? ''}`,
        ...rect(node),
      }));

    return {
      ribbon: { ...rect(ribbon), scrollWidth: ribbon.scrollWidth, clientWidth: ribbon.clientWidth, scrollLeft: ribbon.scrollLeft },
      wrapper: { ...rect(wrapper), display: getComputedStyle(wrapper).display },
      groups,
      controls,
    };
  });
}

function overlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return { x, y, overlaps: x > 0.5 && y > 0.5 };
}

function assertNoControlOverlap(snapshot, label) {
  for (let i = 0; i < snapshot.controls.length; i += 1) {
    for (let j = i + 1; j < snapshot.controls.length; j += 1) {
      const hit = overlap(snapshot.controls[i], snapshot.controls[j]);
      assert.equal(
        hit.overlaps,
        false,
        `${label}: ${snapshot.controls[i].id} overlaps ${snapshot.controls[j].id} by ${hit.x.toFixed(1)}×${hit.y.toFixed(1)}`,
      );
    }
  }
}

async function reproduceBefore(browser) {
  const { context, page } = await openEmptyFixture(browser, beforeUrl, 768, 1024);
  try {
    const snapshot = await ribbonSnapshot(page);
    assert.ok(snapshot, 'baseline tablet ribbon missing');
    const clipped = snapshot.groups.filter(
      (group) => group.y < snapshot.ribbon.y - 0.5 || group.bottom > snapshot.ribbon.bottom + 0.5,
    );
    assert.notEqual(snapshot.wrapper.display, 'flex', 'baseline unexpectedly already has horizontal Part wrapper');
    assert.ok(clipped.length > 0, 'baseline tablet defect did not reproduce: no vertically clipped Part groups');

    const path = join(outputRoot, 'before/tablet-768x1024.png');
    await mkdir(join(outputRoot, 'before'), { recursive: true });
    await page.screenshot({ path, fullPage: false });

    return {
      reproduced: true,
      wrapperDisplay: snapshot.wrapper.display,
      clippedGroups: clipped.map((group) => group.label),
      screenshot: await fileEvidence(path, { width: 768, height: 1024 }),
    };
  } finally {
    await context.close();
  }
}

async function assertFixedLayout(browser, item) {
  const { context, page } = await openEmptyFixture(browser, afterUrl, item.width, item.height);
  try {
    const snapshot = await ribbonSnapshot(page);
    assert.ok(snapshot, `${item.label}: ribbon snapshot missing`);
    assert.equal(snapshot.wrapper.display, 'flex', `${item.label}: Part wrapper is not flex`);

    for (const group of snapshot.groups) {
      assert.ok(group.y >= snapshot.ribbon.y - 0.5, `${item.label}: ${group.label} starts above ribbon`);
      assert.ok(group.bottom <= snapshot.ribbon.bottom + 0.5, `${item.label}: ${group.label} falls below visible ribbon`);
    }
    assertNoControlOverlap(snapshot, item.label);

    let horizontalScroll = { required: snapshot.ribbon.scrollWidth > snapshot.ribbon.clientWidth + 1, exercised: false };
    if (horizontalScroll.required) {
      const ribbon = page.locator('.command-ribbon');
      await ribbon.hover();
      const start = await ribbon.evaluate((node) => node.scrollLeft);
      await page.mouse.wheel(420, 0);
      await page.waitForTimeout(80);
      const end = await ribbon.evaluate((node) => node.scrollLeft);
      assert.ok(end > start, `${item.label}: horizontal ribbon overflow exists but wheel scrolling did not move it`);
      horizontalScroll = { required: true, exercised: true, start, end };
    }

    return {
      viewport: `${item.width}x${item.height}`,
      wrapperDisplay: snapshot.wrapper.display,
      groupCount: snapshot.groups.length,
      scrollWidth: snapshot.ribbon.scrollWidth,
      clientWidth: snapshot.ribbon.clientWidth,
      horizontalScroll,
      pass: true,
    };
  } finally {
    await context.close();
  }
}

async function snapshotDocument(page) {
  return page.locator('.cad-app').evaluate((node) => ({
    kind: node.getAttribute('data-document-kind'),
    sketches: node.getAttribute('data-sketch-count'),
    features: node.getAttribute('data-feature-count'),
    refs: node.getAttribute('data-stable-reference-count'),
    activeSketch: node.getAttribute('data-active-sketch-id'),
    selectedBody: node.getAttribute('data-selected-body-id'),
    dirty: document.querySelectorAll('.dirty-dot').length,
    treeRows: [...document.querySelectorAll('.tree-row .tree-label')].map((item) => item.textContent?.trim() ?? ''),
    savedDocument: localStorage.getItem('asa-cad-m2-shell-document'),
  }));
}

async function createNewPart(page) {
  await page.locator('.new-tab-button').click();
  const dialog = page.getByRole('dialog', { name: 'Новый документ' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: /Деталь/ }).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();
}

async function verifyCreateSketchCancel(browser, width, height, options = {}) {
  const mobile = Boolean(options.mobile);
  const { context, page } = await openPage(browser, afterUrl, '/cad/?uiScale=100', width, height, mobile);
  try {
    await createNewPart(page);
    const before = await snapshotDocument(page);

    let createSketch;
    if (mobile) {
      const toolsTab = page.getByRole('button', { name: /Инструменты/ });
      await toolsTab.click();
      const tools = page.locator('[data-mobile-tools="true"]');
      await tools.waitFor();
      createSketch = tools.locator('[data-command-id="part.sketch.create"]');
    } else {
      createSketch = page.locator('.command-ribbon [data-command-id="part.sketch.create"]');
      await createSketch.scrollIntoViewIfNeeded();
    }

    assert.equal(await createSketch.isEnabled(), true, `${width}x${height}: Create Sketch is not enabled`);
    await createSketch.click();
    await page.getByText('Плоскость построения', { exact: true }).waitFor();

    let planeScreenshot = null;
    if (options.capturePlane) {
      const path = join(outputRoot, 'after/tablet-plane-768x1024.png');
      await page.screenshot({ path, fullPage: false });
      planeScreenshot = await fileEvidence(path, { width: 768, height: 1024 });
    }

    const during = await snapshotDocument(page);
    assert.deepEqual(during, before, `${width}x${height}: starting Create Sketch changed document state`);

    await page.locator('.parameter-actions').getByRole('button', { name: 'Отмена', exact: true }).click();
    await page.getByText('Плоскость построения', { exact: true }).waitFor({ state: 'detached' });
    const after = await snapshotDocument(page);
    assert.deepEqual(after, before, `${width}x${height}: Cancel changed geometry/history/references/dirty state`);

    return { viewport: `${width}x${height}`, before, during, after, planeScreenshot, pass: true };
  } finally {
    await context.close();
  }
}

async function captureAfter(browser) {
  await mkdir(join(outputRoot, 'after'), { recursive: true });
  const captures = [];

  for (const item of [
    { width: 768, height: 1024, file: 'tablet-768x1024.png' },
    { width: 1920, height: 1080, file: 'desktop-1920x1080.png' },
    { width: 1366, height: 768, file: 'compact-1366x768.png' },
  ]) {
    const { context, page } = await openEmptyFixture(browser, afterUrl, item.width, item.height);
    try {
      const path = join(outputRoot, 'after', item.file);
      await page.screenshot({ path, fullPage: false });
      captures.push(await fileEvidence(path, { width: item.width, height: item.height }));
    } finally {
      await context.close();
    }
  }
  return captures;
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });

let reproduction;
const layoutResults = [];
const flowResults = [];
let afterCaptures;
let browserVersion;

try {
  browserVersion = browser.version();

  // The source product is exercised first. This must reproduce the real 768px clipping defect.
  reproduction = await reproduceBefore(browser);

  // Only after baseline reproduction do we validate the repaired product.
  for (const item of layoutViewports) {
    layoutResults.push(await assertFixedLayout(browser, item));
  }

  for (const width of [768, 899, 900, 901]) {
    flowResults.push(await verifyCreateSketchCancel(browser, width, 1024, { capturePlane: width === 768 }));
  }

  // Phone keeps its existing Tools-sheet composition; the desktop ribbon stays hidden.
  flowResults.push(await verifyCreateSketchCancel(browser, 390, 844, { mobile: true }));

  afterCaptures = await captureAfter(browser);
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: 1,
  package: 'CAD-VIS-001-REPAIR',
  source: {
    productSha: SOURCE_SHA,
    actualCheckoutSha: sourceCheckoutSha,
    localDockerImageId: sourceImageId,
    screenshotOrigin: 'baseline-build',
  },
  result: {
    productSha: RESULT_SHA,
    actualCheckoutSha: resultCheckoutSha,
    localDockerImageId: resultImageId,
  },
  environment: {
    browser: `Chromium ${browserVersion}`,
    os: `${process.platform} ${process.arch}`,
    deviceScaleFactor: 1,
    uiScale: 100,
    browserZoomPercent: 100,
  },
  reproduction,
  layoutResults,
  flowResults,
  afterCaptures,
  oldArtifactDependency: false,
};
await writeFile(join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('CAD-VIS-001-REPAIR targeted application/evidence checks PASS');
