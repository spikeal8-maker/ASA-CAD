import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/m2/part-browser.mjs';
let source = readFileSync(path, 'utf8');

function replaceExact(before, after, label) {
  if (!source.includes(before)) throw new Error(`M3.1 browser codemod missing ${label}`);
  source = source.replace(before, after);
}

replaceExact(
`async function loadedWasmResources() {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\\.wasm(?:\\?|$)/i.test(name)),
  );
}
`,
`async function loadedWasmResources() {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\\.wasm(?:\\?|$)/i.test(name)),
  );
}

function isPlaneGcsWasm(name) {
  return /planegcs/i.test(name);
}

function nonPlaneGcsWasm(names) {
  return names.filter((name) => !isPlaneGcsWasm(name));
}
`,
'WASM classification helpers',
);

replaceExact(
`  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded while creating an empty sketch');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();`,
`  assert.deepEqual(await loadedWasmResources(), [], 'Any CAD WASM loaded while creating an empty sketch');
  const emptyOverlay = page.locator('[data-testid="cad-sketch-overlay"]');
  await emptyOverlay.waitFor();
  assert.equal(await emptyOverlay.getAttribute('data-overlay-source'), 'document');
  assert.equal(await emptyOverlay.getAttribute('data-entity-count'), '0');

  await page.getByRole('button', { name: /Прямоугольник/i }).click();`,
'empty Sketch overlay assertion',
);

replaceExact(
`  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded during 2D rectangle authoring');

  await finishSketch();`,
`  const solveStatus = page.locator('[data-testid="sketch-solve-status"][data-solve-status="solved"]');
  await solveStatus.waitFor({ timeout: 60_000 });
  const solvedOverlay = page.locator('[data-testid="cad-sketch-overlay"]');
  await solvedOverlay.waitFor();
  assert.equal(await solvedOverlay.getAttribute('data-overlay-source'), 'solver-preview');
  assert.equal(await solvedOverlay.getAttribute('data-entity-count'), '4');
  assert.equal(await page.locator('[data-testid="sketch-dof"]').textContent(), 'DoF: н/д');

  const sketchWasm = await loadedWasmResources();
  assert.ok(sketchWasm.some(isPlaneGcsWasm), 'PlaneGCS WASM was not loaded for active Sketch solve: ' + sketchWasm.join(', '));
  assert.deepEqual(nonPlaneGcsWasm(sketchWasm), [], 'OpenCascade/other WASM loaded during Sketch solve: ' + sketchWasm.join(', '));

  await finishSketch();
  await page.locator('[data-testid="cad-sketch-overlay"]').waitFor({ state: 'detached' });`,
'active Sketch solver assertion',
);

replaceExact(
`  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded before the solid command was committed');`,
`  assert.deepEqual(nonPlaneGcsWasm(await loadedWasmResources()), [], 'OpenCascade WASM loaded before the solid command was committed');`,
'pre-solid OpenCascade assertion',
);

replaceExact(
`  const loadedWasm = await loadedWasmResources();
  assert.ok(loadedWasm.length >= 1, 'OpenCascade WASM was not loaded for the first solid operation');
  assert.ok(wasmRequests.length >= 1, 'No WASM network request was observed');`,
`  const loadedWasm = await loadedWasmResources();
  assert.ok(loadedWasm.some(isPlaneGcsWasm), 'PlaneGCS WASM disappeared after solid operation');
  assert.ok(nonPlaneGcsWasm(loadedWasm).length >= 1, 'OpenCascade WASM was not loaded for the first solid operation: ' + loadedWasm.join(', '));
  assert.ok(wasmRequests.some(isPlaneGcsWasm), 'No PlaneGCS WASM network request was observed');
  assert.ok(nonPlaneGcsWasm(wasmRequests).length >= 1, 'No OpenCascade WASM network request was observed');`,
'post-solid WASM assertion',
);

replaceExact(
"  console.log(`  ✓ lazy WASM: ${loadedWasm.length} resource(s), first solid only`);",
"  console.log('  ✓ lazy kernels: PlaneGCS in Sketch, OpenCascade first solid (' + loadedWasm.length + ' WASM resource(s))');",
'WASM console message',
);

writeFileSync(path, source);
console.log('M3.1 protected Part browser regression updated');
