import assert from 'node:assert/strict';
import { assertVisibleTouchTarget, entityScreenPoint } from './M3BrowserHarness.mjs';

export async function rectangleLineIds(page) {
  const lines = page.locator('[data-testid="cad-sketch-overlay"] line[data-sketch-entity-id]');
  assert.equal(await lines.count(), 4);
  const first = await lines.nth(0).getAttribute('data-sketch-entity-id');
  const second = await lines.nth(1).getAttribute('data-sketch-entity-id');
  assert.ok(first && second && first !== second);
  return { first, second };
}

export async function chooseAngularLines(page, first, second, touch = false) {
  const surface = page.locator('[data-testid="cad-sketch-interaction"][data-tool="dimension.angular"]');
  await surface.waitFor();
  assert.equal(await surface.getAttribute('data-angular-line-count'), '4');
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
  assert.equal(document.sketches[0]?.entities.length, 4, 'Angular must not create geometry');
  assert.equal(document.constraints.length, 0, 'Angular must not create constraints');
  assert.equal(document.dimensions.length, 1, 'Apply must create exactly one Dimension');
  const dimension = document.dimensions[0];
  assert.equal(dimension.type, 'angular');
  assert.deepEqual(dimension.entityIds, [first, second]);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  return dimension;
}
