import assert from 'node:assert/strict';

/** Scoped browser acceptance: native-like Fusion Sketch layout and state, never other editors. */
export async function runFusionSketch005({step, create, page, artifacts, homeButton, leave, atHome, stored}) {
  let sketchId = '';
  let projectId = '';

  await step('Fusion Sketch 005: Browser groups remain independent and active sketch selected', async () => {
    projectId = await create('fusion', 'Fusion Sketch 005 — визуальная приёмка');
    const browser = page.locator('.fusion-browser-tree');
    await browser.waitFor();
    for (const group of ['component', 'settings', 'views', 'origin', 'sketches']) {
      assert.equal(await browser.locator('[data-tree-branch="'+group+'"]').count(), 1,
        'Missing native Browser section '+group);
    }
    assert.match(await browser.locator('[data-tree-node="document-units"]').textContent() ?? '', /мм/);
    await page.getByRole('button', {name: /Создать эскиз/i}).click();
    await browser.locator('[data-plane-id="XY"]').click();
    await page.locator('.live-workarea[data-workspace="sketch"]').waitFor();
    sketchId = (await page.locator('.cad-app').getAttribute('data-active-sketch-id')) ?? '';
    assert.match(sketchId, /^sketch_/);
    await browser.locator('[data-tree-branch="sketches"]').waitFor();
    await browser.locator('[data-sketch-branch-id="'+sketchId+'"] .tree-sketch-header.selected').waitFor();
    assert.equal(await browser.locator('[data-tree-disclosure="origin"]').getAttribute('aria-expanded'), 'false',
      'Origin should auto-collapse while keeping Sketches separate');
    assert.equal(await browser.locator('[data-plane-id="XY"]').count(), 0);
    assert.equal(await browser.locator('[data-sketch-branch-id="'+sketchId+'"]').count(), 1,
      'Collapsing Origin incorrectly hid the active sketch');
    await browser.locator('[data-tree-disclosure="origin"]').click();
    assert.equal(await browser.locator('[data-plane-id="XY"]').count(), 1);
    await browser.locator('[data-tree-disclosure="origin"]').click();
    assert.equal(await browser.locator('[data-sketch-branch-id="'+sketchId+'"]').count(), 1);
    assert.equal(await page.locator('.live-sketch-cube').getAttribute('data-sketch-plane'), 'XY');
    assert.equal(await page.locator('.live-sketch-cube').getAttribute('data-projection'), 'orthographic');
  });

  await step('Fusion Sketch 005: 1920 and 1366 layout, ribbon and palette remain accessible', async () => {
    for (const [width, height] of [[1920,1080],[1366,768]]) {
      await page.setViewportSize({width,height});
      await page.locator('.live-sketch-ribbon').waitFor();
      const geometry = await page.evaluate(() => {
        const box = selector => {
          const node = document.querySelector(selector);
          if (!node) throw new Error('Missing '+selector);
          const r = node.getBoundingClientRect();
          return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        };
        return {
          screen: {width:innerWidth,height:innerHeight},
          tree:box('.live-tree'),
          palette:box('.live-sketch-palette'),
          footer:box('.live-sketch-palette .sketch-palette-content>footer'),
          finish:box('.live-sketch-ribbon .live-sketch-finish'),
          ribbon:box('.live-sketch-ribbon'),
          panel:box('.live-sketch-ribbon .live-sketch-scroll'),
          pageWidth:document.documentElement.scrollWidth,
          underconstrained:document.querySelector('[data-constraint-state]')?.getAttribute('data-constraint-state'),
        };
      });
      assert.ok(geometry.tree.left>=0 && geometry.tree.right<geometry.palette.left,
        'Browser overlaps palette: '+JSON.stringify(geometry));
      assert.ok(geometry.palette.right<=width+1 && geometry.palette.bottom<=height+1,
        'Sketch Palette is cut off: '+JSON.stringify(geometry));
      assert.ok(geometry.footer.bottom<=geometry.palette.bottom+1,
        'Palette footer is clipped: '+JSON.stringify(geometry));
      assert.ok(geometry.finish.width>70 && geometry.finish.right<=width+1
        && geometry.finish.left>=geometry.ribbon.left,
        'Finish Sketch is outside visible ribbon: '+JSON.stringify(geometry));
      assert.ok(geometry.panel.right<=geometry.finish.left+1,
        'Ribbon buttons overlap Finish Sketch: '+JSON.stringify(geometry));
      assert.ok(geometry.pageWidth<=width+2,
        'Unexpected document horizontal overflow: '+JSON.stringify(geometry));
      assert.equal(await page.locator('.live-sketch-palette [data-palette-command="sketch.finish"]').isEnabled(), true);
      assert.equal(await page.locator('.live-sketch-ribbon .live-sketch-tool[data-command-id="sketch.line"]').first().isEnabled(), true);
      await page.screenshot({path:artifacts+'/fusion-sketch-005-'+width+'x'+height+'.png',fullPage:true});
    }
    await page.setViewportSize({width:1600,height:1000});
  });

  await step('Fusion Sketch 005: finish, tree double-click reopen and same camera normal', async () => {
    await page.locator('.live-sketch-palette [data-palette-command="sketch.finish"]').click();
    await page.locator('.live-workarea[data-workspace="solid"]').waitFor();
    const browser = page.locator('.fusion-browser-tree');
    await browser.locator('[data-sketch-id="'+sketchId+'"]').dblclick();
    await page.locator('.live-workarea[data-workspace="sketch"]').waitFor();
    assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'), sketchId);
    await browser.locator('[data-sketch-branch-id="'+sketchId+'"] .tree-sketch-header.selected').waitFor();
    assert.equal(await page.locator('.live-sketch-cube').getAttribute('data-sketch-plane'), 'XY');
    assert.equal(await page.locator('.live-sketch-cube').getAttribute('data-projection'), 'orthographic');
    await page.locator('.live-sketch-palette [data-palette-command="sketch.finish"]').click();
    await page.locator('.live-workarea[data-workspace="solid"]').waitFor();
    await homeButton().click();
    await leave().getByRole('button', {name:'Сохранить и выйти',exact:true}).click();
    await atHome();
    const saved = await stored(projectId);
    assert.equal(saved.document.sketches.length,1);
    assert.equal(saved.document.sketches[0].id,sketchId);
  });
}
