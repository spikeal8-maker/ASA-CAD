import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import esbuild from '../../vendor/toubkal/node_modules/esbuild/lib/main.js';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const bundled = await esbuild.build({
  entryPoints: [path.join(repo, 'tests/m2/fixed-constraint-ui-fixture.tsx')],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  outdir: path.join(repo, 'unused-memory-output'), assetNames: '[name]-[hash]',
  nodePaths: [path.join(repo, 'vendor/toubkal/node_modules')],
  loader: { '.wasm': 'file' }, external: ['fs', 'path', 'url', 'module'],
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
}).finally(() => esbuild.stop());
const assets = new Map(bundled.outputFiles.map(file => ['/' + path.basename(file.path), file.contents]));
const script = [...assets.keys()].find(name => name.endsWith('.js'));
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const asset = assets.get(request.url);
  response.setHeader('Content-Type', asset ? request.url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' : 'text/html');
  response.end(asset ?? '<!doctype html><div id="root"></div><script src="' + script + '"></script>');
});
let browser, context, page, clientCleanup, port;
const errors = [], cases = [];
let observation;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  port = server.address().port;
  assert.ok(![8094, 8098, 8099].includes(port));
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    ...(process.env.ASA_CAD_BROWSER_EXECUTABLE ? { executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE } : {}),
  });
  context = await browser.newContext(); page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + port, { waitUntil: 'load', timeout: 15000 });
  const state = () => page.evaluate(() => fixedConstraintHarness.state());
  const ready = () => page.waitForFunction(() => fixedConstraintHarness.state().ready, null, { timeout: 15000 });
  const fixedCommands = value => value.commands.filter(item => item.command.id === 'constraint.fixed');
  const fixedCount = value => JSON.parse(value.instances[0].dto).constraints.filter(item => item.type === 'fixed').length;
  const nativeSolve = value => {
    assert.equal(value.ok, true); assert.equal(value.converged, true);
    assert.equal(Number.isFinite(value.dof), true, 'expected actual native DoF');
  };
  const check = async (name, run) => {
    observation = null;
    try { await run(); cases.push({ name, status: 'PASS', observation }); }
    catch (error) { cases.push({ name, status: 'FAIL', error: error.message, observation }); }
  };
  const held = async (change, fail = false, requests = 1, strict = false) => {
    await page.evaluate(strict => fixedConstraintHarness.setup({ strict }), strict); await ready();
    const initial = await state();
    await page.evaluate(() => fixedConstraintHarness.hold());
    for (let i = 0; i < requests; i++) await page.locator('#fixed').click();
    await page.waitForFunction(count => fixedConstraintHarness.state().observed.initCalls === count, requests);
    assert.equal(fixedCommands(await state()).length, 0, 'no command before solver init settles');
    if (change) {
      await page.evaluate(value => fixedConstraintHarness.change(value), change);
      if (change !== 'unmount') await ready();
    }
    const before = await state();
    assert.equal(before.observed.initCompleted, 0, 'the outer init boundary must still be pending');
    assert.deepEqual(before.returned, Array(requests).fill(null));
    await page.evaluate(value => fixedConstraintHarness.resume(value), fail);
    const after = await page.evaluate(() => fixedConstraintHarness.settle());
    observation = {
      pendingInit: { calls: before.observed.initCalls, completed: before.observed.initCompleted, returned: before.returned },
      returned: after.returned, commands: after.commands.map(item => item.command.id),
      notices: after.notices, solves: after.observed.solves, fixedCount: fixedCount(after),
      documentsUnchanged: after.instances.every((item, i) => item.dto === before.instances[i]?.dto),
      historyUnchanged: after.instances.every((item, i) => JSON.stringify(item.application) === JSON.stringify(before.instances[i]?.application)),
    };
    assert.deepEqual(after.thrown, [], 'hook action must settle without an uncaught rejection');
    return { initial, before, after };
  };
  const cancelled = (before, after) => {
    assert.deepEqual(after.returned, [false]);
    assert.deepEqual(after.instances, before.instances, 'stale operation must preserve document/history/dirty state');
    assert.equal(fixedCommands(after).length, 0, 'stale operation must not submit constraint.fixed');
    assert.deepEqual(after.notices, before.notices, 'stale operation must not replace the current notice');
    assert.equal(after.observed.solves.length, 0, 'cancel before using stale solver input');
  };

  await check('current-success-one-command-and-undo', async () => {
    const { initial, after } = await held();
    assert.deepEqual(after.returned, [true]); assert.equal(fixedCommands(after).length, 1);
    assert.equal(fixedCount(after), 1); assert.deepEqual(after.notices, ['Отрезок зафиксирован']);
    assert.equal(after.observed.solves.length, 1); nativeSolve(after.observed.solves[0]);
    assert.equal(after.instances[0].application.dirty, true); assert.equal(after.instances[0].application.canUndo, true);
    const undone = await page.evaluate(() => fixedConstraintHarness.undo());
    assert.equal(undone.instances[0].dto, initial.instances[0].dto, 'one Undo must restore the complete initial document');
  });
  for (const change of ['replace', 'edit', 'selection', 'sketch', 'cancel', 'app', 'unmount']) {
    await check(change + '-during-init', async () => {
      const { initial, before, after } = await held(change);
      if (change === 'replace') {
        const old = JSON.parse(initial.instances[0].dto), next = JSON.parse(before.instances[0].dto);
        assert.equal(next.documentId, old.documentId);
        assert.equal(next.sketches[0].id, old.sketches[0].id);
        assert.equal(next.sketches[0].entities[0].id, old.sketches[0].entities[0].id);
        assert.notDeepEqual(next.sketches[0].entities[0].data, old.sketches[0].entities[0].data);
      }
      cancelled(before, after);
    });
  }
  for (const change of ['replace', 'unmount']) {
    await check(change + '-with-late-init-error', async () => {
      const { before, after } = await held(change, true); cancelled(before, after);
    });
  }
  await check('current-init-error-remains-visible', async () => {
    const { before, after } = await held(undefined, true);
    assert.deepEqual(after.returned, [false]); assert.deepEqual(after.instances, before.instances);
    assert.deepEqual(after.notices, ['Controlled solver initialization failure']);
    assert.equal(fixedCommands(after).length, 0); assert.equal(after.observed.solves.length, 0);
  });
  await check('solver-input-is-a-detached-intent-snapshot', async () => {
    const { after } = await held();
    assert.deepEqual(after.returned, [true]); nativeSolve(after.observed.solves[0]);
    assert.equal(after.observed.solves[0].detached, true, 'solver must not receive the mutable application document');
  });
  await check('newer-fixed-request-supersedes-pending-request', async () => {
    const { after } = await held(undefined, false, 2);
    assert.deepEqual(after.returned, [false, true]);
    assert.equal(fixedCommands(after).length, 1); assert.equal(fixedCount(after), 1);
    assert.equal(after.observed.solves.length, 1); assert.deepEqual(after.notices, ['Отрезок зафиксирован']);
  });
  await check('non-owning-client-shares-backend-and-survives-unmount', async () => {
    const { after } = await held(); assert.deepEqual(after.returned, [true]);
    const lifecycle = await page.evaluate(() => fixedConstraintHarness.clientAfterUnmount());
    observation.lifecycle = lifecycle;
    assert.equal(lifecycle.hookUsedShared, true, 'Fixed must reuse the browser coordinator');
    assert.equal(lifecycle.mounted, false); assert.equal(lifecycle.sharedDisposals, 0);
    assert.equal(lifecycle.intentUnchanged, true); nativeSolve(lifecycle.first); nativeSolve(lifecycle.second);
  });
  await check('development-strict-mode-replays-effects-safely', async () => {
    const { after } = await held(undefined, false, 1, true);
    assert.ok(after.effectSetups >= 2); assert.ok(after.effectCleanups >= 1);
    assert.equal(after.mounted, true); assert.equal(after.sharedDisposals, 0);
    assert.deepEqual(after.returned, [true]); assert.equal(fixedCommands(after).length, 1);
    assert.deepEqual(after.notices, ['Отрезок зафиксирован']);
  });
  await check('late-command-result-cannot-notify-a-same-id-replacement', async () => {
    await page.evaluate(() => fixedConstraintHarness.setup()); await ready();
    await page.evaluate(() => fixedConstraintHarness.holdCommit());
    await page.locator('#fixed').click();
    await page.waitForFunction(() => fixedConstraintHarness.state().commitResults === 1);
    const accepted = await state();
    assert.equal(fixedCount(accepted), 1); assert.equal(accepted.instances[0].application.canUndo, true);
    assert.deepEqual(accepted.returned, [null]); assert.deepEqual(accepted.notices, []);
    await page.evaluate(() => fixedConstraintHarness.change('replace')); await ready();
    const before = await state();
    await page.evaluate(() => fixedConstraintHarness.resumeCommit());
    const after = await page.evaluate(() => fixedConstraintHarness.settle());
    observation = { acceptedFixed: fixedCount(accepted), returned: after.returned, notices: after.notices };
    assert.deepEqual(after.returned, [false]); assert.deepEqual(after.instances, before.instances);
    assert.deepEqual(after.notices, before.notices); assert.equal(fixedCommands(after).length, 1);
    assert.equal(fixedCount(after), 0, 'the replacement must not inherit the prior accepted Fixed');
  });
  await check('current-command-error-remains-visible-after-rollback-clone', async () => {
    await page.evaluate(() => fixedConstraintHarness.setup({ fixed: true })); await ready();
    await page.evaluate(() => { fixedConstraintHarness.hold(); fixedConstraintHarness.start(); });
    await page.waitForFunction(() => fixedConstraintHarness.state().observed.initCalls === 1);
    const before = await state();
    await page.evaluate(() => fixedConstraintHarness.resume());
    const after = await page.evaluate(() => fixedConstraintHarness.settle());
    observation = { returned: after.returned, notices: after.notices };
    assert.deepEqual(after.returned, [false]); assert.deepEqual(after.instances, before.instances);
    assert.equal(after.notices.length, 1); assert.match(after.notices[0], /Fixed constraint already exists/);
    assert.equal(fixedCommands(after).length, 1);
  });
} finally {
  try { clientCleanup = await page?.evaluate(() => globalThis.fixedConstraintHarness?.close()); }
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
const failed = cases.filter(item => item.status !== 'PASS');
const report = {
  status: failed.length || errors.length ? 'FAIL' : 'PASS', cases, errors, port, clientCleanup,
  ownedServerClosed: !server.listening, ownedBrowserClosed: !browser.isConnected(),
};
console.log(JSON.stringify(report));
assert.equal(cases.length, 17); assert.deepEqual(errors, []);
assert.equal(server.listening, false); assert.equal(browser.isConnected(), false);
assert.equal(clientCleanup.mounted, false); assert.equal(clientCleanup.pendingSettled, true);
assert.equal(failed.length, 0, failed.map(item => item.name + ': ' + item.error).join('\n'));
