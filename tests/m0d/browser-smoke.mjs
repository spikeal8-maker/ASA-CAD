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
const projectResponses = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`);
});
page.on('request', (request) => {
  if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
});
page.on('response', (response) => {
  if (new URL(response.url()).pathname.startsWith('/api/projects/')) {
    projectResponses.push({
      url: response.url(), method: response.request().method(), status: response.status(),
      contentType: response.headers()['content-type'] ?? '',
    });
  }
});

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response, 'browser navigation returned no response');
  assert.ok(response.ok(), `browser navigation failed: HTTP ${response.status()}`);

  const initialUrl = new URL(url);
  const projectRoute = initialUrl.pathname.match(/^\/cad\/projects\/([^/]+)\/?$/);
  let entry = { kind: 'standalone' };
  if (initialUrl.pathname === '/' || projectRoute) {
    if (projectRoute) {
      await page.locator('.cad-startup[role="alert"]').getByRole('heading', {
        name: 'Не удалось открыть проект', exact: true,
      }).waitFor();
      const projectUrl = new URL(`/api/projects/${encodeURIComponent(decodeURIComponent(projectRoute[1]))}`, initialUrl).href;
      const loads = projectResponses.filter(item => item.url === projectUrl && item.method === 'GET');
      assert.ok(loads.length >= 1, 'server project route did not attempt to load its real host');
      assert.ok(loads.every(item => item.status >= 400 || !/\bapplication\/(?:[^;\s]+\+)?json\b/i.test(item.contentType)),
        'static Docker smoke unexpectedly received a successful JSON project response');
      entry = { kind: 'server-unavailable', loads };
    } else {
      await page.getByTestId('three-mode-launcher').waitFor();
      assert.equal(await page.locator('.asa-launcher-card').count(), 3, 'root must offer all three editor modes');
      entry = { kind: 'launcher' };
    }
    const entryState = await page.evaluate(() => ({
      crossOriginIsolated: window.crossOriginIsolated,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      editorCount: document.querySelectorAll('.cad-app').length,
      canvasCount: document.querySelectorAll('[data-testid="cad-viewport"] canvas').length,
    }));
    assert.equal(entryState.crossOriginIsolated, true, 'entry route is not cross-origin isolated');
    assert.equal(entryState.sharedArrayBuffer, true, 'entry route has no SharedArrayBuffer');
    assert.equal(entryState.editorCount, 0, 'entry route unexpectedly opened an editable local document');
    assert.equal(entryState.canvasCount, 0, 'entry route unexpectedly mounted a CAD scene');
    assert.deepEqual(wasmRequests, [], 'entry route eagerly requested WASM');
    entry = { ...entry, ...entryState };

    // The static image has no ASA Lab project backend. Exercise the real standalone
    // shell separately after proving the launcher or honest project-load failure.
    const editorResponse = await page.goto(new URL('/cad/', initialUrl).href, { waitUntil: 'networkidle', timeout: 30_000 });
    assert.ok(editorResponse, 'standalone editor navigation returned no response');
    assert.ok(editorResponse.ok(), `standalone editor navigation failed: HTTP ${editorResponse.status()}`);
  }

  await page.locator('.cad-app :is(.k-main-menu-bar, .brand-button)').first().waitFor();
  await page.getByText('Твердотельное моделирование', { exact: true }).waitFor();
  await page.locator('[data-testid="cad-viewport"][data-scene-revision="reference"][data-reference-planes="XY,XZ,YZ"] canvas').waitFor();

  const state = await page.evaluate(() => ({
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    runtimeStatus: document.querySelector('.cad-app')?.getAttribute('data-runtime-status') ?? null,
    workWidth: document.querySelector('.k-work-area, .work-area')?.getBoundingClientRect().width ?? 0,
    workHeight: document.querySelector('.k-work-area, .work-area')?.getBoundingClientRect().height ?? 0,
    canvasCount: document.querySelectorAll('[data-testid="cad-viewport"] canvas').length,
    runtimeRevision: document.querySelector('[data-testid="cad-viewport"]')?.getAttribute('data-runtime-revision') ?? null,
    splashVisible: [...document.querySelectorAll('.stage-message')].some((node) => node.textContent?.includes('Новая деталь')),
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
  assert.equal(state.canvasCount, 1, 'fresh empty Part must show one persistent spatial scene');
  assert.equal(state.runtimeRevision, '', 'fresh empty Part must not build B-Rep before a solid exists');
  assert.equal(state.splashVisible, false, 'fresh empty Part must not replace the work area with a splash');
  assert.deepEqual(state.wasmResources, [], 'release shell eagerly loaded OpenCascade WASM');
  assert.deepEqual(wasmRequests, [], 'release shell issued a WASM request during boot');
  assert.equal(state.vendorArtworkVisible, false, 'release image exposed the vendor Toubkal product shell');
  assert.deepEqual(failedRequests, [], `browser requests failed:\n${failedRequests.join('\n')}`);
  assert.deepEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);

  console.log('ASA-CAD M0D lazy ASA shell boot PASS');
  console.log(JSON.stringify({ entry }, null, 2));
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
