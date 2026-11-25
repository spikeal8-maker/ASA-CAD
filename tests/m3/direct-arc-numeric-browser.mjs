import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoPageErrors, assertNoWasm, assertSketchOnlyWasm, createXYSketch, interactionBox,
  launchM3Browser, near, newDesktopPage, reopenFirstSketch, saveLocalDocument,
  shellUrl, squarePoint, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const S = '[data-testid="cad-sketch-interaction"][data-tool="arc"]';
const P = '[data-testid="sketch-arc-numeric"]', O = '[data-testid="cad-sketch-overlay"]';
const out = process.env.ASA_U2_ARC_EVIDENCE_DIR, rad = (degrees) => degrees * Math.PI / 180;
assert.ok(![8094, 8098, 8099].includes(Number(new URL(shellUrl).port)), 'Protected origin');
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await launchM3Browser();
const report = { suite: 'U2 numeric Arc', url: shellUrl, browser: browser.version(), cases: [] };
const field = (p, key) => p.locator(P + ' input[data-arc-field="' + key + '"]');
const phase = (p, value) => p.locator(S + '[data-arc-phase="' + value + '"]').waitFor();
const count = (p, n) => p.locator(O + '[data-entity-count="' + n + '"]').waitFor();
const press = (p, key) => p.keyboard.press(key);
async function keys(p, text) { for (const key of text) await press(p, key); }
async function replace(p, key, text) {
  await field(p, key).click(); await press(p, 'Control+A');
  if (text) await keys(p, text); else await press(p, 'Backspace');
}
async function point(p, world, action = 'click') {
  const { box } = await interactionBox(p, 'arc');
  const pick = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await p.mouse[action](pick.x, pick.y);
}
async function input(p, key) {
  return field(p, key).evaluate((e) => ({ text: e.value, focused: e === document.activeElement,
    selection: [e.selectionStart, e.selectionEnd] }));
}
async function snapshot(p) {
  return p.locator(S).evaluate((layer) => ({
    phase: layer.getAttribute('data-arc-phase'),
    entities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')),
    fields: [...document.querySelectorAll('[data-testid="sketch-arc-numeric"] input')]
      .map((e) => [e.getAttribute('data-arc-field'), e.value]),
    locked: document.querySelector('[data-testid="sketch-arc-numeric"]')?.getAttribute('data-radius-locked'),
    focusedField: document.activeElement?.getAttribute('data-arc-field'),
  }));
}
async function resetState(p, n) {
  await phase(p, 'awaiting-center'); await count(p, n);
  assert.equal(await p.locator(P).getAttribute('data-radius-locked'), 'false');
  assert.equal(await p.locator('[data-testid="sketch-arc-center"]').count(), 0);
}
async function editorFocus(p) {
  const focus = await p.evaluate(() => ({ tag: document.activeElement?.tagName,
    inEditor: !!document.activeElement?.closest('.cad-app'),
    editable: !!document.activeElement?.closest('input,textarea,[contenteditable="true"]') }));
  assert.equal(focus.inEditor, true); assert.equal(focus.editable, false); return focus;
}
async function screenshot(p, name) {
  if (out) await p.screenshot({ path: path.join(out, name + '.png') });
}
function intent(doc) {
  assert.equal(typeof doc.documentId, 'string'); assert.ok(doc.documentId.length);
  return { documentId: doc.documentId, kind: doc.kind, schemaVersion: doc.schemaVersion,
    sketches: doc.sketches, constraints: doc.constraints, dimensions: doc.dimensions, features: doc.features };
}
function arcs(doc, n) {
  assert.equal(doc.sketches.length, 1); assert.equal(doc.sketches[0].support, 'XY');
  const result = doc.sketches[0].entities;
  assert.equal(result.length, n); assert.ok(result.every((e) => e.type === 'arc'));
  assert.deepEqual([doc.constraints, doc.dimensions], [[], []], 'Radius lock is transient U2 input');
  return result;
}
function geometry(data, c, r, start, sweep) {
  for (let i = 0; i < 2; i++) near(data.center[i], c[i], 0.15, 'center');
  near(data.radius, r, 1e-5, 'radius');
  const difference = Math.atan2(Math.sin(data.startAngle - start), Math.cos(data.startAngle - start));
  near(difference, 0, 0.002, 'canonical start');
  near(data.endAngle - data.startAngle, sweep, 0.002, 'positive canonical sweep');
  assert.ok(data.endAngle > data.startAngle && data.endAngle - data.startAngle < Math.PI * 2);
}
async function pathGeometry(locator, c, r, start, sweep) {
  const d = await locator.getAttribute('d');
  const n = d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
  assert.equal(n.length, 9); near(n[2], r, 1e-5); near(n[3], r, 1e-5);
  assert.deepEqual(n.slice(4, 7), [0, sweep > Math.PI ? 1 : 0, 0]);
  const expected = [c[0] + r * Math.cos(start), -(c[1] + r * Math.sin(start)),
    c[0] + r * Math.cos(start + sweep), -(c[1] + r * Math.sin(start + sweep))];
  for (const [i, value] of [n[0], n[1], n[7], n[8]].entries()) near(value, expected[i], 0.15);
  return d;
}
async function run(id, body) {
  const { page: p, errors } = await newDesktopPage(browser);
  p.setDefaultTimeout(15_000); const r = { id, status: 'FAIL' }; report.cases.push(r);
  try {
    await p.goto(new URL('cad/', shellUrl).href, { waitUntil: 'networkidle' }); await createXYSketch(p);
    const baseline = await saveLocalDocument(p);
    await p.locator('.k-command-ribbon [data-command-id="sketch.arc"]').click();
    await p.locator('.k-management-panel ' + P).waitFor(); await resetState(p, 0);
    await body(p, r, baseline); assertNoPageErrors(errors, id); r.status = 'PASS';
  } catch (error) {
    r.error = String(error.stack ?? error); await screenshot(p, id + '-failure').catch(() => {});
  } finally { r.pageErrors = errors; await p.close(); }
}

try {
  await run('coordinates-radius-keyboard-history', async (p, r) => {
    await replace(p, 'x', '-10'); await replace(p, 'y', '0,5');
    assert.equal(await field(p, 'y').inputValue(), '0,5');
    await press(p, 'Enter'); await phase(p, 'awaiting-start');
    // Immediate typing, without pointer movement.
    await keys(p, '20'); r.immediate = await input(p, 'radius');
    assert.deepEqual(r.immediate, { text: '20', focused: true, selection: [2, 2] });
    await press(p, 'Tab'); await press(p, 'Shift+Tab');
    assert.deepEqual((await input(p, 'radius')).selection, [0, 2]);
    await keys(p, '25'); r.tabReplacement = await field(p, 'radius').inputValue();
    assert.equal(r.tabReplacement, '25'); await press(p, 'Control+A'); await keys(p, '20');
    await press(p, 'Enter'); await phase(p, 'awaiting-start'); await count(p, 0);
    r.radiusEnter = await snapshot(p);
    await replace(p, 'x', '-7'); await replace(p, 'y', '4,5');
    await press(p, 'Enter'); await phase(p, 'awaiting-end');
    await replace(p, 'x', '-13'); await replace(p, 'y', '4,5');
    const sweepInput = field(p, 'sweep');
    assert.equal(await sweepInput.evaluate((e) => e.readOnly && e.tabIndex === -1), true);
    const c = [-10, 0.5], start = Math.atan2(4, 3), sweep = Math.PI - 2 * start;
    r.previewPath = await pathGeometry(p.locator('[data-testid="sketch-arc-ghost"]'), c, 20, start, sweep);
    // Synthetic DOM guard, not an operating-system IME session.
    r.composing = { method: 'synthetic DOM keydown', before: await snapshot(p) };
    await field(p, 'y').dispatchEvent('keydown', { key: 'Enter', code: 'Enter',
      isComposing: true, bubbles: true, cancelable: true });
    r.composing.after = await snapshot(p); assert.deepEqual(r.composing.after, r.composing.before);
    assert.equal(r.composing.after.entities, 0);
    await screenshot(p, 'numeric-projected-preview');
    await press(p, 'Enter'); const overlay = await waitSolvedOverlay(p, 1, 'numeric Arc');
    await resetState(p, 1); r.focusAfterEnter = await editorFocus(p);
    const visual = overlay.locator('path[data-sketch-entity-id]');
    r.originalLiveId = await visual.getAttribute('data-sketch-entity-id');
    r.originalLivePath = await pathGeometry(visual, c, 20, start, sweep);
    // No click or helper refocus before the first Undo.
    await press(p, 'Control+z'); await count(p, 0);
    await press(p, 'Control+y'); await waitSolvedOverlay(p, 1, 'Arc Redo');
    assert.equal(await visual.getAttribute('data-sketch-entity-id'), r.originalLiveId);
    const saved = await saveLocalDocument(p), [arc] = arcs(saved, 1);
    assert.equal(arc.id, r.originalLiveId); geometry(arc.data, c, 20, start, sweep);
    r.rawCoordinates = { center: c, start: [-7, 4.5], end: [-13, 4.5] };
    r.effectiveEndpoints = { start: [2, 16.5], end: [-22, 16.5] };
    r.savedAfterRedo = intent(saved);
    await reopenFirstSketch(p, 1); const reopenedOverlay = await waitSolvedOverlay(p, 1, 'Arc Open');
    assert.equal(await reopenedOverlay.locator('path[data-sketch-entity-id]').getAttribute('data-sketch-entity-id'), arc.id);
    r.reopened = intent(await saveLocalDocument(p)); assert.deepEqual(r.reopened, r.savedAfterRedo);
    r.historyCounts = { undo: 0, redo: 1, reopened: 1 };
    await screenshot(p, 'numeric-reopened'); await assertSketchOnlyWasm(p, r.id);
  });

  await run('pointer-sweep-repeat', async (p, r) => {
    // Independent expected geometry; production projection is never imported.
    const corpus = [
      { id: 'cw-quarter', c: [-5, 0], a: 0, moves: [-45, -90], canonical: 270, sweep: 90 },
      { id: 'ccw-major', c: [4, 5], a: 0, moves: [60, 120, 180, 240, 270], canonical: 0, sweep: 270 },
      { id: 'cw-major', c: [-4, -5], a: 0, moves: [-60, -120, -180, -240, -270], canonical: 90, sweep: 270 },
      { id: 'ccw-wrap', c: [8, -6], a: 350, moves: [355, 365, 370], canonical: 350, sweep: 20 },
      { id: 'full-turn-clamped', c: [0, 0], a: 0, moves: [60, 120, 180, 240, 300, 360], canonical: 0,
        sweep: 360 - 0.01 * 180 / Math.PI },
    ];
    r.sweeps = [];
    for (const [i, entry] of corpus.entries()) {
      const pick = (a, radius) => [entry.c[0] + radius * Math.cos(rad(a)), entry.c[1] + radius * Math.sin(rad(a))];
      await point(p, entry.c); await phase(p, 'awaiting-start'); await keys(p, '30');
      await point(p, pick(entry.a, 30)); await phase(p, 'awaiting-end');
      for (const angle of entry.moves) await point(p, pick(angle, 37), 'move');
      const magnitude = Number((await field(p, 'sweep').inputValue()).replace(',', '.'));
      near(magnitude, entry.sweep, 0.6, 'displayed sweep magnitude');
      const preview = await pathGeometry(p.locator('[data-testid="sketch-arc-ghost"]'), entry.c, 30, rad(entry.canonical), rad(entry.sweep));
      await count(p, i); await point(p, pick(entry.moves.at(-1), 37));
      await waitSolvedOverlay(p, i + 1, entry.id); await resetState(p, i + 1);
      const saved = await saveLocalDocument(p), arc = arcs(saved, i + 1).at(-1);
      geometry(arc.data, entry.c, 30, rad(entry.canonical), rad(entry.sweep));
      r.sweeps.push({ ...entry, rawEnd: pick(entry.moves.at(-1), 37), magnitude, preview, saved: arc });
    }
    const saved = await saveLocalDocument(p);
    await point(p, [-25, 15]); await phase(p, 'awaiting-start'); await point(p, [-15, 25], 'move');
    await count(p, corpus.length); await press(p, 'Escape'); await resetState(p, corpus.length);
    await press(p, 'Escape'); await p.locator(S).waitFor({ state: 'detached' });
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(saved));
    r.saved = intent(saved); await assertSketchOnlyWasm(p, r.id);
  });

  await run('invalid-and-cancel', async (p, r, baseline) => {
    await replace(p, 'x', '-'); await press(p, 'Enter'); await phase(p, 'awaiting-center'); await count(p, 0);
    await point(p, [0, 0]); await phase(p, 'awaiting-start'); r.invalidRadius = [];
    for (const text of ['0', '-1', '-', '', '1e309']) {
      await replace(p, 'radius', text);
      assert.equal(await field(p, 'radius').getAttribute('aria-invalid'), 'true');
      assert.equal(await p.locator(P + ' [data-param-commit]').isEnabled(), false);
      await press(p, 'Enter'); await point(p, [20, 0]); await phase(p, 'awaiting-start'); await count(p, 0);
      r.invalidRadius.push({ text, entities: 0 });
    }
    await replace(p, 'radius', '0'); await press(p, ',');
    assert.equal(await field(p, 'radius').inputValue(), '0,'); await press(p, '5');
    r.decimal = await field(p, 'radius').inputValue(); assert.equal(r.decimal, '0,5');
    await p.getByRole('button', { name: 'Снять фиксацию радиуса', exact: true }).click();
    assert.equal(await p.locator(P).getAttribute('data-radius-locked'), 'false');
    await point(p, [0, 0]); await phase(p, 'awaiting-start'); await count(p, 0);
    await point(p, [20, 0]); await phase(p, 'awaiting-end');
    for (const invalid of [[0, 0], [20, 0], [20, 0.01]]) {
      await point(p, invalid); await phase(p, 'awaiting-end'); await count(p, 0);
    }
    await replace(p, 'x', '-'); await press(p, 'Enter'); await phase(p, 'awaiting-end'); await count(p, 0);
    await press(p, 'Escape'); await resetState(p, 0); r.focusAfterEscape = await editorFocus(p);
    await point(p, [4, 3]); await phase(p, 'awaiting-start'); await keys(p, '20');
    await press(p, 'Escape'); await resetState(p, 0); await press(p, 'Escape');
    await p.locator(S).waitFor({ state: 'detached' });
    r.saved = intent(await saveLocalDocument(p)); assert.deepEqual(r.saved, intent(baseline));
    // A single Undo must still remove the initial Sketch, with no extra invalid-input frame.
    await press(p, 'Control+z'); await p.getByText('Эскиз 1', { exact: true }).waitFor({ state: 'detached' });
    assert.equal((await saveLocalDocument(p)).sketches.length, 0);
    await press(p, 'Control+y'); await p.getByText('Эскиз 1', { exact: true }).waitFor();
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(baseline)); r.invalidHistoryFrames = 0;
    await assertNoWasm(p, r.id);
  });
} finally {
  await browser.close(); report.browserClosed = !browser.isConnected();
  report.status = report.cases.length === 3 && report.cases.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL';
  if (out) fs.writeFileSync(path.join(out, 'numeric-arc-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
assert.equal(report.status, 'PASS', 'U2 numeric Arc browser regression failed');
