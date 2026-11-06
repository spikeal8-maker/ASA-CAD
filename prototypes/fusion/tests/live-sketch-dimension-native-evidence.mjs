import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clickWorld, draw, idle, near, save, select, setDimension, solved, stage, startSketch, tool } from './live-sketch-actions-harness.mjs';

/** A comparable native scene, drawn through the public UI in its own temporary context. */
export async function captureNativeDimensionComparison(browser, url, screenshot) {
  const { page, errors } = await startSketch(browser, url);
  try {
    const bounds = await stage(page).boundingBox(), span = Number(await stage(page).getAttribute('data-sketch-view-span'));
    const targetScale = 5.344, desiredSpan = Math.min(bounds.width, bounds.height) / targetScale;
    const wheelDelta = Math.log(desiredSpan / span) / .0015;
    assert.ok(Math.abs(wheelDelta) < 600, 'One real wheel event stays inside the existing clamp');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, wheelDelta);
    await page.waitForFunction(span => Math.abs(Number(document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-sketch-view-span')) - span) < .0001, desiredSpan);

    const looseLineId = await draw(page, 'line', [[-50, -25], [-20, -20]]);
    await tool(page, 'sketch.rectangle').click();
    await clickWorld(page, [0, 0]); await clickWorld(page, [60, 40]);
    await solved(page, 5); await page.keyboard.press('Escape'); await idle(page);
    const drawn = await save(page), edges = drawn.sketches[0].entities.filter(entity => entity.id !== looseLineId);
    const bottom = edges.find(entity => Math.abs(entity.data.from[1]) < .025 && Math.abs(entity.data.to[1]) < .025);
    const right = edges.find(entity => Math.abs(entity.data.from[0] - 60) < .025 && Math.abs(entity.data.to[0] - 60) < .025);
    assert.ok(bottom && right);
    await select(page, bottom.id); await setDimension(page, 'dimension.linear', 60);
    await select(page, right.id); await setDimension(page, 'dimension.linear', 40);
    const circleId = await draw(page, 'circle', [[30, 20], [36, 20]]);
    await select(page, circleId); await setDimension(page, 'dimension.diameter', 12);
    const empty = await stage(page).locator('[data-sketch-layer="grid"]').evaluate(svg => {
      const point = new DOMPoint(70, 35).matrixTransform(svg.getScreenCTM()); return { x: point.x, y: point.y };
    });
    await page.mouse.click(empty.x, empty.y, { button: 'right' });
    await page.locator('.live-marking').waitFor(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[data-testid="part-model-stage"]')
      ?.getAttribute('data-selected-sketch-entity-id') === '');
    const document = await save(page), entities = document.sketches[0].entities;
    assert.equal(entities.length, 6);
    assert.deepEqual(document.dimensions.map(dimension => dimension.value).sort((a, b) => a - b), [12, 40, 60]);
    const expectedLines = [[[-50, -25], [-20, -20]], [[0, 0], [60, 0]], [[60, 0], [60, 40]],
      [[60, 40], [0, 40]], [[0, 40], [0, 0]]];
    const matches = (a, b) => a.every((value, index) => Math.abs(value - b[index]) < .025);
    for (const [from, to] of expectedLines) assert.ok(entities.some(entity => entity.type === 'line'
      && ((matches(entity.data.from, from) && matches(entity.data.to, to))
        || (matches(entity.data.to, from) && matches(entity.data.from, to)))), 'Actual native line exists in the saved document');
    const circle = entities.find(entity => entity.id === circleId);
    assert.ok(matches(circle.data.center, [30, 20])); near(circle.data.diameter, 12, 'Actual native circle diameter', .025);
    const camera = await stage(page).evaluate(host => {
      const svg = host.querySelector('[data-sketch-layer="grid"]'), matrix = svg.getScreenCTM();
      const origin = new DOMPoint(0, 0).matrixTransform(matrix);
      return { span: Number(host.getAttribute('data-sketch-view-span')), pixelsPerMm: Math.hypot(matrix.a, matrix.b),
        origin: [origin.x, origin.y], center: host.getAttribute('data-sketch-view-center').split(',').map(Number) };
    });
    near(camera.pixelsPerMm, targetScale, 'Real wheel reaches the measured native scale', .0001);
    near(camera.origin[0], 1024, 'Comparable scene origin X', .01);
    near(camera.origin[1], 606, 'Comparable scene origin Y', 2);
    const dimensions = await page.locator('[data-sketch-dimension-id]').evaluateAll(nodes => nodes.map(group => {
      const text = group.querySelector('text');
      return { value: Number(group.getAttribute('data-dimension-value')), presentation: group.getAttribute('data-dimension-presentation'),
        text: [...text.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(''),
        arrowTips: [...group.querySelectorAll('[data-dimension-arrow]')].map(arrow => {
          const local = arrow.points.getItem(0), point = new DOMPoint(local.x, local.y).matrixTransform(arrow.getScreenCTM());
          return [point.x, point.y];
        }) };
    }));
    const nativeFile = 'fusion-parity-native-linear-dimensions-2048-dpi110.png';
    const nativeSha256 = createHash('sha256').update(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../evidence', nativeFile))).digest('hex');
    assert.equal(nativeSha256, 'c3711aa63e440bbea8d32bbad31c970466081e42f52866918d894c7e3ebfa269');
    await page.mouse.move(1640, 190); await screenshot(page, 'native-paired-2048');
    assert.deepEqual(errors, []);
    return { native: { file: nativeFile, sha256: nativeSha256, client: [2048, 1137], dpi: 110 },
      candidate: { file: 'fusion-live-sketch-dimensions-native-paired-2048.png', viewport: [2048, 1137], dpr: await page.evaluate(() => devicePixelRatio) },
      input: 'Real pointer geometry, native dimensions and public mouse wheel', wheelDelta, camera, dimensions,
      documentGeometryMatchesNative: true, visualParityAccepted: false,
      differences: ['Native FRONT/Y-up versus existing XY TOP/Z-up',
        'Native auto constraints and per-entity fully-constrained black are not synthesized',
        'Shared profile analyzer rejects a scene with a loose ordinary line; native fills its closed rectangle',
        'Automatic annotation offset is 54 CSS px; the native height was placed at 56 px'] };
  } catch (error) {
    await screenshot(page, 'native-paired-debug').catch(() => {}); throw error;
  } finally { await page.close(); }
}
