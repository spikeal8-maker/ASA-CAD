import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import esbuild from '../../vendor/toubkal/node_modules/esbuild/lib/main.js';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const bundled = await esbuild.build({
  entryPoints: [path.join(repo, 'tests/m2/solved-profile-ui-fixture.tsx')],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  outdir: path.join(repo, 'unused-memory-output'), assetNames: '[name]-[hash]',
  nodePaths: [path.join(repo, 'vendor/toubkal/node_modules')],
  loader: { '.wasm': 'file' }, external: ['fs', 'path', 'url', 'module'],
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
}).finally(() => esbuild.stop());
const assets = new Map(bundled.outputFiles.map(file => ['/' + path.basename(file.path), file.contents]));
const script = [...assets.keys()].find(name => name.endsWith('.js'));
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const asset = assets.get(request.url);
  if (asset) {
    response.setHeader('Content-Type', request.url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
    response.end(asset);
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><div id="root"></div><script src="' + script + '"></script>');
  }
});
let browser, context, page;
const errors = [], cases = [];
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  assert.ok(![8094, 8098, 8099].includes(port));
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    ...(process.env.ASA_CAD_BROWSER_EXECUTABLE ? { executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE } : {}),
  });
  context = await browser.newContext(); page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + port, { waitUntil: 'load', timeout: 15000 });
  const state = () => page.evaluate(() => profileHarness.state());
  const ready = mode => page.waitForFunction(mode => {
    const s = profileHarness.state();
    return mode === 'cut' ? s.cut : s.extrude;
  }, mode, { timeout: 15000 });
  const setup = async kind => {
    const before = await page.evaluate(kind => profileHarness.setup(kind), kind);
    await page.locator('[data-mounted]').waitFor({ state: 'visible' });
    return before;
  };

  for (const kind of ['triangle', 'cut']) {
    const before = await setup(kind); await ready(kind);
    const admitted = await state();
    assert.equal(admitted.dto, before, 'solve/enablement may not change persisted intent');
    assert.deepEqual(admitted.commands, [], 'eligibility must not add application commands/history');
    assert.equal(kind === 'cut' ? admitted.catalogCut : admitted.catalogExtrude, true);
    await page.locator(kind === 'cut' ? '#cut' : '#extrude').click();
    await page.waitForFunction(kind => profileHarness.state().active === (kind === 'cut' ? 'part.cutExtrude' : 'part.extrude'), kind);
    await page.locator('#commit').click();
    await page.waitForFunction(kind => {
      const s = profileHarness.state();
      return s.features === (kind === 'cut' ? 2 : 1) && s.active === null;
    }, kind);
    assert.deepEqual((await state()).commands, [kind === 'cut' ? 'feature.cutExtrude' : 'feature.extrude', 'document.rebuild']);
    cases.push(kind + '-render-begin-commit-catalog');
  }

  await setup('open');
  await page.waitForFunction(() => profileHarness.state().extrudeReason?.includes('контур не замкнут'));
  const blocked = await page.evaluate(() => profileHarness.bypassDisabled());
  assert.equal(blocked.catalogExtrude, false);
  assert.equal(blocked.catalogExtrudeReason, blocked.extrudeReason);
  assert.equal(blocked.features, 0); assert.deepEqual(blocked.commands, []);
  cases.push('open-profile-bypass-rejected');

  for (const [kind, change] of [['triangle', 'replace'], ['circle', 'dimension'], ['cut', 'constraint']]) {
    await setup(kind); await ready(kind);
    const stale = await page.evaluate(change => profileHarness.invalidate(change), change);
    assert.equal(stale.active, null, 'stale begin must not start an operation');
    assert.equal(stale.features, kind === 'cut' ? 1 : 0, 'stale commit must not create a feature');
    assert.equal(stale.commands.some(id => id.startsWith('feature.')), false);
    assert.match(stale.notice, /Проверка/);
    await page.evaluate(() => profileHarness.resume());
    if (change === 'constraint') {
      await page.waitForFunction(() => {
        const s = profileHarness.state(); return !s.cut && s.cutReason && !s.cutReason.includes('Проверка');
      });
      const invalid = await state();
      assert.equal(invalid.cutReason, invalid.catalogCutReason);
    } else await ready(kind);
    cases.push(change + '-invalidates-stale-controller');
  }

  await setup('circle'); await ready('circle');
  await page.waitForFunction(() => profileHarness.state().overlayStatus === 'solved');
  await page.locator('#overlay').click();
  await page.waitForFunction(() => document.querySelector('#overlay-mounted').textContent === 'false');
  await page.evaluate(() => profileHarness.editDiameter()); await ready('circle');
  await page.locator('#overlay').click();
  await page.waitForFunction(() => profileHarness.state().overlayStatus === 'solved');
  cases.push('overlay-unmount-preserves-shared-solver');
  assert.deepEqual(errors, []);
  assert.equal(cases.length, 7);
} finally {
  try { await page?.evaluate(() => globalThis.profileHarness?.close()); }
  finally {
    try { await context?.close(); }
    finally {
      try { await browser?.close(); }
      finally {
        if (server.listening) await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
        });
      }
    }
  }
}
assert.equal(server.listening, false); assert.equal(browser.isConnected(), false);
console.log(JSON.stringify({ status: 'PASS', cases, errors, ownedServerClosed: true, ownedBrowserClosed: true }));
