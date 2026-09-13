const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceExact(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one anchor, found ${count}\nANCHOR:\n${before}`);
  write(path, source.replace(before, after));
}

// Part workspace: own transient Rectangle tool while preserving numeric/driving fallback.
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "import { useSketchArcTool } from './useSketchArcTool';\n",
  "import { useSketchArcTool } from './useSketchArcTool';\nimport { useSketchRectangleTool } from './useSketchRectangleTool';\n",
);
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "  const circleTool = useSketchCircleTool({\n",
  "  const rectangleTool = useSketchRectangleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.rectangle',\n    setNotice,\n    onCommitted: (width, height) => {\n      setRectangleWidth(width);\n      setRectangleHeight(height);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n  const circleTool = useSketchCircleTool({\n",
);
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "  function beginRectangle() {\n    if (!sketch) return;\n    setActiveCommand('sketch.rectangle');\n    setPanel('parameters');\n    clearTransientSelection();\n    setNotice('Задайте ширину и высоту прямоугольника');\n  }\n",
  "  function beginRectangle() {\n    if (!sketch) return;\n    rectangleTool.reset();\n    setActiveCommand('sketch.rectangle');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите первый угол прямоугольника');\n  }\n",
);
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n",
  "    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.rectangle') rectangleTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n",
);
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "    if (activeCommand === 'part.sketch.create') return commitCreateSketch();\n    if (activeCommand === 'sketch.rectangle') return commitRectangle();\n    if (activeCommand === 'sketch.circle') {\n",
  "    if (activeCommand === 'part.sketch.create') return commitCreateSketch();\n    if (activeCommand === 'sketch.rectangle') {\n      if (rectangleTool.draft.first) return rectangleTool.commitPreview();\n      return commitRectangle();\n    }\n    if (activeCommand === 'sketch.circle') {\n",
);
replaceExact(
  'src/web/usePartSketchWorkspace.ts',
  "    handleSketchLinePointMove: lineTool.move,\n    handleSketchLinePoint: lineTool.point,\n    circleDraft: circleTool.draft,\n",
  "    handleSketchLinePointMove: lineTool.move,\n    handleSketchLinePoint: lineTool.point,\n    rectangleDraft: rectangleTool.draft,\n    rectangleCommitting: rectangleTool.committing,\n    handleSketchRectanglePointMove: rectangleTool.move,\n    handleSketchRectanglePoint: rectangleTool.point,\n    circleDraft: circleTool.draft,\n",
);

// Part stage: compose Rectangle-specific ghost layer over the shared input substrate.
replaceExact(
  'src/web/PartModelStage.tsx',
  "import type { SketchArcDraft } from './useSketchArcTool';\n",
  "import type { SketchArcDraft } from './useSketchArcTool';\nimport type { SketchRectangleDraft } from './useSketchRectangleTool';\n",
);
replaceExact(
  'src/web/PartModelStage.tsx',
  "import { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';\n",
  "import { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';\nimport { SketchRectangleInteractionLayer } from './viewport/SketchRectangleInteractionLayer';\n",
);
replaceExact(
  'src/web/PartModelStage.tsx',
  "  onSketchLinePointMove(point: CadPoint2): void;\n  onSketchLinePoint(point: CadPoint2): void | Promise<void>;\n  circleDraft: SketchCircleDraft;\n",
  "  onSketchLinePointMove(point: CadPoint2): void;\n  onSketchLinePoint(point: CadPoint2): void | Promise<void>;\n  rectangleDraft: SketchRectangleDraft;\n  rectangleCommitting: boolean;\n  onSketchRectanglePointMove(point: CadPoint2): void;\n  onSketchRectanglePoint(point: CadPoint2): void | Promise<void>;\n  circleDraft: SketchCircleDraft;\n",
);
replaceExact(
  'src/web/PartModelStage.tsx',
  "        {sketchEditing && (\n          <SketchCircleInteractionLayer\n",
  "        {sketchEditing && (\n          <SketchRectangleInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.rectangle'}\n            draft={props.rectangleDraft}\n            committing={props.rectangleCommitting}\n            onPointMove={props.onSketchRectanglePointMove}\n            onPoint={props.onSketchRectanglePoint}\n          />\n        )}\n\n        {sketchEditing && (\n          <SketchCircleInteractionLayer\n",
);

// App: pass Rectangle tool state from focused workspace controller into stage.
replaceExact(
  'src/web/App.tsx',
  "    handleSketchLinePointMove,\n    handleSketchLinePoint,\n    circleDraft,\n",
  "    handleSketchLinePointMove,\n    handleSketchLinePoint,\n    rectangleDraft,\n    rectangleCommitting,\n    handleSketchRectanglePointMove,\n    handleSketchRectanglePoint,\n    circleDraft,\n",
);
replaceExact(
  'src/web/App.tsx',
  "                onSketchLinePointMove={handleSketchLinePointMove}\n                onSketchLinePoint={handleSketchLinePoint}\n                circleDraft={circleDraft}\n",
  "                onSketchLinePointMove={handleSketchLinePointMove}\n                onSketchLinePoint={handleSketchLinePoint}\n                rectangleDraft={rectangleDraft}\n                rectangleCommitting={rectangleCommitting}\n                onSketchRectanglePointMove={handleSketchRectanglePointMove}\n                onSketchRectanglePoint={handleSketchRectanglePoint}\n                circleDraft={circleDraft}\n",
);

// Deterministic direct Rectangle route and fixture, separate from dimensioned protected fixture.
replaceExact(
  'src/browser/routes.ts',
  "  'arc',\n  'extrude',\n",
  "  'arc',\n  'rectangle',\n  'extrude',\n",
);
replaceExact(
  'src/web/devFixtures.ts',
  "async function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {\n",
  "async function buildDirectRectangleSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create direct rectangle sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create direct rectangle sketch');\n  await execute(\n    app,\n    { id: 'sketch.rectangle', payload: { sketchId, origin: [-18, -10], width: 36, height: 20 } },\n    'Create direct rectangle fixture',\n  );\n  return sketchId;\n}\n\nasync function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {\n",
);
replaceExact(
  'src/web/devFixtures.ts',
  "  if (name === 'extrude') {\n",
  "  if (name === 'rectangle') {\n    const activeSketchId = await buildDirectRectangleSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture rectangle: прямоугольник 36×20 мм в XY',\n      activeSketchId,\n    };\n  }\n\n  if (name === 'extrude') {\n",
);

// Ghost styling only; persisted Rectangle remains four normal solver/persisted line entities.
replaceExact(
  'src/web/runtime.css',
  ".cad-sketch-line-anchor {\n",
  ".cad-sketch-rectangle-ghost {\n  fill: none;\n  stroke: var(--accent);\n  stroke-width: 1.4px;\n  stroke-dasharray: 4 3;\n  stroke-linecap: round;\n  opacity: .82;\n}\n\n.cad-sketch-line-anchor {\n",
);

// M3 static/browser gates.
replaceExact(
  'package.json',
  '"test:m3": "npm run test:m3:foundation && npm run test:m3:circle && npm run test:m3:arc-contract && npm run test:m3:arc-direct",',
  '"test:m3": "npm run test:m3:foundation && npm run test:m3:circle && npm run test:m3:arc-contract && npm run test:m3:arc-direct && npm run test:m3:rectangle-direct",',
);
replaceExact(
  'package.json',
  '"test:m3:arc-direct": "node tests/m3/direct-arc-boundary.mjs"',
  '"test:m3:arc-direct": "node tests/m3/direct-arc-boundary.mjs",\n    "test:m3:rectangle-direct": "node tests/m3/direct-rectangle-boundary.mjs"',
);
replaceExact(
  '.github/workflows/m3-browser.yml',
  "      - name: Show server log on failure\n",
  "      - name: Exercise M3 direct Rectangle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-rectangle-browser.mjs\n\n      - name: Show server log on failure\n",
);

// Preserve the old numeric 60x40 + driving dimensions protected Part proof explicitly.
replaceExact(
  'tests/m2/part-browser.mjs',
  "  await page.getByRole('button', { name: /Прямоугольник/i }).click();\n  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');\n",
  "  await page.getByRole('button', { name: /Прямоугольник/i }).click();\n  await page.locator('.content-area.panel-closed').waitFor();\n  await page.getByTitle('Параметры').click();\n  await page.locator('.parameter-panel').waitFor();\n  const width = page.locator('.numeric-field').filter({ hasText: 'Ширина' }).locator('input');\n",
);

console.log('M3.5 direct Rectangle wiring codemod applied successfully');
