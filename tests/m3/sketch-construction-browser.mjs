import assert from 'node:assert/strict';
import {
  activateMobileTool, assertNoPageErrors, assertSketchOnlyWasm, createMobileXYSketch,
  createXYSketch, entityScreenPoint, interactionBox, launchM3Browser, newDesktopPage,
  newTouchPage, reopenFirstSketch, saveLocalDocument, shellUrl, squarePoint, waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function createLine(page, touch) {
  if (touch) await activateMobileTool(page, 'sketch.line', 'Line');
  else await page.locator('.command-ribbon [data-command-id="sketch.line"]').click();
  const { box } = await interactionBox(page, 'line', 'Line');
  const a = squarePoint(box, 0.28, 0.38), b = squarePoint(box, 0.72, 0.62);
  if (touch) { await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y); }
  else { await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y); }
  await waitSolvedOverlay(page, 1, 'Construction source Line');
  const visual = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]').first();
  const id = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(id); return id;
}

async function selectLine(page, id, touch) {
  const visual = page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${id}"]`);
  const point = await entityScreenPoint(visual);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${id}"]`).waitFor();
}
async function assertConstruction(page, id, expected) {
  const visual = page.locator(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${id}"]`);
  await visual.waitFor();
  assert.equal(await visual.getAttribute('data-sketch-construction'), expected ? 'true' : 'false');
  const cls = await visual.getAttribute('class');
  assert.equal(cls?.includes('construction') ?? false, expected);
}

async function desktopConstruction() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    const id = await createLine(page, false);
    await selectLine(page, id, false);
    const search = page.getByRole('textbox', { name: 'Поиск команд' });
    await search.fill('Вспом');
    const action = page.locator('.command-search-results [data-command-id="sketch.construction"]');
    await action.waitFor(); assert.equal(await action.isEnabled(), true); await action.click();
    await assertConstruction(page, id, true);

    const saved = await saveLocalDocument(page);
    const line = saved.sketches[0].entities.find((item) => item.id === id);
    assert.equal(line?.data?.construction, true);
    await page.locator('.global-actions [data-command-id="system.undo"]').click();
    await assertConstruction(page, id, false);
    await page.locator('.global-actions [data-command-id="system.redo"]').click();
    await assertConstruction(page, id, true);
    await reopenFirstSketch(page, 1);
    await waitSolvedOverlay(page, 1, 'Construction reopen');
    await assertConstruction(page, id, true);
    await assertSketchOnlyWasm(page, 'desktop Construction');
    assertNoPageErrors(errors, 'desktop Construction');
    console.log('  ✓ desktop Construction: search -> selected Line toggle -> Undo/Redo -> Save/Open');
  } finally { await page.close(); }
}

async function touchConstruction() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(shellUrl, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    const id = await createLine(page, true);
    await selectLine(page, id, true);
    await activateMobileTool(page, 'sketch.construction', 'Construction');
    await assertConstruction(page, id, true);
    const saved = await saveLocalDocument(page);
    assert.equal(saved.sketches[0].entities.find((item) => item.id === id)?.data?.construction, true);
    await assertSketchOnlyWasm(page, 'touch Construction');
    assertNoPageErrors(errors, 'touch Construction');
    console.log('  ✓ touch Construction: stable-ID Line tap -> shared mobile toggle');
  } finally { await context.close(); }
}

try {
  await desktopConstruction();
  await touchConstruction();
  console.log('ASA-CAD Construction browser PASS');
} finally { await browser.close(); }
