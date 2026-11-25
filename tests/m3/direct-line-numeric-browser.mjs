import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoPageErrors, assertNoWasm, assertSketchOnlyWasm, createXYSketch,
  interactionBox, launchM3Browser, near, newDesktopPage, reopenFirstSketch,
  saveLocalDocument, shellUrl, squarePoint, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const S = '[data-testid="cad-sketch-interaction"][data-tool="line"]';
const P = '[data-testid="sketch-line-numeric"]';
const O = '[data-testid="cad-sketch-overlay"]';
const out = process.env.ASA_U2_LINE_EVIDENCE_DIR;
const report = { suite: 'U2 numeric Line', url: shellUrl, cases: [] };
assert.ok(![8094, 8098, 8099].includes(Number(new URL(shellUrl).port)), 'Protected origin');
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await launchM3Browser();
const field = (p, key) => p.locator(P + ' input[data-line-field="' + key + '"]');
const phase = (p, value) => p.locator(S + '[data-line-phase="' + value + '"]').waitFor();
const ghost = (p) => p.locator('[data-testid="sketch-line-ghost"]');
const value = (p, key) => field(p, key).inputValue();
const count = (p, n) => p.locator(O + '[data-entity-count="' + n + '"]').waitFor();
const press = (p, key) => p.keyboard.press(key);
async function keys(p, text) { for (const key of text) await press(p, key); }
async function replace(p, key, text) {
  await field(p, key).click();
  await press(p, 'Control+A');
  await keys(p, text);
}
async function input(p, key) {
  return field(p, key).evaluate((e) => ({
    text: e.value, focused: e === document.activeElement,
    selection: [e.selectionStart, e.selectionEnd],
  }));
}
async function unlocked(p) {
  assert.equal(await p.locator(P + ' [data-line-lock][data-locked="true"]').count(), 0);
  assert.equal(await p.locator('[data-testid="sketch-line-anchor"]').count(), 0);
}
async function committed(p, n) {
  const overlay = await waitSolvedOverlay(p, n, 'Line');
  await phase(p, 'awaiting-start'); await unlocked(p);
  return overlay;
}
async function capture(p, name) {
  if (out) await p.screenshot({ path: path.join(out, name + '.png') });
}
async function point(p, world, action = 'click') {
  const { box } = await interactionBox(p, 'line');
  const pick = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await p.mouse[action](pick.x, pick.y);
}
async function geom(locator) {
  return locator.evaluate((e) => ({
    from: [Number(e.getAttribute('x1')), -Number(e.getAttribute('y1'))],
    to: [Number(e.getAttribute('x2')), -Number(e.getAttribute('y2'))],
  }));
}
function endpoints(actual, from, to) {
  for (let i = 0; i < 2; i++) { near(actual.from[i], from[i], 0.15); near(actual.to[i], to[i], 0.15); }
}
function polar(actual, length, angle, angleTolerance = 1e-5) {
  const dx = actual.to[0] - actual.from[0], dy = actual.to[1] - actual.from[1];
  near(Math.hypot(dx, dy), length, 1e-5, 'length');
  near(Math.atan2(dy, dx) * 180 / Math.PI, angle, angleTolerance, 'absolute angle');
}
async function start(p) {
  await p.locator('.k-command-ribbon [data-command-id="sketch.line"]').click();
  await p.locator('.k-management-panel ' + P).waitFor();
  await phase(p, 'awaiting-start');
  assert.equal(await field(p, 'length').getAttribute('aria-label'), 'Длина, мм');
  assert.equal(await field(p, 'angle').getAttribute('aria-label'), 'Угол, °');
}
function intent(doc) {
  return { id: doc.id, schemaVersion: doc.schemaVersion, sketches: doc.sketches,
    constraints: doc.constraints, dimensions: doc.dimensions };
}
function plainLines(doc, n) {
  assert.equal(doc.sketches.length, 1);
  const entities = doc.sketches[0].entities;
  assert.equal(entities.length, n); assert.ok(entities.every((e) => e.type === 'line'));
  assert.deepEqual([doc.constraints, doc.dimensions], [[], []]);
  return entities;
}
async function run(id, test) {
  const { page: p, errors } = await newDesktopPage(browser);
  p.setDefaultTimeout(15_000);
  const r = { id, status: 'FAIL' }; report.cases.push(r);
  try {
    await p.goto(new URL('cad/', shellUrl).href, { waitUntil: 'networkidle' });
    await createXYSketch(p);
    const baseline = await saveLocalDocument(p);
    await start(p);
    await test(p, r, baseline);
    assertNoPageErrors(errors, id);
    r.status = 'PASS';
  } catch (error) {
    r.error = String(error.stack ?? error);
    await capture(p, id + '-failure').catch(() => {});
  } finally { r.pageErrors = errors; await p.close(); }
}

try {
  await run('keyboard-history', async (p, r) => {
    await point(p, [-20, 5]);
    await phase(p, 'anchored');
    await keys(p, '40');
    r.immediate = await input(p, 'length');
    assert.deepEqual(r.immediate, { text: '40', focused: true, selection: [2, 2] });
    await press(p, 'Tab');
    assert.equal((await input(p, 'angle')).focused, true);
    await keys(p, '30');
    await press(p, 'Shift+Tab');
    assert.deepEqual((await input(p, 'length')).selection, [0, 2]);
    await keys(p, '45');
    r.tabReplacement = await value(p, 'length');
    assert.equal(r.tabReplacement, '45');
    await press(p, 'Control+A'); await keys(p, '40');
    await press(p, 'Tab');
    await capture(p, 'numeric-40-30-preview');
    const compositionState = () => p.locator(S).evaluate((layer) => ({
      entities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')),
      phase: layer.getAttribute('data-line-phase'),
      fields: [...document.querySelectorAll('[data-testid="sketch-line-numeric"] input')].map((e) => [e.getAttribute('data-line-field'), e.value]),
      locks: [...document.querySelectorAll('[data-testid="sketch-line-numeric"] [data-line-lock]')].map((e) => [e.getAttribute('data-line-lock'), e.getAttribute('data-locked')]),
      focusedField: document.activeElement?.getAttribute('data-line-field'),
    }));
    // Synthetic DOM guard regression, not a real operating-system IME session.
    r.composing = { method: 'synthetic DOM keydown', before: await compositionState() };
    assert.equal(r.composing.before.entities, 0);
    await field(p, 'angle').dispatchEvent('keydown', {
      key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true,
    });
    r.composing.after = await compositionState();
    assert.deepEqual(r.composing.after, r.composing.before, 'Composing Enter must preserve the uncommitted draft');
    await press(p, 'Enter');
    const overlay = await committed(p, 1);
    const visual = overlay.locator('line[data-sketch-entity-id]');
    const firstId = await visual.getAttribute('data-sketch-entity-id');
    r.solved = await geom(visual); polar(r.solved, 40, 30);
    near(r.solved.from[0], -20, 0.15); near(r.solved.from[1], 5, 0.15);
    // No refocus/click before Undo.
    await press(p, 'Control+z'); await count(p, 0);
    await press(p, 'Control+y'); await waitSolvedOverlay(p, 1, 'Redo');
    const saved = await saveLocalDocument(p), [line] = plainLines(saved, 1);
    assert.equal(line.id, firstId); polar(line.data, 40, 30);
    await reopenFirstSketch(p, 1); await waitSolvedOverlay(p, 1, 'Open');
    const reopened = await saveLocalDocument(p);
    assert.deepEqual(intent(reopened), intent(saved), 'Save/Open intent/IDs');
    r.saved = intent(reopened);
    await capture(p, 'numeric-reopened');
    await assertSketchOnlyWasm(p, r.id);
  });

  await run('placement-repeat', async (p, r) => {
    await keys(p, '25'); await press(p, 'Tab'); await keys(p, '-45');
    await p.locator(S + '[data-line-placement-ready="true"]').waitFor();
    await point(p, [5, -8], 'move'); await count(p, 0);
    r.placement = await geom(ghost(p));
    polar(r.placement, 25, -45);
    near(r.placement.from[0], 5, 0.15); near(r.placement.from[1], -8, 0.15);
    await point(p, [5, -8]); await committed(p, 1);
    await point(p, [-30, 15]); await phase(p, 'anchored'); await count(p, 1);
    await point(p, [-7, 8], 'move');
    r.freePreview = await geom(ghost(p));
    endpoints(r.freePreview, [-30, 15], [-7, 8]);
    await point(p, [-7, 8]); await committed(p, 2);
    const saved = await saveLocalDocument(p), lines = plainLines(saved, 2);
    polar(lines[0].data, 25, -45);
    endpoints(lines[1].data, [-30, 15], [-7, 8]);
    assert.notDeepEqual(lines[1].data.from, lines[0].data.to, 'Unexpected chain');
    await press(p, 'Escape');
    await p.locator(S).waitFor({ state: 'detached' });
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(saved));
    r.saved = intent(saved);
    await assertSketchOnlyWasm(p, r.id);
  });

  await run('coordinates-invalid-cancel', async (p, r, baseline) => {
    await replace(p, 'x', '-10'); await replace(p, 'y', '0,5');
    r.coordinate = await value(p, 'y'); assert.equal(r.coordinate, '0,5');
    await press(p, 'Enter'); await phase(p, 'anchored');
    r.invalid = [];
    for (const text of ['0', '-']) {
      await replace(p, 'length', text);
      assert.equal(await field(p, 'length').getAttribute('aria-invalid'), 'true');
      assert.equal(await p.locator(P + ' [data-param-commit]').isEnabled(), false);
      await press(p, 'Enter'); await point(p, [10, 8]);
      await count(p, 0); await phase(p, 'anchored');
      r.invalid.push({ text, entities: 0 });
    }
    await replace(p, 'length', '0');
    await press(p, ','); assert.equal(await value(p, 'length'), '0,');
    await press(p, '5');
    r.decimal = await value(p, 'length'); assert.equal(r.decimal, '0,5');
    await point(p, [10, 20.5], 'move');
    r.singleLock = await geom(ghost(p));
    polar(r.singleLock, 0.5, 45, 0.3);
    await field(p, 'length').click();
    await press(p, 'Escape');
    await phase(p, 'awaiting-start'); await unlocked(p); await count(p, 0);
    await press(p, 'Escape');
    await p.locator(S).waitFor({ state: 'detached' });
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(baseline), 'Cancel changed intent');
    r.saved = intent(baseline);
    await assertNoWasm(p, r.id);
  });
} finally {
  await browser.close(); report.browserClosed = true;
  report.status = report.cases.length === 3 && report.cases.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL';
  if (out) fs.writeFileSync(path.join(out, 'numeric-line-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
assert.equal(report.status, 'PASS', 'U2 numeric Line browser regression failed');
