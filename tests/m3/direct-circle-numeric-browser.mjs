import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoPageErrors, assertNoWasm, assertSketchOnlyWasm, createXYSketch, interactionBox,
  launchM3Browser, near, newDesktopPage, reopenFirstSketch, saveLocalDocument,
  shellUrl, squarePoint, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const S = '[data-testid="cad-sketch-interaction"][data-tool="circle"]';
const P = '[data-testid="sketch-circle-numeric"]', O = '[data-testid="cad-sketch-overlay"]';
const out = process.env.ASA_U2_CIRCLE_EVIDENCE_DIR;
assert.ok(![8094, 8098, 8099].includes(Number(new URL(shellUrl).port)), 'Protected origin');
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await launchM3Browser();
const report = { suite: 'U2 numeric Circle', url: shellUrl, browser: browser.version(), cases: [] };
const field = (p, key) => p.locator(P + ' input[data-circle-field="' + key + '"]');
const phase = (p, value) => p.locator(S + '[data-circle-phase="' + value + '"]').waitFor();
const count = (p, n) => p.locator(O + '[data-entity-count="' + n + '"]').waitFor();
const press = (p, key) => p.keyboard.press(key);
async function keys(p, text) { for (const key of text) await press(p, key); }
async function replace(p, key, text) {
  await field(p, key).click(); await press(p, 'Control+A');
  if (text) await keys(p, text); else await press(p, 'Backspace');
}
async function point(p, world, action = 'click') {
  const { box } = await interactionBox(p, 'circle');
  const pick = squarePoint(box, 0.5 + world[0] / 100, 0.5 - world[1] / 100);
  await p.mouse[action](pick.x, pick.y);
}
async function input(p, key) {
  return field(p, key).evaluate((e) => ({ text: e.value, focused: e === document.activeElement,
    selection: [e.selectionStart, e.selectionEnd] }));
}
async function snapshot(p) {
  return p.locator(S).evaluate((layer) => ({
    phase: layer.getAttribute('data-circle-phase'),
    entities: Number(document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')),
    fields: [...document.querySelectorAll('[data-testid="sketch-circle-numeric"] input')]
      .map((e) => [e.getAttribute('data-circle-field'), e.value]),
    locked: document.querySelector('[data-testid="sketch-circle-numeric"]')?.getAttribute('data-diameter-locked'),
    focusedField: document.activeElement?.getAttribute('data-circle-field'),
  }));
}
async function resetState(p, n) {
  await phase(p, 'awaiting-center'); await count(p, n);
  assert.equal(await p.locator(P).getAttribute('data-diameter-locked'), 'false');
  assert.equal(await p.locator('[data-testid="sketch-circle-center"]').count(), 0);
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
function circles(doc, n) {
  assert.equal(doc.sketches.length, 1); assert.equal(doc.sketches[0].support, 'XY');
  const result = doc.sketches[0].entities;
  assert.equal(result.length, n); assert.ok(result.every((e) => e.type === 'circle'));
  assert.deepEqual([doc.constraints, doc.dimensions], [[], []], 'Diameter lock is transient U2 input');
  return result;
}
function geometry(data, c, d) {
  for (let i = 0; i < 2; i++) near(data.center[i], c[i], 0.15, 'center');
  near(data.diameter, d, 1e-3, 'diameter');
}
async function run(id, body) {
  const { page: p, errors } = await newDesktopPage(browser);
  p.setDefaultTimeout(15_000); const r = { id, status: 'FAIL' }; report.cases.push(r);
  try {
    await p.goto(shellUrl, { waitUntil: 'networkidle' }); await createXYSketch(p);
    const baseline = await saveLocalDocument(p);
    await p.locator('.k-command-ribbon [data-command-id="sketch.circle"]').click();
    await p.locator('.k-management-panel ' + P).waitFor(); await resetState(p, 0);
    await body(p, r, baseline); assertNoPageErrors(errors, id); r.status = 'PASS';
  } catch (error) {
    r.error = String(error.stack ?? error); await screenshot(p, id + '-failure').catch(() => {});
  } finally { r.pageErrors = errors; await p.close(); }
}

try {
  await run('coordinates-diameter-keyboard-history', async (p, r) => {
    await replace(p, 'x', '-10'); await replace(p, 'y', '0,5');
    assert.equal(await field(p, 'y').inputValue(), '0,5');
    await press(p, 'Enter'); await phase(p, 'awaiting-point');
    // Immediate typing, without pointer movement: first digit enters Diameter.
    await keys(p, '24'); r.immediate = await input(p, 'diameter');
    assert.deepEqual(r.immediate, { text: '24', focused: true, selection: [2, 2] });
    await press(p, 'Tab'); await press(p, 'Shift+Tab');
    assert.deepEqual((await input(p, 'diameter')).selection, [0, 2]);
    await keys(p, '30'); r.tabReplacement = await field(p, 'diameter').inputValue();
    assert.equal(r.tabReplacement, '30'); await press(p, 'Control+A'); await keys(p, '24');
    await screenshot(p, 'numeric-locked-preview');
    await press(p, 'Enter');
    // Direct Circle exits the command after the one accepted mutation.
    await p.locator(S).waitFor({ state: 'detached' }); await count(p, 1);
    r.focusAfterEnter = await editorFocus(p);
    // No click or helper refocus before the first Undo.
    await press(p, 'Control+z'); await count(p, 0);
    await press(p, 'Control+y'); await waitSolvedOverlay(p, 1, 'Circle Redo');
    const overlay = p.locator(O);
    assert.equal(await overlay.locator('circle[data-sketch-entity-id]').count(), 1);
    const saved = await saveLocalDocument(p), [circle] = circles(saved, 1);
    const liveId = await overlay.locator('circle[data-sketch-entity-id]').getAttribute('data-sketch-entity-id');
    assert.equal(circle.id, liveId); geometry(circle.data, [-10, 0.5], 24);
    r.rawCoordinates = { center: [-10, 0.5], diameter: 24 };
    r.savedAfterRedo = intent(saved);
    await reopenFirstSketch(p, 1); const reopened = await waitSolvedOverlay(p, 1, 'Circle Open');
    assert.equal(await reopened.locator('circle[data-sketch-entity-id]').getAttribute('data-sketch-entity-id'), circle.id);
    r.reopened = intent(await saveLocalDocument(p)); assert.deepEqual(r.reopened, r.savedAfterRedo);
    r.historyCounts = { undo: 0, redo: 1, reopened: 1 };
    await screenshot(p, 'numeric-reopened'); await assertSketchOnlyWasm(p, r.id);
  });

  await run('pointer-repeat', async (p, r) => {
    const corpus = [
      { id: 'left', c: [-5, -5], d: 20 },
      { id: 'upper', c: [6, 4], d: 16 },
      { id: 'origin', c: [0, 0], d: 24 },
    ];
    r.circles = [];
    for (const [i, entry] of corpus.entries()) {
      await p.locator('.k-command-ribbon [data-command-id="sketch.circle"]').click();
      await p.locator('.k-management-panel ' + P).waitFor(); await resetState(p, i);
      const edge = [entry.c[0] + entry.d / 2, entry.c[1]];
      await point(p, entry.c); await phase(p, 'awaiting-point');
      await point(p, edge, 'move');
      const ghost = p.locator('[data-testid="sketch-circle-ghost"]');
      await ghost.waitFor();
      near(Number(await ghost.getAttribute('r')), entry.d / 2, 0.8, 'ghost radius');
      await p.locator('[data-testid="sketch-circle-radius-line"]').waitFor({ state: 'attached' });
      await count(p, i);
      await point(p, edge);
      await p.locator(S).waitFor({ state: 'detached' });
      await waitSolvedOverlay(p, i + 1, entry.id);
      const saved = await saveLocalDocument(p), circle = circles(saved, i + 1).at(-1);
      geometry(circle.data, entry.c, entry.d);
      r.circles.push({ ...entry, saved: circle });
    }
    const saved = await saveLocalDocument(p);
    await p.locator('.k-command-ribbon [data-command-id="sketch.circle"]').click();
    await p.locator('.k-management-panel ' + P).waitFor();
    await point(p, [-25, 15]); await phase(p, 'awaiting-point');
    await count(p, corpus.length); await press(p, 'Escape'); await resetState(p, corpus.length);
    await press(p, 'Escape'); await p.locator(S).waitFor({ state: 'detached' });
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(saved));
    r.saved = intent(saved); await assertSketchOnlyWasm(p, r.id);
  });

  await run('invalid-and-cancel', async (p, r, baseline) => {
    await replace(p, 'x', '-'); await press(p, 'Enter'); await phase(p, 'awaiting-center'); await count(p, 0);
    await point(p, [0, 0]); await phase(p, 'awaiting-point'); r.invalidDiameter = [];
    for (const text of ['0', '-1', '-', '', '1e309']) {
      await replace(p, 'diameter', text);
      assert.equal(await field(p, 'diameter').getAttribute('aria-invalid'), 'true');
      assert.equal(await p.locator(P + ' [data-param-commit]').isEnabled(), false);
      await press(p, 'Enter'); await point(p, [20, 0]); await phase(p, 'awaiting-point'); await count(p, 0);
      r.invalidDiameter.push({ text, entities: 0 });
    }
    await replace(p, 'diameter', '0'); await press(p, ',');
    assert.equal(await field(p, 'diameter').inputValue(), '0,'); await press(p, '5');
    r.decimal = await field(p, 'diameter').inputValue(); assert.equal(r.decimal, '0,5');
    await p.getByRole('button', { name: 'Снять фиксацию диаметра', exact: true }).click();
    assert.equal(await p.locator(P).getAttribute('data-diameter-locked'), 'false');
    // The unlock button disables on release and drops focus; restore editor focus through the panel.
    await field(p, 'x').click();
    await press(p, 'Escape'); await resetState(p, 0); r.focusAfterEscape = await editorFocus(p);
    await point(p, [4, 3]); await phase(p, 'awaiting-point'); await keys(p, '20');
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

  await run('parametric-origin-fallback', async (p, r, baseline) => {
    // Protected Part flow: Diameter without a chosen center creates the
    // origin Circle plus its driving diameter dimension.
    assert.equal(await field(p, 'diameter').inputValue(), '12', 'panel shows the last accepted diameter');
    await p.locator(P + ' [data-param-commit]').click();
    await p.getByText('Окружность Ø12 мм создана', { exact: true }).waitFor();
    await p.locator(S).waitFor({ state: 'detached' });
    const overlay = p.locator(O);
    assert.equal(await overlay.locator('circle[data-sketch-entity-id]').count(), 1);
    const saved = await saveLocalDocument(p);
    assert.equal(saved.sketches.length, 1);
    const entity = saved.sketches[0].entities;
    assert.equal(entity.length, 1); assert.equal(entity[0].type, 'circle');
    near(entity[0].data.center[0], 0, 0.2, 'origin center x');
    near(entity[0].data.center[1], 0, 0.2, 'origin center y');
    near(entity[0].data.diameter, 12, 1e-5, 'driven diameter');
    assert.equal(saved.dimensions.length, 1);
    r.dimension = saved.dimensions[0];
    assert.equal(r.dimension.name, 'diameter');
    assert.deepEqual(intent(saved).sketches, saved.sketches);
    // Two accepted mutations (Circle, then driving dimension) -> two Undo frames.
    await press(p, 'Control+z'); await press(p, 'Control+z');
    await p.locator(O + '[data-entity-count="0"]').waitFor();
    const afterUndo = await saveLocalDocument(p);
    assert.deepEqual(intent(afterUndo), intent(baseline));
    await press(p, 'Control+y'); await press(p, 'Control+y');
    await waitSolvedOverlay(p, 1, 'parametric Redo');
    assert.deepEqual(intent(await saveLocalDocument(p)), intent(saved));
    r.fallback = { entity: entity[0], dimension: saved.dimensions[0], redone: true };
    await assertSketchOnlyWasm(p, r.id);
  });
} finally {
  await browser.close(); report.browserClosed = !browser.isConnected();
  report.status = report.cases.length === 4 && report.cases.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL';
  if (out) fs.writeFileSync(path.join(out, 'numeric-circle-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
assert.equal(report.status, 'PASS', 'U2 numeric Circle browser regression failed');
