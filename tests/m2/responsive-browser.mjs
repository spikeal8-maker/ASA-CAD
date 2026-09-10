import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const baseUrl = (process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').replace(/\/$/, '');
const matrix = JSON.parse(readFileSync(new URL('../../spec/ui/viewport-matrix.v1.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
const measurements = new Map();

function near(actual, expected, tolerance = 1, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

async function measureCase(testCase) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: testCase.deviceScaleFactor ?? 1,
    hasTouch: Boolean(testCase.touch),
    isMobile: testCase.width < 600,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));

  const response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `${testCase.id}: navigation failed with ${response?.status()}`);
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();

  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        display: style.display,
        visibility: style.visibility,
        fontSize: Number.parseFloat(style.fontSize),
        overflowX: style.overflowX,
      };
    };
    const mobileButtons = [...document.querySelectorAll('.mobile-bottom-bar button')].map((node) => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      app: rect('.cad-app'),
      mainBar: rect('.main-menu-bar'),
      tabs: rect('.document-tabs'),
      instrument: rect('.instrument-area'),
      ribbon: rect('.command-ribbon'),
      content: rect('.content-area'),
      work: rect('.work-area'),
      panel: rect('.management-panel'),
      rail: rect('.management-rail'),
      status: rect('.status-bar'),
      mobileBar: rect('.mobile-bottom-bar'),
      workspaceTab: rect('.workspace-tabs button'),
      documentTab: rect('.document-tab'),
      quickAccess: rect('.viewport-quick-access'),
      mobileButtons,
    };
  });

  assert.equal(metrics.innerWidth, testCase.width, `${testCase.id}: CSS viewport width mismatch`);
  assert.equal(metrics.innerHeight, testCase.height, `${testCase.id}: CSS viewport height mismatch`);
  near(metrics.dpr, testCase.deviceScaleFactor ?? 1, 0.05, `${testCase.id}: DPR`);
  assert.ok(metrics.app && metrics.work && metrics.content, `${testCase.id}: core shell geometry missing`);
  assert.ok(metrics.htmlScrollWidth <= testCase.width + 1, `${testCase.id}: document horizontally overflows (${metrics.htmlScrollWidth}px)`);
  assert.ok(metrics.bodyScrollWidth <= testCase.width + 1, `${testCase.id}: body horizontally overflows (${metrics.bodyScrollWidth}px)`);
  assert.ok(metrics.app.width <= testCase.width + 1, `${testCase.id}: app exceeds viewport width`);
  assert.ok(metrics.app.height <= testCase.height + 1, `${testCase.id}: app exceeds viewport height`);
  assert.ok(metrics.rootFontSize >= 14, `${testCase.id}: root text floor fell below 14px`);
  assert.ok((metrics.workspaceTab?.fontSize ?? 0) >= 12, `${testCase.id}: workspace label below 12px`);
  assert.ok((metrics.documentTab?.fontSize ?? metrics.rootFontSize) >= 12, `${testCase.id}: document tab text below 12px`);

  const phone = testCase.width < 600;
  const desktop = testCase.width >= 900;
  const minimumWorkWidthRatio = phone ? 0.94 : desktop ? 0.60 : 0.72;
  const minimumWorkHeightRatio = testCase.height <= 420 ? 0.55 : 0.58;
  assert.ok(metrics.work.width >= testCase.width * minimumWorkWidthRatio, `${testCase.id}: work area too narrow (${metrics.work.width}/${testCase.width})`);
  assert.ok(metrics.work.height >= testCase.height * minimumWorkHeightRatio, `${testCase.id}: work area too short (${metrics.work.height}/${testCase.height})`);
  assert.ok(metrics.quickAccess && metrics.quickAccess.display !== 'none', `${testCase.id}: viewport quick access unreachable`);

  if (desktop) {
    assert.ok(metrics.panel && metrics.panel.display !== 'none', `${testCase.id}: desktop management panel missing`);
    assert.ok(metrics.panel.width >= 220 && metrics.panel.width <= 440, `${testCase.id}: desktop panel width ${metrics.panel.width}px outside 220..440`);
    assert.ok(metrics.mobileBar?.display === 'none', `${testCase.id}: desktop shows mobile bottom bar`);
  }

  if (phone) {
    assert.ok(metrics.ribbon?.display === 'none', `${testCase.id}: phone exposes desktop command ribbon`);
    assert.ok(metrics.mobileBar && metrics.mobileBar.display !== 'none', `${testCase.id}: phone mobile bottom bar missing`);
    assert.ok(metrics.mobileBar.height >= 48, `${testCase.id}: mobile bottom bar below touch height floor`);
    assert.ok(metrics.mobileButtons.length >= 3, `${testCase.id}: mobile command discovery controls missing`);
    for (const [index, button] of metrics.mobileButtons.entries()) {
      assert.ok(button.height >= 44, `${testCase.id}: mobile button ${index} is ${button.height}px high`);
    }
  }

  assert.deepEqual(pageErrors, [], `${testCase.id}: page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `${testCase.id}: failed requests: ${failedRequests.join('; ')}`);
  await context.close();
  return metrics;
}

try {
  console.log('\nASA-CAD M2R effective viewport matrix');
  for (const testCase of matrix.cases.filter((item) => item.required && item.uiScale === 100)) {
    const metrics = await measureCase(testCase);
    measurements.set(testCase.id, metrics);
    console.log(`  ✓ ${testCase.id} — work ${Math.round(metrics.work.width)}×${Math.round(metrics.work.height)}, DPR ${metrics.dpr}`);
  }

  // Physical 4K scaling must not cause a second ASA scaling pass. Equal CSS
  // viewports should produce the same shell geometry regardless of DPR.
  const fhd = measurements.get('desktop-fhd-1920x1080');
  const fourK200 = measurements.get('desktop-4k-os200-effective');
  assert.ok(fhd && fourK200, 'missing FHD/4K@200 comparison cases');
  near(fhd.panel.width, fourK200.panel.width, 1, 'FHD vs 4K@200 panel width');
  near(fhd.rootFontSize, fourK200.rootFontSize, 0.1, 'FHD vs 4K@200 root font');
  near(fhd.instrument.height, fourK200.instrument.height, 1, 'FHD vs 4K@200 instrument height');

  const twoK = measurements.get('desktop-2k-2560x1440');
  const fourK150 = measurements.get('desktop-4k-os150-effective');
  assert.ok(twoK && fourK150, 'missing 2K/4K@150 comparison cases');
  near(twoK.panel.width, fourK150.panel.width, 1, '2K vs 4K@150 panel width');
  near(twoK.rootFontSize, fourK150.rootFontSize, 0.1, '2K vs 4K@150 root font');

  console.log('ASA-CAD M2R effective viewport matrix PASS');
  console.log('  ✓ HD/FHD/2K/ultrawide/4K/tablet/phone shell remains bounded and readable');
  console.log('  ✓ DPR does not double-scale CSS shell geometry');
} finally {
  await browser.close();
}
