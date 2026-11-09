import assert from 'node:assert/strict';
import { runFusionSketchTools } from './fusion-sketch-004-tools.mjs';

export async function runFusionSketch004({ step, create, page, artifacts, homeButton, leave, atHome, stored }) {
  await step('Fusion Sketch 004: selecting XY/XZ/YZ opens and reopens real sketches', async () => {
    const id = await create('fusion', 'Fusion Sketch 004 — CI support selection');
    const sketchIds = [];
    for (const [index, plane] of ['XY', 'XZ', 'YZ'].entries()) {
      await page.getByRole('button', { name: /Создать эскиз/i }).click();
      if (plane === 'XZ') {
        await page.getByRole('combobox', { name: 'Плоскость эскиза' }).selectOption('XZ');
      } else {
        await page.locator('.tree-row[data-plane-id="' + plane + '"]').click();
      }
      // The selection itself must commit the real CAD sketch: no parameters OK.
      await page.locator('.cad-app[data-sketch-count="' + (index + 1) + '"]').waitFor();
      await page.locator('.live-workarea[data-workspace="sketch"]').waitFor();
      await page.locator('.live-sketch-field[data-sketch-support="' + plane + '"]').waitFor();
      const active = await page.locator('.cad-app').getAttribute('data-active-sketch-id');
      assert.match(active ?? '', /^sketch_/);
      sketchIds.push(active);
      await page.locator('.tree-sketch-branch[data-sketch-branch-id="' + active + '"] .tree-sketch-header.selected').waitFor();
      await page.locator('.live-sketch-palette').waitFor();
      if (index === 0) {
        // Actual native Fusion 2706.1.17 on D2-R2: 1920x1080 and 1366x768.
        for (const [width, height, expectedX, expectedY] of [
          [1920, 1080, 1619, 316],
          [1366, 768, 1065, 264],
        ]) {
          await page.setViewportSize({ width, height });
          const palette = await page.locator('.live-sketch-palette').boundingBox();
          const treeBox = await page.locator('.live-tree').boundingBox();
          assert.ok(palette && treeBox, 'Sketch palette and browser must remain visible');
          assert.ok(Math.abs(palette.x - expectedX) <= 6 && Math.abs(palette.y - expectedY) <= 6,
            'Fusion Sketch palette differs from native reference at ' + width + 'x' + height + ': ' + JSON.stringify(palette));
          assert.ok(Math.abs(treeBox.x - 13) <= 3,
            'Fusion Sketch browser differs from native reference: ' + JSON.stringify(treeBox));
          await page.screenshot({ path: artifacts + '/fusion-sketch-004-' + width + 'x' + height + '.png', fullPage: true });
        }
        await page.setViewportSize({ width: 1600, height: 1000 });
      }
      assert.equal(await page.locator('.live-parameters[data-command="part.sketch.create"]').count(), 0,
        'support selection must not leave an uncommitted Sketch dialog');
      await page.locator('.live-sketch-palette [data-palette-command="sketch.finish"]').click();
      await page.locator('.live-workarea[data-workspace="solid"]').waitFor();
    }
    assert.equal(new Set(sketchIds).size, 3);
    await page.locator('[data-timeline-sketch="' + sketchIds[0] + '"]').click();
    await page.locator('.live-workarea[data-workspace="sketch"]').waitFor();
    await page.locator('.live-sketch-field[data-sketch-support="XY"]').waitFor();
    assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), sketchIds[0]);
    await page.screenshot({ path: artifacts + '/04-fusion-sketch-reopen.png', fullPage: true });
    await homeButton().click();
    await leave().getByRole('button', { name: 'Сохранить и выйти', exact: true }).click();
    await atHome();
    const saved = await stored(id);
    assert.equal(saved.document.sketches.length, 3);
    assert.deepEqual(saved.document.sketches.map(sketch => sketch.id), sketchIds);
  });
  await runFusionSketchTools({ step, create, page, artifacts, homeButton, leave, atHome, stored });
}
