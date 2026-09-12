import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

let part = readFileSync('tests/m2/part-browser.mjs', 'utf8');
part = replaceExact(
  part,
`  assert.equal(await emptyOverlay.getAttribute('data-overlay-source'), 'document');
  assert.equal(await emptyOverlay.getAttribute('data-entity-count'), '0');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();`,
`  assert.equal(await emptyOverlay.getAttribute('data-overlay-source'), 'document');
  assert.equal(await emptyOverlay.getAttribute('data-entity-count'), '0');

  // M3.2 direct Line: pointer state is transient, second click is one normal
  // sketch.line application mutation, and one Undo must remove the whole line.
  await page.getByRole('button', { name: /^Отрезок$/ }).click();
  const lineLayer = page.locator('[data-testid="sketch-line-interaction-layer"]');
  await lineLayer.waitFor();
  assert.equal(await lineLayer.getAttribute('data-line-state'), 'awaiting-first-point');
  const lineBox = await lineLayer.boundingBox();
  assert.ok(lineBox && lineBox.width > 300 && lineBox.height > 200, 'Line workplane has no usable desktop bounds');
  await lineLayer.click({ position: { x: lineBox.width * 0.38, y: lineBox.height * 0.55 } });
  await page.locator('[data-testid="sketch-line-ghost"]').waitFor();
  assert.equal(await lineLayer.getAttribute('data-line-state'), 'awaiting-second-point');
  await page.mouse.move(lineBox.x + lineBox.width * 0.62, lineBox.y + lineBox.height * 0.42);
  await lineLayer.click({ position: { x: lineBox.width * 0.62, y: lineBox.height * 0.42 } });
  await page.getByText(/Отрезок создан; укажите первую точку следующего отрезка/).waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor({ timeout: 30_000 });
  await page.locator('[data-testid="sketch-solve-status"][data-solve-status="solved"]').waitFor({ timeout: 30_000 });

  await page.locator('.cad-app').focus();
  await page.keyboard.press('Control+z');
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.keyboard.press('Control+y');
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor();
  await page.keyboard.press('Control+z');
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.keyboard.press('Escape');
  await lineLayer.waitFor({ state: 'detached' });
  assert.deepEqual(nonPlaneGcsWasm(await loadedWasmResources()), [], 'OpenCascade WASM loaded during direct Line authoring');
  console.log('  ✓ direct Line ghost + one-step Undo/Redo through CadApplication');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();`,
  'desktop direct Line insertion',
);
writeFileSync('tests/m2/part-browser.mjs', part);

let mobile = readFileSync('tests/m2/mobile-tools-browser.mjs', 'utf8');
mobile = replaceExact(
  mobile,
`async function wasmResources() {
  return page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\\.wasm(?:\\?|$)/i.test(name)));
}
`,
`async function wasmResources() {
  return page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\\.wasm(?:\\?|$)/i.test(name)));
}

function nonPlaneGcsWasm(names) {
  return names.filter((name) => !/planegcs/i.test(name));
}
`,
  'mobile WASM classifier',
);
mobile = replaceExact(
  mobile,
`  const rectangle = tools.locator('[data-command-id="sketch.rectangle"]');
  const circle = tools.locator('[data-command-id="sketch.circle"]');
  const finish = tools.locator('[data-command-id="sketch.finish"]');
  assert.equal(await rectangle.isEnabled(), true, 'Sketch Rectangle must be enabled in mobile Sketch tools');
  assert.equal(await circle.isEnabled(), true, 'Sketch Circle must be enabled in mobile Sketch tools');
  assert.equal(await finish.isEnabled(), true, 'Finish Sketch must be enabled in mobile Sketch tools');

  await rectangle.click();`,
`  const line = tools.locator('[data-command-id="sketch.line"]');
  const rectangle = tools.locator('[data-command-id="sketch.rectangle"]');
  const circle = tools.locator('[data-command-id="sketch.circle"]');
  const finish = tools.locator('[data-command-id="sketch.finish"]');
  assert.equal(await line.isEnabled(), true, 'Sketch Line must be enabled through the shared mobile action');
  assert.equal(await rectangle.isEnabled(), true, 'Sketch Rectangle must be enabled in mobile Sketch tools');
  assert.equal(await circle.isEnabled(), true, 'Sketch Circle must be enabled in mobile Sketch tools');
  assert.equal(await finish.isEnabled(), true, 'Finish Sketch must be enabled in mobile Sketch tools');

  await line.tap();
  const lineLayer = page.locator('[data-testid="sketch-line-interaction-layer"]');
  await lineLayer.waitFor();
  const lineBox = await lineLayer.boundingBox();
  assert.ok(lineBox && lineBox.width > 200 && lineBox.height > 250, 'mobile Line workplane is not usable');
  await lineLayer.tap({ position: { x: lineBox.width * 0.35, y: lineBox.height * 0.55 } });
  await page.locator('[data-testid="sketch-line-ghost"]').waitFor();
  await lineLayer.tap({ position: { x: lineBox.width * 0.65, y: lineBox.height * 0.42 } });
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]').waitFor({ timeout: 30_000 });
  assert.deepEqual(nonPlaneGcsWasm(await wasmResources()), [], 'touch Line path loaded OpenCascade');

  await toolsTab.tap();
  await tools.waitFor();
  await tools.locator('[data-command-id="system.undo"]').tap();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.keyboard.press('Escape');
  console.log('  ✓ shared mobile Line action commits by two taps and undoes in one step');

  await toolsTab.tap();
  await tools.waitFor();
  await rectangle.tap();`,
  'mobile direct Line touch flow',
);
mobile = replaceExact(
  mobile,
`  assert.deepEqual(await wasmResources(), [], 'mobile 2D command path eagerly loaded OpenCascade');`,
`  assert.deepEqual(nonPlaneGcsWasm(await wasmResources()), [], 'mobile 2D command path eagerly loaded OpenCascade');`,
  'mobile post-Line WASM assertion',
);
writeFileSync('tests/m2/mobile-tools-browser.mjs', mobile);

console.log('M3.2 desktop + touch Line browser regressions applied');
