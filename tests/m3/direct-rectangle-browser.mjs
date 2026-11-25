import assert from 'node:assert/strict';
import {
  activateMobileTool,
  assertNoPageErrors,
  assertNoWasm,
  assertSketchOnlyWasm,
  createMobileXYSketch,
  createXYSketch,
  interactionBox,
  launchM3Browser,
  near,
  newDesktopPage,
  newTouchPage,
  openFixture,
  reopenFirstSketch,
  saveLocalDocument,
  shellUrl,
  squarePoint,
  waitSolvedOverlay,
} from './M3BrowserHarness.mjs';

const browser = await launchM3Browser();

async function waitSolvedRectangle(page, size) {
  const overlay = await waitSolvedOverlay(page, 4, 'direct Rectangle');
  assert.equal(await overlay.locator('line[data-sketch-entity-id]').count(), 4, 'Rectangle overlay must contain four persisted/solved edges');
  const bounds = await overlay.locator('line[data-sketch-entity-id]').evaluateAll((nodes) =>
    ['x', 'y'].map((axis) => {
      const points = nodes.flatMap((node) => [1, 2].map((end) => Number(node.getAttribute(axis + end))));
      return [Math.min(...points), Math.max(...points)];
    }));
  if (size) size.forEach((value, axis) => near(bounds[axis][1] - bounds[axis][0], value, 0.9, 'solved Rectangle span'));
  return {
    x: bounds[0], y: bounds[1], entityCount: Number(await overlay.getAttribute('data-entity-count')),
    identity: {
      sketchId: await overlay.getAttribute('data-sketch-id'),
      support: await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'),
      entityIds: await overlay.locator('line[data-sketch-entity-id]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-sketch-entity-id')).sort()),
    },
  };
}

function rectangleIntent(document) {
  return Object.fromEntries([
    'documentId', 'kind', 'schemaVersion', 'engineVersion', 'units',
    'sketches', 'constraints', 'dimensions', 'features', 'stableReferences',
  ].map((key) => [key, document[key]]));
}

async function deterministicRectangleFixture() {
  const { page } = await openFixture(browser, 'rectangle', 4);
  try {
    await page.getByText('Fixture rectangle: прямоугольник 36×20 мм в XY', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-testid="part-model-stage"]').getAttribute('data-sketch-support'), 'XY');
    await assertSketchOnlyWasm(page, 'Rectangle fixture');
  } finally {
    await page.close();
  }
  console.log('  ✓ /dev/part/rectangle deterministic review fixture');
}

async function desktopDirectRectangle() {
  const { page, errors } = await newDesktopPage(browser);
  try {
    await page.goto(new URL('cad/', shellUrl).href, { waitUntil: 'networkidle' });
    await createXYSketch(page);
    await assertNoWasm(page, 'empty Sketch');

    const rectangleButton = page.locator('[data-command-id="sketch.rectangle"]').first();
    assert.equal(await rectangleButton.isEnabled(), true, 'Rectangle action must be enabled in active Sketch');
    await rectangleButton.click();
    await page.locator('.k-content[data-panel-tab="params"]').waitFor();

    const { layer, box } = await interactionBox(page, 'rectangle', 'Rectangle');
    assert.equal(await layer.getAttribute('data-rectangle-phase'), 'awaiting-first');
    const first = squarePoint(box, 0.80, 0.30);
    const invalidSameX = squarePoint(box, 0.80, 0.70);
    const opposite = squarePoint(box, 0.20, 0.70);

    await page.mouse.click(first.x, first.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-rectangle-phase="awaiting-opposite"]').waitFor();
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle first corner mutated persisted Sketch');

    await page.mouse.move(invalidSameX.x, invalidSameX.y);
    await page.mouse.click(invalidSameX.x, invalidSameX.y);
    await page.getByText('Ширина и высота прямоугольника должны быть больше нуля', { exact: true }).waitFor();
    assert.equal(await layer.getAttribute('data-rectangle-phase'), 'awaiting-opposite', 'invalid opposite corner must keep Rectangle tool active');
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'invalid Rectangle committed geometry');

    await page.mouse.move(opposite.x, opposite.y);
    const ghostEdges = page.locator('[data-testid="sketch-rectangle-ghost-edge"]');
    await ghostEdges.first().waitFor({ state: 'attached' });
    assert.equal(await ghostEdges.count(), 4, 'Rectangle preview must be exactly four transient edges');
    assert.equal(await page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'), '0', 'Rectangle ghost mutated persisted Sketch');

    await page.mouse.click(opposite.x, opposite.y);
    await page.getByText(/Прямоугольник 60(?:\.0)?×40(?:\.0)? мм создан/).waitFor();
    await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
    const originalBounds = await waitSolvedRectangle(page, [60, 40]);
    await assertSketchOnlyWasm(page, 'direct Rectangle');
    const original = rectangleIntent(await saveLocalDocument(page));
    assert.equal(original.kind, 'part');
    assert.equal(original.sketches[0].support, 'XY');

    await page.locator('[data-command-id="system.undo"]').click();
    const undone = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]');
    await undone.waitFor();
    const undoEntityCount = Number(await undone.getAttribute('data-entity-count'));
    await page.locator('[data-command-id="system.redo"]').click();
    const redoneBounds = await waitSolvedRectangle(page, [60, 40]);

    const document = await saveLocalDocument(page);
    const redone = rectangleIntent(document);
    assert.deepEqual(redone, original, 'Undo/Redo changed Rectangle intent/IDs');
    const sketch = document.sketches[0];
    const edges = sketch?.entities.filter((item) => item.type === 'line' && /^rectangle-edge-/.test(item.data.role ?? '')) ?? [];
    assert.equal(edges.length, 4, 'saved direct Rectangle must contain four rectangle edges');
    assert.equal(document.dimensions.length, 0, 'direct Rectangle must not silently add driving dimensions');

    const xs = edges.flatMap((edge) => [edge.data.from[0], edge.data.to[0]]);
    const ys = edges.flatMap((edge) => [edge.data.from[1], edge.data.to[1]]);
    near(Math.min(...xs), -30, 0.9, 'saved Rectangle min x');
    near(Math.max(...xs), 30, 0.9, 'saved Rectangle max x');
    near(Math.min(...ys), -20, 0.9, 'saved Rectangle min y');
    near(Math.max(...ys), 20, 0.9, 'saved Rectangle max y');

    await reopenFirstSketch(page, 4);
    const reopenedBounds = await waitSolvedRectangle(page, [60, 40]);
    const reopened = rectangleIntent(await saveLocalDocument(page));
    assert.deepEqual(reopened, original, 'Save/Open changed Rectangle intent/IDs');
    assertNoPageErrors(errors, 'desktop direct Rectangle');
    const solvedBounds = { original: originalBounds, redone: redoneBounds, reopened: reopenedBounds };
    const { id: sketchId, support, entities } = original.sketches[0];
    for (const [phase, view] of Object.entries(solvedBounds)) {
      assert.deepEqual(view.identity, { sketchId, support, entityIds: entities.map((entity) => entity.id).sort() }, phase + ' live identity');
    }
    console.log('RECTANGLE_ACCEPTANCE ' + JSON.stringify({
      expected: { width: 60, height: 40, support: 'XY' }, original, redone, reopened,
      undoEntityCount, redoEntityCount: redoneBounds.entityCount, reopenedEntityCount: reopenedBounds.entityCount, solvedBounds,
    }));
  } finally {
    await page.close();
  }
  console.log('  ✓ desktop Rectangle: first/opposite -> four-edge ghost -> normalized one mutation -> solver -> undo/redo -> save/reopen');
}

async function touchDirectRectangle() {
  const { context, page, errors } = await newTouchPage(browser);
  try {
    await page.goto(new URL('cad/', shellUrl).href, { waitUntil: 'networkidle' });
    await createMobileXYSketch(page);
    await activateMobileTool(page, 'sketch.rectangle', 'Rectangle');

    const { box } = await interactionBox(page, 'rectangle', 'Rectangle');
    const first = squarePoint(box, 0.35, 0.38);
    const opposite = squarePoint(box, 0.65, 0.62);
    await page.touchscreen.tap(first.x, first.y);
    await page.locator('[data-testid="cad-sketch-interaction"][data-rectangle-phase="awaiting-opposite"]').waitFor();
    await page.touchscreen.tap(opposite.x, opposite.y);
    await waitSolvedRectangle(page);

    assertNoPageErrors(errors, 'touch direct Rectangle');
    console.log('  ✓ touch Rectangle: shared two-tap surface commits one normalized Rectangle without desktop DOM delegation');
  } finally {
    await context.close();
  }
}

try {
  console.log('\nASA-CAD M3.5 direct Rectangle browser');
  await deterministicRectangleFixture();
  await desktopDirectRectangle();
  await touchDirectRectangle();
  console.log('ASA-CAD M3.5 direct Rectangle browser PASS\n');
} finally {
  await browser.close();
}
