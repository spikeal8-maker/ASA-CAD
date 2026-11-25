import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../../vendor/toubkal/node_modules/esbuild/lib/main.js';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const repo = fileURLToPath(new URL('../..', import.meta.url));
// Controlled ownership fixture, separate from the ordinary /cad UI acceptance suite.
// It imports the actual hook and application. Only the command RETURN is delayed.
const bundle = await esbuild.build({ entryPoints: [path.join(repo, 'tests/m3/ArcNumericOwnershipFixture.mjs')],
  bundle: true, write: false, platform: 'browser', format: 'iife',
  nodePaths: [path.join(repo, 'vendor/toubkal/node_modules')],
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
}).finally(() => esbuild.stop());
assert.equal(bundle.outputFiles.length, 1);
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/fixture.js' ? bundle.outputFiles[0].contents
    : '<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
});
const report = { suite: 'Actual Arc hook / CadApplication delayed-return ownership',
  scope: 'Isolated Sketch-only fixture; native solver and ordinary-user proof are separate', cases: [], errors: [] };
let browser, context, page;
const arcCount = (s) => JSON.parse(s.dto).sketches[0].entities.length;
async function check(id, body) {
  const r = { id, status: 'FAIL' }; report.cases.push(r);
  try { await body(r); r.status = 'PASS'; }
  catch (error) { r.error = String(error.stack ?? error); }
}
async function empty() {
  const initial = await page.evaluate(() => arcOwnership.setup());
  await page.waitForFunction(() => arcOwnership.state().mounted && arcOwnership.state().renders > 0);
  return initial;
}
async function prepared() {
  const initial = await empty();
  await page.evaluate(() => arcOwnership.point([0, 0]));
  await page.waitForFunction(() => !!arcOwnership.state().draft.center);
  await page.evaluate(() => arcOwnership.point([20, 0]));
  await page.waitForFunction(() => !!arcOwnership.state().draft.start);
  await page.evaluate(() => arcOwnership.move([0, 20]));
  await page.waitForFunction(() => {
    const end = arcOwnership.state().draft.end;
    return end && Math.abs(end[0]) < 1e-8 && Math.abs(end[1] - 20) < 1e-8;
  });
  return initial;
}
async function settled() {
  await page.evaluate(() => arcOwnership.release());
  await page.waitForFunction(() => !arcOwnership.state().committing);
  return page.evaluate(() => arcOwnership.state());
}
async function held(repeat = 1) {
  const initial = await prepared();
  await page.evaluate(n => { arcOwnership.hold(); arcOwnership.begin(n); }, repeat);
  await page.waitForFunction(() => arcOwnership.state().accepted === 1);
  const accepted = await page.evaluate(() => arcOwnership.state());
  assert.equal(arcCount(accepted), 1, 'Actual command must mutate before the held return');
  assert.equal(accepted.application.canUndo, true); assert.equal(accepted.commits, 0);
  assert.equal(accepted.commands.length, 1); assert.equal(accepted.commands[0].id, 'sketch.arc');
  return { initial, accepted };
}
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  report.port = server.address().port; assert.ok(![8094, 8098, 8099].includes(report.port));
  browser = await chromium.launch({ headless: true }); report.browser = browser.version();
  context = await browser.newContext(); page = await context.newPage(); page.setDefaultTimeout(15_000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:' + report.port, { waitUntil: 'load' });
  await check('current-return-one-command', async r => {
    const { initial, accepted } = await held(2); r.accepted = accepted;
    await page.evaluate(() => arcOwnership.release());
    await page.waitForFunction(() => !arcOwnership.state().committing && !arcOwnership.state().draft.center);
    const after = await page.evaluate(() => arcOwnership.state());
    assert.deepEqual(after.returned, [true, false]); assert.equal(after.commits, 1);
    assert.equal(arcCount(after), 1); assert.equal(after.commands.length, 1); assert.deepEqual(after.errors, []);
    await page.evaluate(() => arcOwnership.change('undo'));
    assert.equal((await page.evaluate(() => arcOwnership.state())).dto, initial, 'One real Undo restores initial intent');
    r.after = after;
  });
  for (const change of ['undo', 'replace']) await check(change + '-before-late-return', async r => {
    const { initial, accepted } = await held(); r.accepted = accepted;
    const previousRender = await page.evaluate(kind => arcOwnership.change(kind), change);
    await page.waitForFunction(n => arcOwnership.state().renders > n, previousRender);
    const before = await page.evaluate(() => arcOwnership.state());
    assert.equal(arcCount(before), 0);
    if (change === 'replace') {
      const a = JSON.parse(initial), b = JSON.parse(before.dto);
      assert.equal(b.documentId, a.documentId); assert.equal(b.sketches[0].id, a.sketches[0].id);
    }
    await page.evaluate(() => arcOwnership.release());
    await page.waitForFunction(() => !arcOwnership.state().committing);
    const after = await page.evaluate(() => arcOwnership.state());
    assert.deepEqual(after.returned, [false]); assert.equal(after.commits, 0); assert.deepEqual(after.errors, []);
    assert.equal(after.dto, before.dto); assert.deepEqual(after.application, before.application);
    assert.deepEqual(after.notices, before.notices); assert.equal(after.commands.length, 1);
    assert.deepEqual(after.draft, before.draft, 'Late result must not overwrite the current draft');
    r.beforeLateReturn = before; r.after = after;
  });
  for (const kind of ['replace', 'in-place']) await check(kind + '-before-submit', async r => {
    const initial = JSON.parse(await prepared());
    const result = await page.evaluate(kind => arcOwnership.preSubmit(kind), kind), s = result.state;
    assert.equal(s.dto, result.expected); assert.equal(arcCount(s), 0); assert.equal(s.application.canUndo, false);
    assert.deepEqual(s.returned, [false]); assert.deepEqual(s.commands, []); assert.equal(s.commits, 0);
    const current = JSON.parse(s.dto);
    assert.equal(current.documentId, initial.documentId); assert.equal(current.sketches[0].id, initial.sketches[0].id);
    r.injection = kind === 'replace' ? 'actual replaceDocument, submit before await' : 'live Sketch.name mutation without emit';
    r.after = s;
  });
  await check('reset-invalidates-return-and-preserves-flight', async r => {
    const { accepted } = await held();
    await page.evaluate(async () => { arcOwnership.reset(); await arcOwnership.point([10, 10]); arcOwnership.begin(); });
    await page.waitForFunction(() => !arcOwnership.state().draft.center);
    const reset = await page.evaluate(() => arcOwnership.state());
    assert.deepEqual(reset.returned, [null, false]); assert.equal(reset.commands.length, 1);
    const after = await settled();
    assert.deepEqual(after.returned, [false, false]); assert.equal(after.commits, 0);
    assert.equal(after.dto, accepted.dto); assert.deepEqual(after.notices, accepted.notices);
    await page.evaluate(() => arcOwnership.point([10, 10]));
    await page.waitForFunction(() => !!arcOwnership.state().draft.center);
    await page.evaluate(() => arcOwnership.point([30, 10]));
    await page.waitForFunction(() => !!arcOwnership.state().draft.start);
    await page.evaluate(() => arcOwnership.move([10, 30]));
    await page.waitForFunction(() => arcOwnership.state().input.canCommit);
    await page.evaluate(() => arcOwnership.begin()); const resumed = await settled();
    assert.deepEqual(resumed.returned, [false, false, true]); assert.equal(resumed.commits, 1);
    assert.equal(arcCount(resumed), 2); assert.equal(resumed.commands.length, 2);
    r.reset = reset; r.staleReturn = after; r.resumed = resumed;
  });
  await check('unmount-before-late-return', async r => {
    const { accepted } = await held(); await page.evaluate(() => arcOwnership.unmount());
    const after = await page.evaluate(() => arcOwnership.release());
    assert.equal(after.mounted, false); assert.deepEqual(after.returned, [false]); assert.equal(after.commits, 0);
    assert.equal(after.dto, accepted.dto); assert.deepEqual(after.application, accepted.application);
    assert.deepEqual(after.notices, accepted.notices); r.after = after;
  });
  await check('actual-command-rollback-clone-and-retry', async r => {
    const initial = await prepared();
    await page.evaluate(() => { arcOwnership.failNext(); arcOwnership.begin(); }); const failed = await settled();
    assert.equal(failed.fault.rollbackCloneObserved, true); assert.ok(failed.fault.error);
    assert.equal(failed.notices.at(-1), failed.fault.error, 'Current actual command failure must remain visible');
    assert.deepEqual(failed.returned, [false]); assert.equal(failed.commits, 0); assert.equal(failed.dto, initial);
    assert.equal(failed.application.canUndo, false);
    await page.evaluate(() => arcOwnership.begin()); const retried = await settled();
    assert.deepEqual(retried.returned, [false, true]); assert.equal(arcCount(retried), 1); assert.equal(retried.commits, 1);
    assert.equal(retried.commands.length, 2);
    await page.evaluate(() => arcOwnership.change('undo'));
    assert.equal((await page.evaluate(() => arcOwnership.state())).dto, initial);
    r.injectedFailure = failed; r.validRetry = retried;
  });
  await check('explicit-pointer-replaces-invalid-xy-but-not-radius', async r => {
    const initial = await empty(); await page.evaluate(() => arcOwnership.point([0, 0]));
    await page.waitForFunction(() => arcOwnership.state().input.phase === 'awaiting-start');
    await page.evaluate(() => arcOwnership.edit('radius', '0'));
    assert.equal(await page.evaluate(() => arcOwnership.enter('radius')), false);
    await page.evaluate(() => arcOwnership.point([20, 0]));
    await page.evaluate(() => arcOwnership.move([20, 0]));
    await page.waitForFunction(() => arcOwnership.state().input.fields.radius.invalid);
    const invalidRadius = await page.evaluate(() => arcOwnership.state());
    assert.equal(invalidRadius.draft.start, null); assert.equal(invalidRadius.commands.length, 0);
    await page.evaluate(() => { arcOwnership.edit('radius', '20'); arcOwnership.edit('x', '-'); });
    assert.equal(await page.evaluate(() => arcOwnership.enter('x')), false);
    // No intervening move: the explicit pick itself must replace invalid XY.
    await page.evaluate(() => arcOwnership.point([20, 0]));
    await page.waitForFunction(() => arcOwnership.state().input.phase === 'awaiting-end');
    await page.evaluate(() => arcOwnership.edit('y', '-'));
    assert.equal(await page.evaluate(() => arcOwnership.enter('y')), false);
    await page.evaluate(() => arcOwnership.move([0, 20]));
    await page.waitForFunction(() => arcOwnership.state().input.canCommit);
    await page.evaluate(() => arcOwnership.begin()); const after = await settled();
    assert.equal(arcCount(after), 1); assert.equal(after.commands.length, 1); assert.equal(after.commits, 1);
    await page.evaluate(() => arcOwnership.change('undo'));
    assert.equal((await page.evaluate(() => arcOwnership.state())).dto, initial, 'Rejected input must add no history');
    r.invalidRadius = invalidRadius; r.after = after;
  });
} catch (error) { report.error = String(error.stack ?? error); }
finally {
  try { report.clientCleanup = await page?.evaluate(() => globalThis.arcOwnership?.close()); }
  finally {
    try { await context?.close(); } finally {
      try { await browser?.close(); } finally {
        if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      }
    }
  }
  report.serverClosed = !server.listening; report.browserClosed = !browser?.isConnected();
  report.status = !report.error && report.cases.length === 9 && report.cases.every(c => c.status === 'PASS')
    && !report.errors.length && report.clientCleanup?.pendingSettled && !report.clientCleanup.mounted ? 'PASS' : 'FAIL';
  const out = process.env.ASA_U2_ARC_EVIDENCE_DIR;
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'arc-ownership-checks.json'), JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify(report, null, 2));
}
assert.equal(report.status, 'PASS', 'Arc delayed-return ownership failed');
