import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('../../vendor/toubkal/node_modules/playwright-core');

const url = process.env.ASA_CAD_URL ?? 'http://127.0.0.1:8088/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const pageErrors = [];
const wasmFailures = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  if (request.url().includes('.wasm')) {
    wasmFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`);
  }
});

try {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  assert.ok(response, 'browser navigation returned no response');
  assert.ok(response.ok(), `browser navigation failed: HTTP ${response.status()}`);

  await page.waitForFunction(
    () => Boolean(window.oc) && Boolean(document.querySelector('canvas')),
    undefined,
    { timeout: 120_000 },
  );

  const state = await page.evaluate(() => ({
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    openCascadeReady: Boolean(window.oc),
    canvasCount: document.querySelectorAll('canvas').length,
    kernelFailureVisible: document.body.innerText.includes('Kernel initialization failed'),
    rootChildren: document.getElementById('root')?.children.length ?? 0,
  }));

  assert.equal(state.crossOriginIsolated, true, 'CAD route is not cross-origin isolated');
  assert.equal(state.sharedArrayBuffer, true, 'SharedArrayBuffer is unavailable');
  assert.equal(state.openCascadeReady, true, 'OpenCascade did not initialize in browser');
  assert.ok(state.canvasCount >= 1, 'CAD viewport canvas did not render');
  assert.ok(state.rootChildren >= 1, 'React application root is empty');
  assert.equal(state.kernelFailureVisible, false, 'kernel initialization failure is visible');
  assert.deepEqual(wasmFailures, [], `WASM requests failed:\n${wasmFailures.join('\n')}`);
  assert.deepEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);

  console.log('ASA-CAD M0D real-browser WASM boot PASS');
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
