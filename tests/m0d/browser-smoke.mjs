import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('../../vendor/toubkal/node_modules/playwright-core');

const url = process.env.ASA_CAD_URL ?? 'http://127.0.0.1:8088/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const pageErrors = [];
const failedRequests = [];
const wasmRequests = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`);
});
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response, 'browser navigation returned no response');
  assert.ok(response.ok(), `browser navigation failed: HTTP ${response.status()}`);

  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await page.getByText('Твердотельное моделирование', { exact: true }).waitFor();
  await page.getByText('Новая деталь', { exact: true }).waitFor();

  const state = await page.evaluate(() => ({
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    runtimeStatus: document.querySelector('.cad-app')?.getAttribute('data-runtime-status') ?? null,
    workWidth: document.querySelector('.work-area')?.getBoundingClientRect().width ?? 0,
    workHeight: document.querySelector('.work-area')?.getBoundingClientRect().height ?? 0,
    canvasCount: document.querySelectorAll('[data-testid="cad-viewport"] canvas').length,
    wasmResources: performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\.wasm(?:\?|$)/i.test(name)),
    vendorArtworkVisible: document.body.innerText.includes('PROFESSIONAL 3D CAD PLATFORM'),
  }));

  assert.equal(state.crossOriginIsolated, true, 'CAD route is not cross-origin isolated');
  assert.equal(state.sharedArrayBuffer, true, 'SharedArrayBuffer is unavailable');
  assert.ok(state.rootChildren >= 1, 'React application root is empty');
  assert.equal(state.runtimeStatus, 'idle', `fresh ASA shell runtime should be idle, got ${state.runtimeStatus}`);
  assert.ok(state.workWidth > 400, `CAD work area unexpectedly narrow: ${state.workWidth}`);
  assert.ok(state.workHeight > 300, `CAD work area unexpectedly short: ${state.workHeight}`);
  assert.equal(state.canvasCount, 0, 'fresh empty Part should not create a B-Rep canvas before a solid exists');
  assert.deepEqual(state.wasmResources, [], 'release shell eagerly loaded OpenCascade WASM');
  assert.deepEqual(wasmRequests, [], 'release shell issued a WASM request during boot');
  assert.equal(state.vendorArtworkVisible, false, 'release image exposed the vendor Toubkal product shell');
  assert.deepEqual(failedRequests, [], `browser requests failed:\n${failedRequests.join('\n')}`);
  assert.deepEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);

  console.log('ASA-CAD M0D lazy ASA shell boot PASS');
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
