import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { geometry, near, quick, save, solved, stage, tool } from './live-sketch-actions-harness.mjs';

// FUSION-SKETCH-TOOLS-BEHAVIOR-003. Run after building the candidate.
// This file always owns a port-0 server and fresh browser contexts. ASA_FUSION_URL
// is intentionally unused: installed listeners 8094/8098/8099 are never targets.
// All input uses public pointer/keyboard/ribbon controls. evaluate() only reads
// rendered DOM, resource observations, or storage written by the public Save UI.
// No fixtures, injected commands, document writes, or storage writes are used.
const file = fileURLToPath(import.meta.url);
const repo = resolve(dirname(file), '../../..');
const appRoot = resolve(process.env.ASA_FUSION_LINE_APP_ROOT || resolve(repo, 'dist/fusion-live'));
const out = resolve(process.env.ASA_FUSION_EVIDENCE_DIR || resolve(repo, 'prototypes/fusion/evidence'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const forbiddenPorts = new Set([8094, 8098, 8099]);
const viewport = { width: 2048, height: 1137 };
const overlay = page => page.locator('[data-testid="cad-sketch-overlay"]');
const interaction = page => page.locator('[data-testid="cad-sketch-interaction"][data-tool="line"]');
const fields = page => page.locator('[data-testid="fusion-line-dynamic-input"]');
const lengthInput = page => page.locator('[data-testid="fusion-line-length-input"]');
const angleInput = page => page.locator('[data-testid="fusion-line-angle-input"]');
const chainPoints = [[-32, -20], [-16, -8], [0, 16], [20, 4], [36, 24]];
const report = {
  schemaVersion: 1, behaviorRevision: 'FUSION-SKETCH-TOOLS-BEHAVIOR-003',
  status: 'RUNNING', startedUTC: new Date().toISOString(),
  input: 'Public UI only; solved SVG and public Save document reads',
  installedOriginsTouched: false, userProfileUsed: false,
  visualParityAccepted: false, behaviorParityAccepted: false,
  viewport: { ...viewport, dpr: 1 }, cases: [], screenshots: [],
  pageErrors: [], requestFailures: [], cleanupErrors: [], ownedServers: [],
  nativeLifecycle: {
    source: 'Parent-observed installed Fusion 2706.1.17, captures 11-44',
    pointerCommit: 'continue chain with Line active',
    numericEnter: 'commit segment and exit Line',
    finishChainCheck: 'finish chain with Line active awaiting first point',
    escapePreview: 'exit Line, retain committed geometry',
    escapeAwaitingFirst: 'exit Line',
    closure: 'finish chain with Line active awaiting first point',
    doubleClick: 'commit exactly one segment and finish chain with Line active awaiting first point',
    plainEnter: 'commit preview and exit Line',
    reselectActiveLine: 'preserve the current chain',
    escapeMarkingMenu: 'close the menu only and preserve the active Line preview',
    repeatContextLine: 'finish the current chain with Line active awaiting first point',
  },
  knownBlockers: [
    { id: 'B.absolute-driving-angle', status: 'BLOCKED',
      reason: 'Shared angular dimension requires two distinct entities; absolute Line orientation is absent from the frozen common contract. Coordinates are not a driving angular constraint.' },
    { id: 'E.atomic-segment-and-inference-undo', status: 'BLOCKED',
      reason: 'Existing Line and coincident commands execute separately. Extending atomic creationIntent is frozen; single-Line stable-ID history does not prove atomic segment-plus-constraints Undo.' },
    { id: 'I.full-compatibility', status: 'NOT_RUN_IN_FOCUSED_TEST',
      reason: 'Existing Sketch actions/dimensions/workspace and protected Part regression gates must run separately against the final candidate.' },
  ],
};
let browser = null, currentPage = null, phase = 'preflight', server = null;
const ownedServers = [];

function bounded(promise, milliseconds, label, onTimeout) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (onTimeout) Promise.resolve(onTimeout()).catch(() => {});
      reject(new Error(label + ' timed out after ' + milliseconds + ' ms'));
    }, milliseconds);
  })]).finally(() => clearTimeout(timer));
}

async function startServer() {
  await readFile(resolve(appRoot, 'index.html'));
  const child = spawn(process.execPath,
    [resolve(repo, 'prototypes/fusion/live/serve.cjs'), '--root', appRoot, '--port', '0'],
    { cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const value = { child, log: '', proof: { pid: child.pid, requestedPort: 0, appRoot } };
  ownedServers.push(value); report.ownedServers.push(value.proof);
  const url = await bounded(new Promise((done, reject) => {
    const onExit = (code, signal) => reject(new Error('Owned server exited before listening: ' + code + '/' + signal + ' ' + value.log));
    child.once('error', reject); child.once('exit', onExit);
    child.stderr.on('data', bytes => { value.log = (value.log + bytes).slice(-12000); });
    child.stdout.on('data', bytes => {
      value.log = (value.log + bytes).slice(-12000);
      const match = value.log.match(/ASA CAD Fusion: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) { child.removeListener('exit', onExit); done(new URL(match[1])); }
    });
  }), 15000, 'Owned port-0 server startup', () => child.kill('SIGTERM'));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(forbiddenPorts.has(Number(url.port)), false, 'An installed/reserved port must never be used');
  Object.assign(value.proof, { port: Number(url.port), origin: url.origin, startedUTC: new Date().toISOString() });
  value.url = url.href;
  return value;
}

async function stopServer(value) {
  if (value.child.exitCode !== null || value.child.signalCode !== null) return;
  await new Promise((done, reject) => {
    let force;
    const deadline = setTimeout(() => {
      clearTimeout(force); reject(new Error('Owned server did not exit: ' + value.child.pid));
    }, 7000);
    value.child.once('exit', () => { clearTimeout(force); clearTimeout(deadline); done(); });
    force = setTimeout(() => value.child.kill('SIGKILL'), 3000);
    value.child.kill('SIGTERM');
  });
  value.proof.stoppedUTC = new Date().toISOString();
}

async function screenshot(page, name) {
  const filename = 'fusion-live-line-behavior-' + name + '.png';
  const bytes = await page.screenshot({ path: resolve(out, filename), timeout: 10000 });
  report.screenshots.push({ file: filename, sha256: sha256(bytes), viewport: page.viewportSize() });
}

async function newSketch(context) {
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => report.pageErrors.push({ phase, message: error.message }));
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText || '';
    if (!error.includes('ERR_ABORTED')) report.requestFailures.push({ phase, url: request.url(), error });
  });
  await page.goto(server.url);
  await tool(page, 'part.sketch.create').click();
  await page.getByLabel('Плоскость эскиза', { exact: true }).selectOption('XY');
  await page.locator('.live-commit').click();
  await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
  await solved(page, 0);
  // Normal snapping is required for chain topology; the old harness disables it.
  await page.locator('[data-sketch-option="snap"]').check();
  return page;
}

async function activeState(page) {
  const layer = interaction(page);
  return {
    command: await page.locator('.live-workarea').getAttribute('data-active-command'),
    phase: await layer.count() ? await layer.getAttribute('data-line-phase') : null,
  };
}

async function waitIdle(page) {
  await page.waitForFunction(() => document.querySelector('.live-workarea')?.getAttribute('data-active-command') === '');
}

async function waitLine(page, linePhase) {
  await page.waitForFunction(expected => {
    const work = document.querySelector('.live-workarea');
    const layer = document.querySelector('[data-testid="cad-sketch-interaction"][data-tool="line"]');
    return work?.getAttribute('data-active-command') === 'sketch.line'
      && layer?.getAttribute('data-line-phase') === expected;
  }, linePhase);
}

async function startLine(page, keyboard = false) {
  if (keyboard) {
    const box = await stage(page).boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + 70, box.y + 70);
    await page.keyboard.press('l');
  } else await tool(page, 'sketch.line').click();
  await waitLine(page, 'awaiting-start');
  if (Number(await overlay(page).getAttribute('data-entity-count')) > 0) {
    await page.waitForFunction(() => document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-line-solver-ready') === 'true');
  }
}

async function worldPoint(page, point) {
  const svg = interaction(page);
  await svg.waitFor();
  const box = await svg.boundingBox();
  const frame = (await svg.getAttribute('viewBox')).trim().split(/\s+/).map(Number);
  assert.ok(box && frame.length === 4 && frame.every(Number.isFinite), 'Visible Line field and viewBox');
  const scale = Math.min(box.width / frame[2], box.height / frame[3]);
  return {
    x: box.x + (box.width - frame[2] * scale) / 2 + (point[0] - frame[0]) * scale,
    y: box.y + (box.height - frame[3] * scale) / 2 + (-point[1] - frame[1]) * scale,
  };
}

async function pointerWorld(page, point, action = 'click') {
  const pixel = await worldPoint(page, point);
  assert.equal(await page.evaluate(({ x, y }) =>
    !!document.elementFromPoint(x, y)?.closest('[data-testid="part-model-stage"]'), pixel), true,
  'Pointer target belongs to the visible Sketch field');
  if (action === 'move') await page.mouse.move(pixel.x, pixel.y);
  else if (action === 'double') await page.mouse.dblclick(pixel.x, pixel.y);
  else await page.mouse.click(pixel.x, pixel.y);
}

async function entityIds(page) {
  return overlay(page).locator('[data-sketch-entity-id]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-sketch-entity-id')));
}

async function waitCommit(page, count, continued = true) {
  await solved(page, count);
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="fusion-line-dynamic-input"]');
    return !node || node.getAttribute('data-line-committing') === 'false';
  });
  const ids = await entityIds(page);
  assert.equal(ids.length, count);
  assert.equal(new Set(ids).size, count, 'Real entity IDs are unique');
  if (continued) {
    await waitLine(page, 'anchored');
    await page.waitForFunction(id => {
      const root = document.querySelector('[data-testid="cad-sketch-overlay"]');
      const line = root?.querySelector('[data-sketch-entity-id="' + id + '"]');
      const anchor = document.querySelector('[data-testid="sketch-line-anchor"]');
      return line && anchor
        && Math.abs(Number(line.getAttribute('x2')) - Number(anchor.getAttribute('cx'))) < 1e-4
        && Math.abs(Number(line.getAttribute('y2')) - Number(anchor.getAttribute('cy'))) < 1e-4;
    }, ids.at(-1));
  }
  return ids;
}

async function ghost(page) {
  return page.locator('[data-testid="sketch-line-ghost"]').evaluate(node => [
    Number(node.getAttribute('x1')), -Number(node.getAttribute('y1')),
    Number(node.getAttribute('x2')), -Number(node.getAttribute('y2')),
  ]);
}

async function realLines(page, ids) {
  return (await geometry(page, ids)).map(line => {
    assert.equal(line.length, 4, 'A real solved SVG Line is required');
    return [line[0], -line[1], line[2], -line[3]];
  });
}

async function assertGeometry(page, ids, expected) {
  await page.waitForFunction(({ ids, expected }) => {
    const root = document.querySelector('[data-testid="cad-sketch-overlay"]');
    if (root?.getAttribute('data-overlay-source') !== 'solver-preview') return false;
    return ids.every((id, index) => {
      const line = root.querySelector('[data-sketch-entity-id="' + id + '"]');
      if (!(line instanceof SVGLineElement)) return false;
      const values = ['x1', 'y1', 'x2', 'y2'].map(name => Number(line.getAttribute(name)));
      values[1] = -values[1]; values[3] = -values[3];
      return values.every((value, i) => Math.abs(value - expected[index][i]) < 0.02);
    });
  }, { ids, expected });
  return realLines(page, ids);
}

function documentLines(doc, ids) {
  assert.equal(doc.sketches.length, 1, 'One real Sketch');
  assert.equal(doc.sketches[0].entities.length, ids.length, 'No fake helpers or extra model entities');
  const lines = ids.map(id => doc.sketches[0].entities.find(entity => entity.id === id));
  for (const line of lines) assert.equal(line?.type, 'line');
  assert.equal(new Set(lines.map(line => line.id)).size, ids.length);
  const allIds = new Set(doc.sketches[0].entities.map(entity => entity.id));
  for (const intent of [...doc.constraints, ...doc.dimensions]) {
    for (const id of intent.entityIds) assert.ok(allIds.has(id), 'No dangling constraint/dimension entity: ' + id);
  }
  return lines;
}

function orientationConstraints(doc, expected) {
  const constraints = doc.constraints.filter(value => value.type === 'horizontal' || value.type === 'vertical');
  assert.equal(constraints.length, expected.length, 'Every expected H/V inference is a real persisted constraint');
  assert.equal(new Set(constraints.map(value => value.id)).size, constraints.length, 'H/V constraint IDs are unique');
  for (const [entityId, type] of expected) {
    const matches = constraints.filter(value => value.type === type
      && value.entityIds.length === 1 && value.entityIds[0] === entityId);
    assert.equal(matches.length, 1, 'Exactly one ' + type + ' constraint references ' + entityId);
    assert.ok(typeof matches[0].id === 'string' && matches[0].id.length > 0, 'H/V constraint has a real ID');
    assert.ok(doc.sketches[0].constraintIds.includes(matches[0].id), 'Sketch membership includes the H/V constraint ID');
  }
  return constraints;
}

function chainTopology(doc, ids, closed = false) {
  documentLines(doc, ids);
  const keys = ids.flatMap(id => [id + ':a', id + ':b']);
  const parent = new Map(keys.map(key => [key, key]));
  const root = key => {
    while (parent.get(key) !== key) key = parent.get(key);
    return key;
  };
  const joins = [];
  for (const constraint of doc.constraints.filter(value => value.type === 'coincident')) {
    const refs = constraint.data?.refs;
    assert.ok(Array.isArray(refs) && refs.length === 2, 'Actual coincident endpoint references are required');
    const pair = refs.map(ref => ref.entityId + ':' + ref.point);
    if (!pair.every(key => parent.has(key))) continue;
    parent.set(root(pair[1]), root(pair[0]));
    joins.push({ id: constraint.id, refs, pair });
  }
  const expectedJoins = ids.slice(1).map((id, i) => [ids[i] + ':b', id + ':a']);
  if (closed) expectedJoins.push([ids.at(-1) + ':b', ids[0] + ':a']);
  for (const expected of expectedJoins) {
    const matches = joins.filter(join => [...join.pair].sort().join('|') === [...expected].sort().join('|'));
    assert.equal(matches.length, 1, 'Exactly one real coincident intent for ' + expected.join(' -> '));
  }
  assert.equal(joins.length, expectedJoins.length, 'No duplicate or unrelated chain coincidence');
  const classes = new Set(keys.map(root)).size;
  assert.equal(classes, closed ? ids.length : ids.length + 1, 'Endpoint equivalence classes are the actual topological points');
  return { lines: ids.length, endpointSlots: keys.length, topologicalPoints: classes, joins };
}

async function solverTopology(page, ids, closed = false) {
  const lines = await realLines(page, ids);
  const residuals = lines.slice(1).map((line, index) =>
    Math.hypot(line[0] - lines[index][2], line[1] - lines[index][3]));
  if (closed) residuals.push(Math.hypot(lines.at(-1)[2] - lines[0][0], lines.at(-1)[3] - lines[0][1]));
  for (const value of residuals) near(value, 0, 'Solved coincident residual', 1e-4);
  for (const line of lines) assert.ok(Math.hypot(line[2] - line[0], line[3] - line[1]) > 1e-6, 'No zero-length line');
  return { geometry: lines, coincidentResiduals: residuals };
}

async function buildChain(page, points, closed = false, nativePair = false) {
  await startLine(page);
  await pointerWorld(page, points[0]);
  await waitLine(page, 'anchored');
  if (nativePair) await screenshot(page, 'native-pair-01-first-click');
  let ids = [];
  for (let index = 1; index < points.length; index++) {
    await pointerWorld(page, points[index], 'move');
    const preview = await ghost(page);
    near(preview[0], points[index - 1][0], 'Ghost starts at previous world endpoint X', 0.02);
    near(preview[1], points[index - 1][1], 'Ghost starts at previous world endpoint Y', 0.02);
    if (nativePair && index === 1) await screenshot(page, 'native-pair-02-first-preview');
    if (nativePair && index === 2) await screenshot(page, 'native-pair-06-next-preview');
    await pointerWorld(page, points[index]);
    const next = await waitCommit(page, index, !(closed && index === points.length - 1));
    assert.deepEqual(next.slice(0, ids.length), ids, 'Earlier segment IDs survive the next commit');
    ids = next;
    if (nativePair && index === 1) await screenshot(page, 'native-pair-05-first-commit');
    if (nativePair && index === 3) await screenshot(page, 'native-pair-07-third-commit');
  }
  return ids;
}

async function escapeLine(page) {
  await page.keyboard.press('Escape');
  await waitIdle(page);
  assert.equal(await interaction(page).count(), 0, 'Escape removes the active Line interaction');
}

async function finishChain(page) {
  await page.locator('[data-testid="fusion-line-finish-chain"]').click();
  await waitLine(page, 'awaiting-start');
  assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0);
  assert.equal(await page.locator('[data-testid="sketch-line-ghost"]').count(), 0);
}

async function publicOpen(page, count) {
  await page.reload();
  await quick(page, 'system.open').click();
  await page.waitForFunction(() => document.querySelector('.live-status')?.textContent?.includes('Локальный документ открыт'));
  await page.locator('[data-timeline-sketch]').first().click();
  await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
  await solved(page, count);
}

async function numericInput(page, length, angle, nativePairPrefix = null) {
  await interaction(page).focus();
  await page.keyboard.type(length);
  await lengthInput(page).waitFor({ state: 'visible' });
  assert.equal(await lengthInput(page).inputValue(), length, 'Typing from the field opens the actual numeric input');
  if (nativePairPrefix) await screenshot(page, nativePairPrefix + '-03-length-entered');
  await page.keyboard.press('Tab');
  assert.equal(await angleInput(page).evaluate(node => document.activeElement === node), true, 'Tab focuses the angle field');
  assert.equal(await fields(page).getAttribute('data-length-locked'), 'true', 'Tab locks length');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(angle);
  if (nativePairPrefix) await screenshot(page, nativePairPrefix + '-04-angle-entered');
}

async function numericGeometry(page, id, from, length, angle) {
  const radians = angle * Math.PI / 180;
  const expected = [[from[0], from[1], from[0] + length * Math.cos(radians), from[1] + length * Math.sin(radians)]];
  const [line] = await assertGeometry(page, [id], expected);
  near(Math.hypot(line[2] - line[0], line[3] - line[1]), length, 'Actual solved length', 1e-4);
  near(Math.atan2(line[3] - line[1], line[2] - line[0]) * 180 / Math.PI, angle, 'Actual solved coordinate angle', 1e-4);
  return line;
}

async function runCase(id, label, work, limit = 90000) {
  phase = id;
  const errorsBefore = report.pageErrors.length;
  const failuresBefore = report.requestFailures.length;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'ru-RU' });
  let page = null;
  try {
    const proof = await bounded((async () => {
      page = await newSketch(context);
      const value = await work(page);
      const wasm = await page.evaluate(() => performance.getEntriesByType('resource')
        .map(entry => entry.name).filter(name => /\.wasm(?:$|[?#])/.test(name)));
      assert.ok(wasm.some(name => /plane[-_]?gcs/i.test(name)), 'Real PlaneGCS WASM must be used');
      assert.equal(report.pageErrors.length, errorsBefore, 'No uncaught page error in ' + id);
      assert.equal(report.requestFailures.length, failuresBefore, 'No failed resource request in ' + id);
      return { ...value, wasm };
    })(), limit, 'Case ' + id, () => context.close());
    report.cases.push({ id, label, status: 'PASS', ...proof });
    console.log('PASS ' + id + ': ' + label);
  } catch (error) {
    report.cases.push({ id, label, status: 'FAIL', phase, error: error.message });
    if (page && !page.isClosed()) await screenshot(page, id.replaceAll('.', '-') + '-debug').catch(() => {});
    console.error('FAIL ' + id + ': ' + error.stack);
  } finally {
    await bounded(context.close(), 10000, 'Case context cleanup').catch(error => report.cleanupErrors.push(error.message));
    currentPage = null;
  }
}

try {
  await mkdir(out, { recursive: true });
  report.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', timeout: 10000 }).trim();
  report.testSourceSha256 = sha256(await readFile(file));
  report.helperSourceSha256 = sha256(await readFile(resolve(dirname(file), 'live-sketch-actions-harness.mjs')));
  report.lineToolSourceSha256 = sha256(await readFile(resolve(repo, 'prototypes/fusion/live/LiveSketchLineTool.ts')));
  report.sourceSnapshotSha256 = process.env.ASA_FUSION_SOURCE_SNAPSHOT || null;
  if (process.env.ASA_FUSION_SOURCE_SNAPSHOT_DESCRIPTOR) {
    report.sourceSnapshotDescriptor = JSON.parse(process.env.ASA_FUSION_SOURCE_SNAPSHOT_DESCRIPTOR);
    assert.equal(sha256(JSON.stringify(report.sourceSnapshotDescriptor)), report.sourceSnapshotSha256);
  }
  if (process.env.ASA_FUSION_LINE_NATIVE_CAPTURE) {
    const capture = resolve(process.env.ASA_FUSION_LINE_NATIVE_CAPTURE);
    const bytes = await readFile(capture);
    report.nativeCapture = { path: capture, sha256: sha256(bytes) };
  }
  server = await startServer(); report.origin = server.proof.origin;
  browser = await chromium.launch({ headless: true, executablePath: process.env.ASA_CAD_BROWSER_EXECUTABLE, timeout: 30000 });

  await runCase('A', 'Four continuous Line segments and five real topological points', async page => {
    const ids = await buildChain(page, chainPoints, false, true);
    await screenshot(page, 'A-four-segments-preview');
    const beforeFinish = await activeState(page);
    await finishChain(page);
    assert.deepEqual(await entityIds(page), ids, 'Finish chain does not add a fifth segment');
    const afterFinish = await activeState(page);
    await screenshot(page, 'native-pair-09-finish-chain');
    await escapeLine(page);
    await screenshot(page, 'native-pair-10-exit-line');
    const document = await save(page);
    const topology = chainTopology(document, ids);
    const solver = await solverTopology(page, ids);
    return { ids, topology, solver, beforeFinish, afterFinish, afterEscape: await activeState(page),
      documentSha256: sha256(JSON.stringify(document)) };
  });

  await runCase('B.numeric', 'Real keyboard 40 mm / 30 degrees; driving-angle acceptance remains BLOCKED', async page => {
    const from = [-20, -10];
    await startLine(page); await pointerWorld(page, from); await pointerWorld(page, [0, 5], 'move');
    await numericInput(page, '40', '30', 'native-pair');
    await screenshot(page, 'B-length40-angle30-entry');
    await page.keyboard.press('Enter');
    const ids = await waitCommit(page, 1, false); await waitIdle(page);
    const line = await numericGeometry(page, ids[0], from, 40, 30);
    const document = await save(page); documentLines(document, ids);
    const drivingLength = document.dimensions.filter(value =>
      value.type === 'linear' && value.driving === true && value.entityIds.length === 1
      && value.entityIds[0] === ids[0] && Math.abs(value.value - 40) < 1e-8);
    assert.equal(drivingLength.length, 1, '40 mm must be a real persisted driving length');
    await publicOpen(page, 1);
    assert.deepEqual(await entityIds(page), ids, 'Numeric segment ID survives public reload/Open');
    const reopened = await save(page);
    assert.deepEqual(reopened, document, 'Save/Open preserves the segment and its real driving-length intent');
    const reopenedDrivingLength = reopened.dimensions.find(value => value.id === drivingLength[0].id);
    assert.deepEqual(reopenedDrivingLength, drivingLength[0], 'Driving length ID, value, and entity refs survive reopening');
    const reopenedLine = await numericGeometry(page, ids[0], from, 40, 30);
    await screenshot(page, 'B-numeric-enter-exits');
    return { coordinateSubcheck: 'PASS', actualSolvedLine: line, ids, drivingLength,
      saveReloadOpen: true, reopenedDrivingLength, reopenedSolvedLine: reopenedLine,
      absoluteDrivingAngle: 'BLOCKED', acceptance: 'BLOCKED', exitState: await activeState(page) };
  });

  await runCase('C', 'Closed Line profile produces a real OCC 10 mm extrusion', async page => {
    const rectangle = [[-30, -20], [30, -20], [30, 20], [-30, 20], [-30, -20]];
    const ids = await buildChain(page, rectangle, true);
    await waitLine(page, 'awaiting-start');
    assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0);
    const closureState = await activeState(page);
    await screenshot(page, 'native-pair-08-closure');
    await escapeLine(page);
    const document = await save(page);
    const topology = chainTopology(document, ids, true);
    const orientations = orientationConstraints(document, [[ids[0], 'horizontal'], [ids[1], 'vertical'],
      [ids[2], 'horizontal'], [ids[3], 'vertical']]);
    const solver = await solverTopology(page, ids, true);
    await screenshot(page, 'C-closed-profile');
    await tool(page, 'sketch.finish').click();
    await page.waitForSelector('.live-workarea[data-workspace="solid"]');
    await tool(page, 'part.extrude').click();
    await page.getByLabel('Расстояние', { exact: true }).fill('10');
    await page.locator('.live-commit').click();
    await page.waitForFunction(() => {
      const app = document.querySelector('.cad-app');
      return app?.getAttribute('data-feature-count') === '1'
        && app?.getAttribute('data-recompute-status') === 'clean';
    }, null, { timeout: 90000 });
    const bounds = (await page.locator('.cad-viewport').getAttribute('data-bounds')).split(',').map(Number);
    assert.equal(bounds.length, 6);
    [-30, -20, 0, 30, 20, 10].forEach((value, index) => near(bounds[index], value, 'Real OCC B-Rep bounds', 0.02));
    assert.equal(await page.locator('canvas').count(), 1, 'One common Part renderer');
    const wasm = await page.evaluate(() => performance.getEntriesByType('resource').map(value => value.name));
    assert.ok(wasm.some(value => /opencascade.*\.wasm(?:$|[?#])/i.test(value)), 'Real OpenCascade WASM must be loaded');
    await screenshot(page, 'C-occ-extrude10');
    const solid = await save(page);
    assert.equal(solid.features.length, 1);
    return { ids, topology, orientations, solver, closureState, distance: 10, bounds, realOpenCascade: true,
      solidDocumentSha256: sha256(JSON.stringify(solid)) };
  }, 150000);

  await runCase('D', 'One Escape cancels a third preview and preserves two committed lines', async page => {
    const ids = await buildChain(page, chainPoints.slice(0, 3));
    const before = await save(page);
    await pointerWorld(page, chainPoints[3], 'move');
    await waitLine(page, 'anchored'); const preview = await ghost(page);
    await screenshot(page, 'D-third-preview-before-escape');
    await escapeLine(page);
    await solved(page, 2);
    const after = await save(page);
    assert.deepEqual(after, before, 'Cancel drops only transient preview; real geometry and refs are unchanged');
    await screenshot(page, 'D-after-escape-two-lines');
    return { ids, preview, topology: chainTopology(after, ids), solver: await solverTopology(page, ids),
      escapeCount: 1, preservedDocumentSha256: sha256(JSON.stringify(after)) };
  });

  await runCase('E.ids', 'Single unconstrained Line Undo/Redo keeps IDs; atomic chain history remains BLOCKED', async page => {
    const ids = await buildChain(page, [[-30, -20], [-10, -5]]);
    await escapeLine(page); const before = await save(page);
    assert.equal(before.constraints.length, 0, 'Single oblique segment intentionally has no inference constraint');
    assert.equal(before.dimensions.length, 0);
    await quick(page, 'system.undo').click(); await solved(page, 0);
    const undone = await save(page);
    assert.equal(undone.sketches[0].entities.length, 0);
    assert.equal(undone.constraints.length, 0); assert.equal(undone.dimensions.length, 0);
    await quick(page, 'system.redo').click(); await solved(page, 1);
    assert.deepEqual(await entityIds(page), ids);
    const redone = await save(page);
    assert.deepEqual(redone, before, 'Redo restores the identical persisted segment and stable IDs');
    return { singleSegmentStableIds: 'PASS', ids, atomicSegmentAndInferenceUndo: 'BLOCKED', acceptance: 'BLOCKED' };
  });

  await runCase('E.chain', 'Five real chain Undo/Redo frames preserve line and constraint IDs without dangling refs', async page => {
    await page.locator('[data-sketch-option="snap"]').uncheck();
    await page.locator('[data-sketch-option="constraints"]').check();
    const ids = await buildChain(page, chainPoints.slice(0, 4));
    await escapeLine(page);
    const before = await save(page), topology = chainTopology(before, ids);
    assert.equal(before.constraints.length, 2, 'Snap-off chain still has its two intrinsic coincidences');
    assert.equal(before.dimensions.length, 0);
    assert.ok(before.constraints.every(value => value.type === 'coincident'));
    const constraintIds = ids.slice(1).map((id, index) => {
      const join = topology.joins.find(value => value.pair.includes(ids[index] + ':b') && value.pair.includes(id + ':a'));
      assert.ok(join); return join.id;
    });
    const beforeGeometry = await realLines(page, ids);
    const frames = [];
    const checkFrame = async (direction, frame, lineCount, coincidenceCount, command) => {
      const expectedIds = ids.slice(0, lineCount), expectedConstraints = constraintIds.slice(0, coincidenceCount);
      await solved(page, lineCount);
      await page.waitForFunction(expected => {
        const actual = [...document.querySelectorAll('[data-sketch-layer="constraints"] [data-sketch-constraint-id]')]
          .map(node => node.getAttribute('data-sketch-constraint-id')).sort();
        return JSON.stringify(actual) === JSON.stringify([...expected].sort());
      }, expectedConstraints);
      assert.deepEqual(await entityIds(page), expectedIds, 'History preserves the expected stable Line IDs');
      const document = await save(page); documentLines(document, expectedIds);
      assert.deepEqual(document.sketches[0].entities.map(value => value.id), expectedIds);
      assert.deepEqual([...document.sketches[0].constraintIds].sort(), [...expectedConstraints].sort());
      assert.deepEqual(document.sketches[0].dimensionIds, []);
      assert.deepEqual(document.constraints, before.constraints.filter(value => expectedConstraints.includes(value.id)),
        'History restores the exact constraint IDs and endpoint references');
      assert.deepEqual(document.dimensions, []);
      const existing = new Set(expectedIds);
      for (const constraint of document.constraints) for (const ref of constraint.data.refs) {
        assert.ok(existing.has(ref.entityId), 'Every coincident endpoint refers to an existing Line');
        assert.ok(ref.point === 'a' || ref.point === 'b', 'Every Line endpoint reference remains valid');
      }
      frames.push({ direction, frame, command, entityIds: expectedIds, constraintIds: expectedConstraints,
        constraints: document.constraints, documentSha256: sha256(JSON.stringify(document)) });
      return document;
    };
    // These are five separate current application commands, not three atomic segments.
    const undoStates = [[3, 1, 'constraint.coincident'], [2, 1, 'sketch.line'],
      [2, 0, 'constraint.coincident'], [1, 0, 'sketch.line'], [0, 0, 'sketch.line']];
    let empty;
    for (let index = 0; index < undoStates.length; index++) {
      await quick(page, 'system.undo').click();
      empty = await checkFrame('undo', index + 1, ...undoStates[index]);
    }
    assert.equal(empty.sketches[0].entities.length, 0, 'All three lines are removed after the five actual Undo frames');
    assert.equal(empty.constraints.length, 0, 'No orphan constraint survives the empty chain');

    const redoStates = [[1, 0, 'sketch.line'], [2, 0, 'sketch.line'],
      [2, 1, 'constraint.coincident'], [3, 1, 'sketch.line'], [3, 2, 'constraint.coincident']];
    let restored;
    for (let index = 0; index < redoStates.length; index++) {
      await quick(page, 'system.redo').click();
      restored = await checkFrame('redo', index + 1, ...redoStates[index]);
    }
    assert.deepEqual(restored, before, 'Five Redo frames restore the exact saved chain and every stable ID');
    const afterGeometry = await realLines(page, ids);
    afterGeometry.forEach((line, index) => line.forEach((value, axis) =>
      near(value, beforeGeometry[index][axis], 'Redo restores the actual solved chain geometry')));
    return { ids, constraintIds, frames, undoFrameCount: 5, redoFrameCount: 5,
      snapEnabled: false, noDanglingReferences: true, topology: chainTopology(restored, ids),
      solver: await solverTopology(page, ids), atomicSegmentAndInferenceUndo: 'BLOCKED', acceptance: 'BLOCKED' };
  });

  await runCase('F', 'Save/reload/Open preserves chain IDs, refs, and actual solved topology', async page => {
    const ids = await buildChain(page, chainPoints);
    await escapeLine(page); const before = await save(page);
    const beforeTopology = chainTopology(before, ids); const beforeGeometry = await realLines(page, ids);
    await publicOpen(page, 4);
    assert.deepEqual(await entityIds(page), ids);
    const after = await save(page);
    assert.deepEqual(after, before, 'Public Save/Open preserves the actual serializable document');
    const afterGeometry = await realLines(page, ids);
    afterGeometry.forEach((line, index) => line.forEach((value, j) => near(value, beforeGeometry[index][j], 'Reopened solved coordinate')));
    await screenshot(page, 'F-reopened-chain');
    return { ids, beforeTopology, afterTopology: chainTopology(after, ids),
      solver: await solverTopology(page, ids), documentSha256: sha256(JSON.stringify(after)) };
  });

  await runCase('G', 'Wheel and middle-button pan preserve an anchored Line preview', async page => {
    const before = await save(page); const from = [-20, -10], to = [10, 12];
    await startLine(page); await pointerWorld(page, from); await pointerWorld(page, to, 'move');
    const originalPreview = await ghost(page);
    const oldSpan = Number(await stage(page).getAttribute('data-sketch-view-span'));
    await page.mouse.wheel(0, -180);
    await page.waitForFunction(value => Number(document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-sketch-view-span')) < value, oldSpan);
    const oldCenter = await stage(page).getAttribute('data-sketch-view-center');
    const pan = await worldPoint(page, [-15, 8]);
    await page.mouse.move(pan.x, pan.y); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(pan.x + 75, pan.y + 35, { steps: 5 }); await page.mouse.up({ button: 'middle' });
    await page.waitForFunction(value => document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-sketch-view-center') !== value, oldCenter);
    await waitLine(page, 'anchored');
    const preview = await ghost(page);
    near(preview[0], from[0], 'Pan preserves world anchor X'); near(preview[1], from[1], 'Pan preserves world anchor Y');
    assert.deepEqual(await save(page), before, 'Navigation and preview never write CAD intent');
    await pointerWorld(page, to, 'move');
    await screenshot(page, 'G-anchored-preview-after-pan-zoom');
    await pointerWorld(page, to);
    const ids = await waitCommit(page, 1); await escapeLine(page);
    const actual = await assertGeometry(page, ids, [[...from, ...to]]);
    const document = await save(page); documentLines(document, ids);
    return { originalPreview, preview, actual, oldSpan,
      newSpan: Number(await stage(page).getAttribute('data-sketch-view-span')),
      oldCenter, newCenter: await stage(page).getAttribute('data-sketch-view-center') };
  });

  await runCase('H.keyboard', 'L, real typing, Tab locks, invalid values, rapid Enter, and pointer double commit', async page => {
    const empty = await save(page);
    await startLine(page, true); await pointerWorld(page, [-20, -10]); await pointerWorld(page, [0, 10], 'move');
    await interaction(page).focus(); await page.keyboard.type('0'); await page.keyboard.press('Tab');
    assert.equal(await fields(page).getAttribute('data-input-valid'), 'false', 'Zero length is rejected visibly');
    await page.keyboard.press('Enter');
    await waitLine(page, 'anchored');
    assert.deepEqual(await save(page), empty, 'Invalid Enter cannot mutate geometry, constraints, dimensions, or history intent');
    await lengthInput(page).focus(); await page.keyboard.press('Control+A'); await page.keyboard.type('40');
    await page.keyboard.press('Tab');
    assert.equal(await angleInput(page).evaluate(node => document.activeElement === node), true);
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'true');
    await page.keyboard.press('Control+A'); await page.keyboard.type('30');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await lengthInput(page).evaluate(node => document.activeElement === node), true, 'Shift+Tab returns to length');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true', 'Leaving the angle field locks it');
    await pointerWorld(page, [30, -25], 'move');
    const lockedPreview = await ghost(page);
    near(Math.hypot(lockedPreview[2] - lockedPreview[0], lockedPreview[3] - lockedPreview[1]), 40,
      'Pointer movement preserves the locked preview length', 1e-4);
    near(Math.atan2(lockedPreview[3] - lockedPreview[1], lockedPreview[2] - lockedPreview[0]) * 180 / Math.PI, 30,
      'Pointer movement preserves the locked preview angle', 1e-4);
    await page.keyboard.press('Tab');
    // Adjacent events deliberately have no solver wait: waiting here masks races.
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    const firstIds = await waitCommit(page, 1, false); await waitIdle(page);
    await numericGeometry(page, firstIds[0], [-20, -10], 40, 30);
    const first = await save(page); documentLines(first, firstIds);
    const dimensionIds = first.dimensions.map(value => value.id);
    assert.equal(new Set(dimensionIds).size, dimensionIds.length);
    assert.equal(first.dimensions.filter(value => value.type === 'linear' && value.entityIds.includes(firstIds[0])).length, 1,
      'Rapid Enter does not duplicate the driving length');
    await startLine(page); await pointerWorld(page, [-30, 20]); await pointerWorld(page, [-10, 30], 'move');
    await pointerWorld(page, [-10, 30], 'double');
    const ids = await waitCommit(page, 2, false);
    await waitLine(page, 'awaiting-start');
    assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0);
    assert.equal(await page.locator('[data-testid="sketch-line-ghost"]').count(), 0);
    const doubleClickState = await activeState(page);
    await escapeLine(page);
    const second = await save(page); documentLines(second, ids);
    const actual = await realLines(page, ids);
    for (const line of actual) assert.ok(Math.hypot(line[2] - line[0], line[3] - line[1]) > 1e-6, 'No zero-length double-click entity');
    assert.deepEqual(ids.slice(0, 1), firstIds);
    await screenshot(page, 'H-no-double-commit');
    return { lShortcut: true, typedFromField: true, tabFocusAndLengthLock: true, shiftTabFocus: true,
      invalidValueNoMutation: true, adjacentEnterEntityCount: 1, doubleClickTotalEntityCount: 2,
      doubleClickState, ids, actual, lockedPreview, nativeDoubleClickLifecycle: 'PASS' };
  });

  await runCase('H.numeric-chain', 'Numeric pointer commit continues the chain with reset locks and real driving length', async page => {
    const from = [-20, -10], firstTo = [from[0] + 40 * Math.cos(Math.PI / 6), from[1] + 20];
    const nextTo = [35, -15];
    await startLine(page); await pointerWorld(page, from); await pointerWorld(page, [0, 5], 'move');
    await numericInput(page, '40', '30');
    await page.keyboard.press('Tab');
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'true');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true');
    // A real field click must preserve the numeric values while taking the
    // continuation path; Enter intentionally takes the separate exit path.
    await pointerWorld(page, firstTo);
    const firstIds = await waitCommit(page, 1);
    const firstLine = await numericGeometry(page, firstIds[0], from, 40, 30);
    const firstContinuedState = await activeState(page);
    assert.equal(firstContinuedState.command, 'sketch.line');
    assert.equal(firstContinuedState.phase, 'anchored');
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'false', 'The next segment has a fresh length input');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'false', 'The next segment has a fresh angle input');
    await screenshot(page, 'H-numeric-click-continues');

    await pointerWorld(page, nextTo, 'move');
    const nextPreview = await ghost(page);
    near(nextPreview[0], firstLine[2], 'The continued numeric chain uses the solved endpoint X', 1e-4);
    near(nextPreview[1], firstLine[3], 'The continued numeric chain uses the solved endpoint Y', 1e-4);
    near(nextPreview[2], nextTo[0], 'The reset numeric length does not alter the next pointer endpoint X', 0.02);
    near(nextPreview[3], nextTo[1], 'The reset numeric angle does not alter the next pointer endpoint Y', 0.02);
    await pointerWorld(page, nextTo);
    const ids = await waitCommit(page, 2);
    assert.deepEqual(ids.slice(0, 1), firstIds, 'The numeric segment retains its ID during continuation');
    await numericGeometry(page, firstIds[0], from, 40, 30);
    const actual = await assertGeometry(page, ids, [firstLine, [firstLine[2], firstLine[3], ...nextTo]]);
    const beforeEscape = await save(page);
    const topology = chainTopology(beforeEscape, ids);
    assert.equal(topology.topologicalPoints, 3);
    assert.equal(beforeEscape.constraints.length, 1, 'Two segments have exactly one intrinsic chain coincidence');
    assert.equal(beforeEscape.constraints[0].type, 'coincident');
    assert.equal(beforeEscape.dimensions.length, 1, 'The numeric pointer commit creates one real length dimension');
    const drivingLength = beforeEscape.dimensions[0];
    assert.equal(drivingLength.type, 'linear'); assert.equal(drivingLength.driving, true);
    near(drivingLength.value, 40, 'The first segment keeps its persisted driving length', 1e-8);
    assert.deepEqual(drivingLength.entityIds, firstIds);
    const solver = await solverTopology(page, ids);
    await interaction(page).focus(); await escapeLine(page);
    assert.deepEqual(await entityIds(page), ids, 'Escape preserves exactly two real committed segments');
    assert.deepEqual(await save(page), beforeEscape, 'Escape changes no geometry, coincidence, or driving length');
    return { ids, firstLine, firstContinuedState, resetNumericLocks: true, nextPreview, actual,
      topology, solver, drivingLength, numericPointerContinuation: true, escapePreservesDocument: true,
      absoluteDrivingAngle: 'BLOCKED' };
  });

  await runCase('H.interior-angle', 'A chained 120 degree interior input follows the pointer branch and keeps Line active', async page => {
    const firstPoints = [[-30, 15], [-10, 15]], rawPreview = [-2, 25], rawCommit = [10, 5];
    const firstIds = await buildChain(page, firstPoints);
    const [firstLine] = await realLines(page, firstIds);
    await pointerWorld(page, rawPreview, 'move');
    assert.equal(await fields(page).getAttribute('data-angle-mode'), 'chain-interior');
    const previewAngle = Number((await angleInput(page).inputValue()).replace(',', '.'));
    near(previewAngle, 180 - Math.atan2(10, 8) * 180 / Math.PI,
      'The chained input displays the interior angle from the reverse previous segment', 1e-4);
    await numericInput(page, '30', '120');
    await page.keyboard.press('Tab');
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'true');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true');
    assert.equal(await fields(page).getAttribute('data-angle-mode'), 'chain-interior');
    // The lower raw pointer selects -60 degrees globally while the locked
    // interior value remains 120 degrees relative to the previous segment.
    await pointerWorld(page, rawCommit);
    const ids = await waitCommit(page, 2);
    assert.deepEqual(ids.slice(0, 1), firstIds);
    const secondLine = await numericGeometry(page, ids[1], firstPoints[1], 30, -60);
    const actual = await assertGeometry(page, ids, [firstLine, secondLine]);
    const reverse = [actual[0][0] - actual[0][2], actual[0][1] - actual[0][3]];
    const outgoing = [actual[1][2] - actual[1][0], actual[1][3] - actual[1][1]];
    const cosine = (reverse[0] * outgoing[0] + reverse[1] * outgoing[1])
      / (Math.hypot(...reverse) * Math.hypot(...outgoing));
    const interiorAngle = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
    near(interiorAngle, 120, 'The actual solved chained angle is 120 degrees', 1e-4);
    const continuedState = await activeState(page);
    assert.equal(continuedState.command, 'sketch.line'); assert.equal(continuedState.phase, 'anchored');
    await screenshot(page, 'H-interior120-length30-pointer-below');
    await escapeLine(page);
    const document = await save(page), topology = chainTopology(document, ids);
    assert.equal(document.constraints.length, 2, 'The two segments retain first-line H and their real coincidence');
    const orientations = orientationConstraints(document, [[firstIds[0], 'horizontal']]);
    const linearDimensions = document.dimensions.filter(value => value.type === 'linear');
    assert.equal(linearDimensions.length, 1, 'The second segment has one persisted linear dimension');
    const drivingLength = linearDimensions[0];
    assert.equal(drivingLength.driving, true);
    near(drivingLength.value, 30, 'The entered 30 mm is a real driving length', 1e-8);
    assert.deepEqual(drivingLength.entityIds, [ids[1]]);
    assert.ok(document.sketches[0].dimensionIds.includes(drivingLength.id));
    return { ids, rawPreview, rawCommit, previewAngle, actual, interiorAngle, continuedState,
      topology, solver: await solverTopology(page, ids), orientations, drivingLength,
      angleMode: 'chain-interior', relativeDrivingAngle: 'NOT_ASSERTED' };
  });

  await runCase('H.mouse-input', 'A smooth mouse approach can focus, edit and toggle locked numeric input without committing', async page => {
    const baselineIds = await buildChain(page, [[-35, 30], [-25, 35]]);
    await escapeLine(page);
    const baseline = await save(page);
    await startLine(page); await pointerWorld(page, [-20, -10]); await pointerWorld(page, [0, 5], 'move');
    await numericInput(page, '40', '30'); await page.keyboard.press('Tab');
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'true');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true');
    await pointerWorld(page, [30, -25], 'move');
    const lockedPreview = await ghost(page), approaches = [];
    const approachAndClick = async (target, label) => {
      const box = await target.boundingBox(); assert.ok(box, 'Visible mouse target: ' + label);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const samples = [];
      // Traverse the former 18 px exclusion halo in 2 px steps and allow each
      // real pointermove to render before checking that the target stays put.
      for (let distance = 36; distance >= 0; distance -= 2) {
        await page.mouse.move(x, y - distance);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        const current = await target.boundingBox(); assert.ok(current, 'Mouse target stays visible: ' + label);
        for (const key of ['x', 'y', 'width', 'height']) near(current[key], box[key],
          'Numeric control must not evade a smooth mouse approach: ' + label + ' ' + key, 0.75);
        samples.push({ distance, x: current.x, y: current.y });
      }
      assert.equal(await target.evaluate((node, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return hit === node || (!!hit && node.contains(hit));
      }, { x, y }), true, 'The real mouse hit belongs to the intended control: ' + label);
      await page.mouse.down(); await page.mouse.up();
      approaches.push({ label, box, point: { x, y }, samples });
    };
    await approachAndClick(lengthInput(page), 'length input');
    assert.equal(await lengthInput(page).evaluate(node => document.activeElement === node), true,
      'The real mouse click focuses the numeric input');
    await page.keyboard.press('Control+A'); await page.keyboard.type('45');
    assert.equal(await lengthInput(page).inputValue(), '45');
    const editedPreview = await ghost(page);
    near(Math.hypot(editedPreview[2] - editedPreview[0], editedPreview[3] - editedPreview[1]), 45,
      'Mouse-focused length editing changes the real preview', 1e-4);
    near(Math.atan2(editedPreview[3] - editedPreview[1], editedPreview[2] - editedPreview[0]) * 180 / Math.PI,
      30, 'Editing length retains the locked angle', 1e-4);
    await page.keyboard.press('Control+A'); await page.keyboard.type('40');
    assert.equal(await lengthInput(page).evaluate(node => document.activeElement === node), true);
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'true');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true');
    const lengthLock = lengthInput(page).locator('xpath=..').locator('button.live-line-lock');
    await approachAndClick(lengthLock, 'length lock');
    assert.equal(await fields(page).getAttribute('data-length-locked'), 'false', 'The real mouse click releases the length lock');
    assert.equal(await fields(page).getAttribute('data-angle-locked'), 'true');
    await waitLine(page, 'anchored');
    assert.deepEqual(await entityIds(page), baselineIds, 'Mouse input and lock interactions must not add a segment');
    await escapeLine(page);
    assert.deepEqual(await save(page), baseline, 'Mouse editing and Escape preserve the real baseline geometry, constraints and dimensions');
    return { baselineIds, lockedPreview, editedPreview, approaches, mouseInputFocus: true, mouseInputEdit: true,
      mouseLengthLockToggle: 'locked-to-unlocked', noAdditionalEntities: true, escapePreservesDocument: true };
  });

  await runCase('H.lifecycle', 'Repeated Line selection preserves the chain; plain Enter commits preview and exits', async page => {
    const ids = await buildChain(page, chainPoints.slice(0, 3));
    await pointerWorld(page, chainPoints[3], 'move');
    const before = await ghost(page);
    await tool(page, 'sketch.line').click();
    await waitLine(page, 'anchored');
    assert.deepEqual(await entityIds(page), ids, 'Reselecting active Line preserves both committed segments');
    const after = await ghost(page);
    near(after[0], before[0], 'Reselecting active Line preserves anchor X');
    near(after[1], before[1], 'Reselecting active Line preserves anchor Y');
    await pointerWorld(page, chainPoints[3], 'move');
    await interaction(page).focus();
    await page.keyboard.press('Enter');
    const committedIds = await waitCommit(page, 3, false); await waitIdle(page);
    assert.deepEqual(committedIds.slice(0, 2), ids, 'Plain Enter keeps existing IDs');
    const document = await save(page);
    await assertGeometry(page, committedIds, chainPoints.slice(1, 4).map((point, index) => [...chainPoints[index], ...point]));
    return { repeatedToolbarPreservedAnchor: true, before, after, plainEnter: 'commit-and-exit',
      ids: committedIds, topology: chainTopology(document, committedIds), solver: await solverTopology(page, committedIds) };
  });

  await runCase('H.focus', 'Numeric Enter and Escape restore stage focus; immediate Ctrl+Z reaches real history', async page => {
    const readFocus = () => page.evaluate(() => {
      const active = document.activeElement, stage = document.querySelector('[data-testid="part-model-stage"]');
      return { tag: active?.tagName ?? null, testId: active?.getAttribute('data-testid') ?? null,
        insidePersistentStage: !!stage && !!active && (active === stage || stage.contains(active)) };
    });
    await startLine(page); await pointerWorld(page, [-20, -10]); await pointerWorld(page, [0, 5], 'move');
    await numericInput(page, '40', '30');
    await page.keyboard.press('Enter');
    const ids = await waitCommit(page, 1, false); await waitIdle(page);
    const annotation = page.locator('[data-sketch-layer="dimensions"] [data-sketch-dimension-id]');
    await annotation.first().waitFor({ state: 'attached' });
    assert.equal(await annotation.count(), 1);
    const dimensionId = await annotation.getAttribute('data-sketch-dimension-id');
    assert.ok(dimensionId);
    const enterFocus = await readFocus();
    assert.equal(enterFocus.insidePersistentStage, true, 'Numeric Enter must restore actual focus to the persistent field');
    // No click, focus(), Save, or pointer event is allowed between Enter and
    // this first Undo. DOM reads above cannot repair the lost-focus regression.
    await page.keyboard.press('Control+z');
    await annotation.waitFor({ state: 'detached' });
    const undone = await save(page); documentLines(undone, ids);
    assert.equal(undone.dimensions.length, 0, 'Immediate Undo removes the real last dimension command');
    assert.deepEqual(await entityIds(page), ids, 'Separate-frame dimension Undo keeps the real Line');

    await stage(page).focus(); await page.keyboard.press('Control+y');
    await page.locator('[data-sketch-dimension-id="' + dimensionId + '"]').waitFor({ state: 'attached' });
    const redone = await save(page); documentLines(redone, ids);
    assert.equal(redone.dimensions.length, 1);
    assert.equal(redone.dimensions[0].id, dimensionId, 'Redo preserves the real dimension ID');
    assert.equal(redone.dimensions[0].type, 'linear');
    assert.equal(redone.dimensions[0].value, 40);
    assert.equal(redone.dimensions[0].driving, true);
    assert.deepEqual(redone.dimensions[0].entityIds, ids);

    await startLine(page); await pointerWorld(page, [-30, 20]); await pointerWorld(page, [-10, 30], 'move');
    await numericInput(page, '25', '15');
    await page.keyboard.press('Escape'); await waitIdle(page);
    const escapeFocus = await readFocus();
    assert.equal(escapeFocus.insidePersistentStage, true, 'Escape from a numeric input must restore the persistent field focus');
    assert.deepEqual(await save(page), redone, 'Numeric Escape discards only the new preview');
    return { ids, dimensionId, enterFocus, escapeFocus, immediateKeyboardUndo: true,
      lastRealCommandUndone: 'dimension.linear', linePreservedByDimensionUndo: true,
      redoStableDimensionId: true, atomicLineAndDimensionUndo: 'BLOCKED' };
  });

  await runCase('H.snap-toggle', 'Disabling Snap invalidates the pending inference without breaking chain coincidence', async page => {
    const firstIds = await buildChain(page, [[-30, -20], [-10, -5]]);
    const before = await save(page);
    assert.equal(before.constraints.length, 0, 'The initial oblique line has no inference constraint');
    await pointerWorld(page, [18, -4.98], 'move');
    await page.locator('[data-testid="fusion-line-snap"][data-snap-kind="horizontal"]').waitFor({ state: 'visible' });
    const snappedPreview = await ghost(page);
    near(snappedPreview[3], snappedPreview[1], 'Horizontal inference really snapped the preview', 1e-4);
    await screenshot(page, 'H-horizontal-preview-before-snap-off');
    await page.locator('[data-sketch-option="snap"]').uncheck();
    await page.waitForFunction(() => document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-sketch-snap-enabled') === 'false');
    // Refocus without moving the pointer in the drawing field. A new field
    // pointermove would clear the stale context and conceal the reviewed bug.
    await interaction(page).focus();
    await page.keyboard.press('Enter');
    const ids = await waitCommit(page, 2, false); await waitIdle(page);
    assert.deepEqual(ids.slice(0, 1), firstIds);
    const after = await save(page);
    const topology = chainTopology(after, ids);
    assert.deepEqual(after.constraints.filter(value => value.type === 'horizontal' || value.type === 'vertical'), [],
      'Snap disabled before Enter must prevent stale H/V constraints');
    assert.equal(after.constraints.length, before.constraints.length + 1,
      'Only intrinsic chain coincidence remains; no stale endpoint or orientation inference');
    assert.equal(after.constraints[0].type, 'coincident');
    assert.deepEqual(after.dimensions, before.dimensions, 'Snap toggle does not introduce a driving dimension');
    return { snapEnabledAtPreview: true, snapEnabledAtCommit: false, fieldPointerMovesAfterToggle: 0,
      snappedPreview, ids, topology, solver: await solverTopology(page, ids),
      constraints: after.constraints, chainCoincidencePreserved: true };
  });

  await runCase('H.context', 'Context Escape preserves Line; Repeat Line finishes the current chain', async page => {
    const readFocus = () => page.evaluate(() => {
      const active = document.activeElement, stage = document.querySelector('[data-testid="part-model-stage"]');
      return { tag: active?.tagName ?? null, testId: active?.getAttribute('data-testid') ?? null,
        insidePersistentStage: !!stage && !!active && (active === stage || stage.contains(active)) };
    });
    const ids = await buildChain(page, chainPoints.slice(0, 3));
    await pointerWorld(page, chainPoints[3], 'move');
    const preview = await ghost(page);
    const menu = page.locator('.live-context.live-marking[data-marking-workspace="sketch"]');
    const openAtPreview = async () => {
      const pixel = await worldPoint(page, chainPoints[3]);
      await page.mouse.click(pixel.x, pixel.y, { button: 'right' });
      await menu.waitFor({ state: 'visible' });
      assert.equal(await menu.getAttribute('data-marking-level'), 'root');
      await page.waitForFunction(() => !!document.activeElement?.closest('.live-context.live-marking'));
    };
    await openAtPreview();
    assert.deepEqual(await entityIds(page), ids, 'Opening the context menu never commits the preview');
    await screenshot(page, 'H-preview-context-before-escape');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
    await waitLine(page, 'anchored');
    assert.deepEqual(await entityIds(page), ids, 'Menu Escape preserves both real segments');
    const afterMenuEscape = await ghost(page);
    afterMenuEscape.forEach((value, index) => near(value, preview[index], 'Menu Escape preserves the current preview'));
    const escapeState = await activeState(page);
    const escapeFocus = await readFocus();
    assert.equal(escapeFocus.insidePersistentStage, true, 'Menu Escape restores actual persistent-stage focus without a repairing click');

    await openAtPreview();
    const repeatLine = menu.locator('[data-marking-slot="0"]');
    const repeatLabel = await repeatLine.getAttribute('aria-label');
    assert.match(repeatLabel || '', /^Повторить:\s*(?:Отрезок|Линия|Line)/u, 'The public action explicitly repeats Line');
    assert.equal(await repeatLine.isEnabled(), true);
    await repeatLine.click();
    await menu.waitFor({ state: 'detached' });
    await waitLine(page, 'awaiting-start');
    assert.equal(await page.locator('[data-testid="sketch-line-anchor"]').count(), 0);
    assert.equal(await page.locator('[data-testid="sketch-line-ghost"]').count(), 0);
    assert.deepEqual(await entityIds(page), ids, 'Repeat Line finishes the chain without committing the preview');
    const repeatState = await activeState(page);
    const repeatFocus = await readFocus();
    assert.equal(repeatFocus.insidePersistentStage, true, 'Repeat Line restores persistent-stage focus before the next Escape');
    await screenshot(page, 'H-context-repeat-line-awaiting-start');
    await escapeLine(page);
    const document = await save(page);
    await startLine(page); await pointerWorld(page, [-30, 25]); await pointerWorld(page, chainPoints[3], 'move');
    await openAtPreview();
    const cancelLine = menu.locator('[data-marking-slot="6"]');
    assert.equal(await cancelLine.getAttribute('aria-label'), 'Отмена');
    await cancelLine.click();
    await menu.waitFor({ state: 'detached' }); await waitIdle(page);
    const cancelFocus = await readFocus();
    assert.equal(cancelFocus.insidePersistentStage, true, 'Menu Cancel restores actual persistent-stage focus without refocusing');
    assert.deepEqual(await save(page), document, 'Menu Cancel drops only the new preview and preserves the full document');
    return { ids, preview, afterMenuEscape, escapeState, repeatState, repeatLabel, escapeFocus, repeatFocus, cancelFocus,
      menuEscapeOnly: true, repeatFinishesChainWithoutCommit: true, menuCancelPreservesDocument: true,
      topology: chainTopology(document, ids), solver: await solverTopology(page, ids) };
  });

  await runCase('H.locale', 'Comma and dot numeric entry use the same actual values', async page => {
    const segments = [];
    for (const [lengthText, angleText, from] of [['40,5', '30,5', [-35, -25]], ['40.5', '30.5', [-35, 5]]]) {
      await startLine(page); await pointerWorld(page, from); await pointerWorld(page, [from[0] + 10, from[1] + 5], 'move');
      await numericInput(page, lengthText, angleText); await page.keyboard.press('Enter');
      const ids = await waitCommit(page, segments.length + 1, false); await waitIdle(page);
      const id = ids.at(-1);
      segments.push({ id, lengthText, angleText, geometry: await numericGeometry(page, id, from, 40.5, 30.5) });
    }
    const ids = segments.map(value => value.id), document = await save(page);
    documentLines(document, ids);
    for (const id of ids) {
      const dimensions = document.dimensions.filter(value => value.type === 'linear' && value.driving === true && value.entityIds.includes(id));
      assert.equal(dimensions.length, 1); near(dimensions[0].value, 40.5, 'Locale-independent persisted driving length');
    }
    return { segments, persistedLengths: document.dimensions.filter(value => value.type === 'linear').map(value => value.value),
      absoluteDrivingAngle: 'BLOCKED' };
  });

  const failed = report.cases.filter(value => value.status === 'FAIL');
  report.executableChecksStatus = failed.length ? 'FAIL' : 'PASS';
  report.status = failed.length ? 'FAIL' : 'BLOCKED';
  report.acceptanceStatus = 'BLOCKED';
  report.acceptanceReason = 'B absolute driving angle, E atomic segment+inference history, and separate I compatibility gates are not completed by this focused runner.';
  if (failed.length) process.exitCode = 1;
} catch (error) {
  Object.assign(report, { status: 'FAIL', phase, error: error.message });
  if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, 'fatal-debug').catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  if (browser) await bounded(browser.close(), 10000, 'Browser cleanup').catch(error => report.cleanupErrors.push(error.message));
  for (const value of ownedServers) await stopServer(value).catch(error => report.cleanupErrors.push(error.message));
  report.ownedServersClosed = ownedServers.every(value => value.child.exitCode !== null || value.child.signalCode !== null);
  if (!report.ownedServersClosed || report.cleanupErrors.length) {
    report.status = 'FAIL'; process.exitCode = 1;
  }
  report.finishedUTC = new Date().toISOString();
  await writeFile(resolve(out, 'fusion-live-line-behavior-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, executableChecksStatus: report.executableChecksStatus,
    acceptanceStatus: report.acceptanceStatus, cases: report.cases.map(({ id, status }) => ({ id, status })),
    knownBlockers: report.knownBlockers, ownedServersClosed: report.ownedServersClosed,
    pageErrors: report.pageErrors, requestFailures: report.requestFailures, cleanupErrors: report.cleanupErrors }, null, 2));
}
