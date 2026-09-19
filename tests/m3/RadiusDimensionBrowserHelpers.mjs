import assert from 'node:assert/strict';
import { entityScreenPoint } from './M3BrowserHarness.mjs';

export const field = (page) => page.locator('.parameter-panel .numeric-field input');
export const apply = (page) => page.locator('.parameter-actions button.primary');
export const title = (page) => page.locator('.parameter-panel .panel-title-row strong');

export async function selectEntity(page, selector, touch = false) {
  const visual = page.locator(`[data-testid="cad-sketch-overlay"] ${selector}[data-sketch-entity-id]`).first();
  await visual.waitFor({ state: 'attached' });
  const id = await visual.getAttribute('data-sketch-entity-id');
  assert.ok(id);
  const point = await entityScreenPoint(visual);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await page.locator(`.cad-app[data-selected-sketch-entity-id="${id}"]`).waitFor();
  return id;
}

export async function circleDiameter(page, id) {
  const circle = page.locator(`[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id="${id}"]`);
  return Number(await circle.getAttribute('r')) * 2;
}

export async function arcRadius(page, id) {
  return page.locator(`[data-testid="cad-sketch-overlay"] path[data-sketch-entity-id="${id}"]`).evaluate((node) => {
    const match = (node.getAttribute('d') ?? '').match(/\bA\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)/);
    if (!match) throw new Error('Expected solved Arc path');
    return Number(match[1]);
  });
}

export function assertRadius(saved, entityId, value, entityType) {
  assert.equal(saved.schemaVersion, 3);
  assert.deepEqual(saved.dimensions.map((item) => item.type), ['radius']);
  assert.equal(saved.sketches[0]?.entities.length, 1);
  assert.equal(saved.sketches[0]?.entities[0]?.type, entityType);
  assert.equal(saved.constraints.length, 0);
  const dimension = saved.dimensions[0];
  assert.deepEqual(dimension.entityIds, [entityId]);
  assert.equal(dimension.value, value);
  assert.equal(dimension.driving, true);
  return dimension;
}
