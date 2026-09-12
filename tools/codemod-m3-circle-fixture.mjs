import fs from 'node:fs';

if (fs.readFileSync('src/browser/routes.ts', 'utf8').includes("  'circle',")) {
  console.log('Circle fixture codemod already applied');
  process.exit(0);
}

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 120)}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceOnce(
  'src/browser/routes.ts',
  `  'line',\n  'extrude',`,
  `  'line',\n  'circle',\n  'extrude',`,
);

replaceOnce(
  'src/web/devFixtures.ts',
  `async function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {`,
  `async function buildCircleSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create circle sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create circle sketch');\n  await execute(\n    app,\n    { id: 'sketch.circle', payload: { sketchId, center: [12, -6], diameter: 24 } },\n    'Create direct circle fixture',\n  );\n  return sketchId;\n}\n\nasync function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {`,
);

replaceOnce(
  'src/web/devFixtures.ts',
  `  if (name === 'extrude') {`,
  `  if (name === 'circle') {\n    const activeSketchId = await buildCircleSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture circle: одна прямая окружность Ø24 мм в XY',\n      activeSketchId,\n    };\n  }\n\n  if (name === 'extrude') {`,
);

replaceOnce(
  'tests/m3/direct-circle-browser.mjs',
  `async function desktopDirectCircle() {`,
  `async function deterministicCircleFixture() {\n  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });\n  const errors = [];\n  const wasm = [];\n  page.on('pageerror', (error) => errors.push(error.message));\n  page.on('request', (request) => {\n    if (/\\.wasm(?:\\?|$)/i.test(request.url())) wasm.push(request.url());\n  });\n\n  const fixtureUrl = new URL('/dev/part/circle', url).toString();\n  const response = await page.goto(fixtureUrl, { waitUntil: 'networkidle' });\n  assert.ok(response?.ok(), \`Circle fixture navigation failed: ${'${response?.status()}' }\`);\n  await page.locator('.cad-app[data-dev-fixture="circle"][data-fixture-status="ready"]').waitFor();\n  await page.getByText('Fixture circle: одна прямая окружность Ø24 мм в XY', { exact: true }).waitFor();\n  const overlay = page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="1"]');\n  await overlay.waitFor({ timeout: 20_000 });\n  const circle = overlay.locator('circle[data-sketch-entity-id]').first();\n  near(Number(await circle.getAttribute('cx')), 12, 0.05, 'fixture center x');\n  near(Number(await circle.getAttribute('cy')), 6, 0.05, 'fixture center svg-y');\n  near(Number(await circle.getAttribute('r')), 12, 0.05, 'fixture radius');\n  assert.ok(wasm.some(isPlaneGcs), 'Circle fixture did not exercise PlaneGCS');\n  assert.deepEqual(wasm.filter((name) => !isPlaneGcs(name)), [], 'Circle fixture loaded OpenCascade');\n  assert.deepEqual(errors, [], \`Circle fixture page errors: ${'${errors.join(\' | \')}' }\`);\n  await page.close();\n  console.log('  ✓ /dev/part/circle deterministic direct-Circle review fixture');\n}\n\nasync function desktopDirectCircle() {`,
);

replaceOnce(
  'tests/m3/direct-circle-browser.mjs',
  `  console.log('\\nASA-CAD M3.3 direct Circle browser');\n  await desktopDirectCircle();`,
  `  console.log('\\nASA-CAD M3.3 direct Circle browser');\n  await deterministicCircleFixture();\n  await desktopDirectCircle();`,
);

console.log('M3.3 Circle deterministic fixture codemod applied');
