import assert from 'node:assert/strict';

/** Browser-only acceptance against the real Fusion mode and shared CAD document. */
export async function runFusionSketchTools({ page, step, create, homeButton, leave, atHome, stored, artifacts }) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const projectId = await create('fusion', 'Fusion Sketch 004 — реальные инструменты');
  await step('Sketch tools: select XY and enter the real Sketch workspace', async () => {
    await page.getByRole('button', { name: /Создать эскиз/i }).click();
    await page.locator('.tree-row[data-plane-id="XY"]').click();
    await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
    await page.locator('.live-sketch-field[data-sketch-support="XY"]').waitFor();
  });
  const sketchId = await page.locator('.cad-app').getAttribute('data-active-sketch-id');
  assert.match(sketchId ?? '', /^sketch_/);
  const frame = await page.locator('.live-sketch-field').boundingBox();
  assert.ok(frame);
  const at = (u, v) => ({ x: Math.round(frame.x + u * frame.width), y: Math.round(frame.y + v * frame.height) });
  const total = () => page.locator('[data-tree-sketch-entity-id]').count();
  const awaitCount = expected => page.waitForFunction(value =>
    document.querySelectorAll('[data-tree-sketch-entity-id]').length >= value, expected, { timeout: 25000 });
  const tool = name => page.locator('.live-sketch-ribbon [data-command-id="' + name + '"]').first();

  await step('Sketch tools: create a real Line by mouse', async () => {
    await tool('sketch.line').click();
    const start = at(.40, .25), end = at(.45, .31);
    await page.mouse.click(start.x, start.y);
    await page.locator('[data-testid="sketch-line-anchor"]').waitFor();
    await page.mouse.move(end.x, end.y);
    await page.mouse.click(end.x, end.y);
    await awaitCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });
  await step('Sketch tools: create four Rectangle edges', async () => {
    await tool('sketch.rectangle').click();
    const first = at(.54, .22), opposite = at(.63, .36);
    await page.mouse.click(first.x, first.y);
    await page.mouse.move(opposite.x, opposite.y);
    await page.locator('[data-testid="sketch-rectangle-ghost-edge"]').first().waitFor({ state: 'attached' });
    await page.mouse.click(opposite.x, opposite.y);
    await awaitCount(5);
  });
  await step('Sketch tools: create a real Circle', async () => {
    await tool('sketch.circle').click();
    const center = at(.67, .50), edge = at(.71, .57);
    await page.mouse.click(center.x, center.y);
    await page.locator('[data-testid="sketch-circle-center"]').waitFor();
    await page.mouse.move(edge.x, edge.y);
    await page.mouse.click(edge.x, edge.y);
    await awaitCount(6);
  });
  await step('Sketch tools: create center-start-end Arc from native submenu', async () => {
    await page.locator('.live-sketch-ribbon [data-sketch-group="SketchCreatePanel"]').click();
    await page.locator('.live-sketch-menu [data-native-dropdown="ArcDropDown"]').click();
    await page.locator('.live-sketch-menu [data-native-menu-command="ArcCenterTwoPoint"]').click();
    const center = at(.35, .62), start = at(.40, .62), end = at(.35, .69);
    await page.mouse.click(center.x, center.y);
    await page.locator('[data-testid="sketch-arc-center"]').waitFor();
    await page.mouse.click(start.x, start.y);
    await page.mouse.move(end.x, end.y);
    await page.locator('[data-testid="sketch-arc-ghost"]').waitFor();
    await page.mouse.click(end.x, end.y);
    await awaitCount(7);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.live-workarea')?.dataset.activeCommand === '');
  });
  await step('Sketch tools: apply real driving Linear dimension', async () => {
    const line = page.locator('.cad-sketch-selection-layer [data-sketch-select-id]').first();
    const id = await line.getAttribute('data-sketch-select-id');
    assert.ok(id);
    await line.click({ force: true });
    await page.locator('.live-sketch-field[data-selected-sketch-entity-id="' + id + '"]').waitFor();
    await page.locator('.live-sketch-ribbon [data-sketch-group="SketchCreatePanel"]').click();
    const dimension = page.locator('.live-sketch-menu [data-native-menu-command="SketchDimension"]');
    assert.equal(await dimension.isEnabled(), true);
    await dimension.click();
    const parameters = page.locator('.live-sketch-palette .live-parameters[data-command="dimension.linear"]');
    await parameters.waitFor();
    await parameters.getByRole('spinbutton', { name: 'Размер' }).fill('40');
    await parameters.locator('button.live-commit').click();
    await page.locator('[data-sketch-dimension-id]').first().waitFor();
  });
  await step('Sketch tools: Horizontal constraint, Undo and Redo', async () => {
    const line = page.locator('.cad-sketch-selection-layer [data-sketch-select-id]').first();
    const id = await line.getAttribute('data-sketch-select-id');
    await line.click({ force: true });
    await page.locator('.live-sketch-field[data-selected-sketch-entity-id="' + id + '"]').waitFor();
    const before = await page.locator('[data-sketch-constraint-id]').count();
    await page.locator('.live-sketch-ribbon [data-sketch-group="SketchConstraintsPanel"]').click();
    await page.locator('.live-sketch-menu [data-native-menu-command="ConstraintHorizontalVertical"]').first().click();
    const horizontal = page.locator('.live-sketch-menu [data-command-id="constraint.horizontal"]').first();
    assert.equal(await horizontal.isEnabled(), true);
    await horizontal.click();
    await page.waitForFunction(count => document.querySelectorAll('[data-sketch-constraint-id]').length > count, before);
    const applied = await page.locator('[data-sketch-constraint-id]').count();
    await page.locator('.live-quickbuttons [data-command-id="system.undo"]').click();
    await page.waitForFunction(count => document.querySelectorAll('[data-sketch-constraint-id]').length < count, applied);
    await page.locator('.live-quickbuttons [data-command-id="system.redo"]').click();
    await page.waitForFunction(count => document.querySelectorAll('[data-sketch-constraint-id]').length === count, applied);
    await page.screenshot({ path: artifacts + '/fusion-sketch-004-real-geometry.png', fullPage: true });
  });
  await step('Sketch tools: persistent geometry, dimensions, constraints and reopen', async () => {
    await page.locator('.live-sketch-palette [data-palette-command="sketch.finish"]').click();
    await page.locator('.live-workarea[data-workspace="solid"]').waitFor();
    await homeButton().click();
    await leave().getByRole('button', { name: 'Сохранить и выйти', exact: true }).click();
    await atHome();
    const document = (await stored(projectId)).document;
    assert.deepEqual(document.sketches[0].entities.map(entity => entity.type),
      ['line', 'line', 'line', 'line', 'line', 'circle', 'arc']);
    assert.equal(document.dimensions.find(dimension => dimension.type === 'linear')?.value, 40);
    assert.ok(document.constraints.some(constraint => constraint.type === 'horizontal'));
    await page.getByRole('button', { name: 'Продолжить: Fusion Sketch 004 — реальные инструменты' }).click();
    await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
    await page.locator('[data-timeline-sketch="' + sketchId + '"]').click();
    await page.locator('.live-workarea[data-workspace="sketch"]').waitFor();
    assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), sketchId);
    await homeButton().click();
    await atHome();
    await page.setViewportSize({ width: 1600, height: 1000 });
  });
}
