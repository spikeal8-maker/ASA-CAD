import assert from 'node:assert/strict';
import {
  assertVisibleTouchTarget, entityScreenPoint, interactionBox, squarePoint,
} from './M3BrowserHarness.mjs';

export async function angularLinePairIds(page) {
  const lines = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]');
  assert.equal(await lines.count(), 2, 'Angular fixture must contain exactly two free Lines');
  const first = await lines.nth(0).getAttribute('data-sketch-entity-id');
  const second = await lines.nth(1).getAttribute('data-sketch-entity-id');
  assert.ok(first && second && first !== second);
  return { first, second };
}

export async function rectangleAdjacentLineIds(page) {
  const lines = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]');
  assert.equal(await lines.count(), 4, 'Rectangle fixture must contain four Lines');
  const first = await lines.nth(0).getAttribute('data-sketch-entity-id');
  const second = await lines.nth(1).getAttribute('data-sketch-entity-id');
  assert.ok(first && second && first !== second);
  return { first, second };
}

export async function drawSecondFreeLine(page, touch = false) {
  const { box } = await interactionBox(page, 'line', 'Angular second Line');
  const first = squarePoint(box, 0.25, 0.70);
  const second = squarePoint(box, 0.75, 0.25);
  if (touch) {
    await assertVisibleTouchTarget(page, first.x, first.y);
    await page.touchscreen.tap(first.x, first.y);
    await assertVisibleTouchTarget(page, second.x, second.y);
    await page.touchscreen.tap(second.x, second.y);
  } else {
    await page.mouse.click(first.x, first.y);
    await page.mouse.move(second.x, second.y);
    await page.mouse.click(second.x, second.y);
  }
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="2"]').waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"]').waitFor({ state: 'detached' });
}

export async function chooseAngularLines(page, first, second, touch = false, expectedLineCount = 2) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="dimension.angular"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-angular-line-count'), String(expectedLineCount));
  const firstPoint = await entityScreenPoint(page.locator(`[data-angular-line-id="${first}"]`));
  if (touch) {
    await assertVisibleTouchTarget(page, firstPoint.x, firstPoint.y);
    await page.touchscreen.tap(firstPoint.x, firstPoint.y);
  } else await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.locator(`[data-angular-line-id="${first}"][data-angular-selected="true"]`).waitFor({ state: 'attached' });
  assert.equal(await surface.getAttribute('data-angular-first'), first);

  const secondPoint = await entityScreenPoint(page.locator(`[data-angular-line-id="${second}"]`));
  if (touch) {
    await assertVisibleTouchTarget(page, secondPoint.x, secondPoint.y);
    await page.touchscreen.tap(secondPoint.x, secondPoint.y);
  } else await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.locator('.parameter-panel .panel-title-row strong').filter({ hasText: 'Угловой размер' }).waitFor();
  await surface.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-angular-dimension-a]').getAttribute('data-angular-dimension-a'), first);
  assert.equal(await page.locator('[data-angular-dimension-b]').getAttribute('data-angular-dimension-b'), second);
}

export async function solvedAngle(page, first, second) {
  return page.evaluate(({ first, second }) => {
    const vector = (id) => {
      const line = document.querySelector(`[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id="${id}"]`);
      if (!(line instanceof SVGLineElement)) throw new Error(`Missing Line ${id}`);
      return [
        Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
        Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
      ];
    };
    const a = vector(first), b = vector(second);
    return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) * 180 / Math.PI;
  }, { first, second });
}

export function assertAngular(document, first, second, value) {
  assert.equal(document.sketches[0]?.entities.length, 2, 'Angular must not create geometry');
  assert.equal(document.constraints.length, 0, 'Angular must not create constraints');
  assert.equal(document.dimensions.length, 1, 'Apply must create exactly one Dimension');
  const dimension = document.dimensions[0];
  assert.equal(dimension.type, 'angular');
  assert.deepEqual(dimension.entityIds, [first, second]);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  return dimension;
}
