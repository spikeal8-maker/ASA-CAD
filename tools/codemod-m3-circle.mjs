import fs from 'node:fs';

const alreadyApplied = fs.existsSync('src/web/useSketchCircleTool.ts')
  && fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8').includes('circleDraft: circleTool.draft');
if (alreadyApplied) {
  console.log('M3.3 Circle codemod already applied');
  process.exit(0);
}

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 100)}`);
  const next = source.replace(from, to);
  if (next === source) throw new Error(`No change produced for ${path}`);
  fs.writeFileSync(path, next);
}

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  "import { useSketchLineTool } from './useSketchLineTool';",
  "import { useSketchLineTool } from './useSketchLineTool';\nimport { useSketchCircleTool } from './useSketchCircleTool';",
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  const lineTool = useSketchLineTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.line',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`,
  `  const lineTool = useSketchLineTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.line',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  function beginCircle() {\n    if (!sketch) return;\n    setActiveCommand('sketch.circle');\n    setPanel('parameters');\n    clearTransientSelection();\n    setNotice('Задайте диаметр окружности');\n  }`,
  `  function beginCircle() {\n    if (!sketch) return;\n    circleTool.reset();\n    setActiveCommand('sketch.circle');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр окружности');\n  }`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  function cancelCommand() {\n    if (activeCommand === 'sketch.line') lineTool.reset();`,
  `  function cancelCommand() {\n    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    if (activeCommand === 'sketch.rectangle') return commitRectangle();\n    if (activeCommand === 'sketch.circle') return commitCircle();`,
  `    if (activeCommand === 'sketch.rectangle') return commitRectangle();\n    if (activeCommand === 'sketch.circle') {\n      if (circleTool.draft.center) return circleTool.commitPreview();\n      return commitCircle();\n    }`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    handleSketchLinePointMove: lineTool.move,\n    handleSketchLinePoint: lineTool.point,\n    beginCreateSketch,`,
  `    handleSketchLinePointMove: lineTool.move,\n    handleSketchLinePoint: lineTool.point,\n    circleDraft: circleTool.draft,\n    circleCommitting: circleTool.committing,\n    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    beginCreateSketch,`,
);

replaceOnce(
  'src/web/PartModelStage.tsx',
  `import type { SketchLineDraft } from './useSketchLineTool';\nimport { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';`,
  `import type { SketchLineDraft } from './useSketchLineTool';\nimport type { SketchCircleDraft } from './useSketchCircleTool';\nimport { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';\nimport { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';`,
);

replaceOnce(
  'src/web/PartModelStage.tsx',
  `  onSketchLinePointMove(point: CadPoint2): void;\n  onSketchLinePoint(point: CadPoint2): void | Promise<void>;\n}`,
  `  onSketchLinePointMove(point: CadPoint2): void;\n  onSketchLinePoint(point: CadPoint2): void | Promise<void>;\n  circleDraft: SketchCircleDraft;\n  circleCommitting: boolean;\n  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n}`,
);

replaceOnce(
  'src/web/PartModelStage.tsx',
  `        {sketchEditing && (\n          <SketchLineInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.line'}\n            draft={props.lineDraft}\n            committing={props.lineCommitting}\n            onPointMove={props.onSketchLinePointMove}\n            onPoint={props.onSketchLinePoint}\n          />\n        )}\n`,
  `        {sketchEditing && (\n          <SketchLineInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.line'}\n            draft={props.lineDraft}\n            committing={props.lineCommitting}\n            onPointMove={props.onSketchLinePointMove}\n            onPoint={props.onSketchLinePoint}\n          />\n        )}\n\n        {sketchEditing && (\n          <SketchCircleInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.circle'}\n            draft={props.circleDraft}\n            committing={props.circleCommitting}\n            onPointMove={props.onSketchCirclePointMove}\n            onPoint={props.onSketchCirclePoint}\n          />\n        )}\n`,
);

replaceOnce(
  'src/web/App.tsx',
  `    handleSketchLinePointMove,\n    handleSketchLinePoint,\n    beginCreateSketch,`,
  `    handleSketchLinePointMove,\n    handleSketchLinePoint,\n    circleDraft,\n    circleCommitting,\n    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    beginCreateSketch,`,
);

replaceOnce(
  'src/web/App.tsx',
  `                onSketchLinePointMove={handleSketchLinePointMove}\n                onSketchLinePoint={handleSketchLinePoint}\n              />`,
  `                onSketchLinePointMove={handleSketchLinePointMove}\n                onSketchLinePoint={handleSketchLinePoint}\n                circleDraft={circleDraft}\n                circleCommitting={circleCommitting}\n                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n              />`,
);

replaceOnce(
  'tests/m2/part-browser.mjs',
  `  await page.getByRole('button', { name: /Окружность/i }).click();\n  const diameter = page.locator('.numeric-field').filter({ hasText: 'Диаметр' }).locator('input');`,
  `  await page.getByRole('button', { name: /Окружность/i }).click();\n  await page.locator('.content-area.panel-closed').waitFor();\n  await page.getByTitle('Параметры').click();\n  await page.locator('.parameter-panel').waitFor();\n  const diameter = page.locator('.numeric-field').filter({ hasText: 'Диаметр' }).locator('input');`,
);

const registryPath = 'spec/ui/command-registry.v1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const circleCommand = registry.commands.find((command) => command.id === 'sketch.circle');
if (!circleCommand) throw new Error('sketch.circle missing from command registry');
circleCommand.milestone = 'M3.3';
circleCommand.status = 'implemented';
fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);

const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts['test:m3:circle'] = 'node tests/m3/direct-circle-boundary.mjs';
packageJson.scripts['test:m3'] = 'npm run test:m3:foundation && npm run test:m3:circle';
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

replaceOnce(
  '.github/workflows/m3-browser.yml',
  `      - name: Exercise M3 direct Line mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-line-browser.mjs\n`,
  `      - name: Exercise M3 direct Line mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-line-browser.mjs\n\n      - name: Exercise M3 direct Circle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-circle-browser.mjs\n`,
);

console.log('M3.3 Circle codemod applied');
