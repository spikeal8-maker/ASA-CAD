import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: expected fragment is not unique`);
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  "import { useSketchSession } from './useSketchSession';\n",
  "import { useSketchSession } from './useSketchSession';\nimport { useSketchLineTool } from './useSketchLineTool';\n",
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  const clearSelectedPick = useCallback(() => {\n    setSelectedPick(null);\n  }, []);\n\n  const resetTransient = useCallback(() => {`,
  `  const clearSelectedPick = useCallback(() => {\n    setSelectedPick(null);\n  }, []);\n\n  const lineTool = useSketchLineTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.line',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n\n  const resetTransient = useCallback(() => {`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  function beginRectangle() {\n    if (!sketch) return;`,
  `  function beginLine() {\n    if (!sketch) return;\n    lineTool.reset();\n    setActiveCommand('sketch.line');\n    setPanel('tree');\n    clearTransientSelection();\n    setNotice('Укажите начальную точку отрезка');\n  }\n\n  function beginRectangle() {\n    if (!sketch) return;`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  function cancelCommand() {\n    const stayInSketch = activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';`,
  `  function cancelCommand() {\n    if (activeCommand === 'sketch.line') lineTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  async function commitActiveCommand() {\n    if (activeCommand === 'part.sketch.create') return commitCreateSketch();`,
  `  async function commitActiveCommand() {\n    if (activeCommand === 'sketch.line') return lineTool.commitPreview();\n    if (activeCommand === 'part.sketch.create') return commitCreateSketch();`,
);

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    enterSketch,\n    beginCreateSketch,`,
  `    enterSketch,\n    beginLine,\n    lineDraft: lineTool.draft,\n    lineCommitting: lineTool.committing,\n    handleSketchLinePointMove: lineTool.move,\n    handleSketchLinePoint: lineTool.point,\n    beginCreateSketch,`,
);

replaceOnce(
  'src/web/M2CadUiActions.ts',
  `  createSketch(): void | Promise<void>;\n  rectangle(): void | Promise<void>;`,
  `  createSketch(): void | Promise<void>;\n  line(): void | Promise<void>;\n  rectangle(): void | Promise<void>;`,
);

replaceOnce(
  'src/web/M2CadUiActions.ts',
  `    'part.sketch.create': binding(handlers.createSketch),\n    'sketch.rectangle': binding(handlers.rectangle, state.hasSketch, 'Сначала создайте эскиз'),`,
  `    'part.sketch.create': binding(handlers.createSketch),\n    'sketch.line': binding(handlers.line, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.rectangle': binding(handlers.rectangle, state.hasSketch, 'Сначала создайте эскиз'),`,
);

replaceOnce(
  'src/web/MobileToolsPanel.tsx',
  `const SKETCH_TOOLS: readonly MobileToolSpec[] = [\n  { id: 'sketch.rectangle', symbol: '▭' },`,
  `const SKETCH_TOOLS: readonly MobileToolSpec[] = [\n  { id: 'sketch.line', symbol: '╱' },\n  { id: 'sketch.rectangle', symbol: '▭' },`,
);

replaceOnce(
  'src/web/App.tsx',
  `    enterSketch,\n    beginCreateSketch,`,
  `    enterSketch,\n    beginLine,\n    lineDraft,\n    lineCommitting,\n    handleSketchLinePointMove,\n    handleSketchLinePoint,\n    beginCreateSketch,`,
);

replaceOnce(
  'src/web/App.tsx',
  `      createSketch: beginCreateSketch,\n      rectangle: beginRectangle,`,
  `      createSketch: beginCreateSketch,\n      line: beginLine,\n      rectangle: beginRectangle,`,
);

replaceOnce(
  'src/web/App.tsx',
  `              <CommandGroup label="Геометрия">\n                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} large accent />`,
  `              <CommandGroup label="Геометрия">\n                <CadUiActionButton action={uiAction('sketch.line')} symbol="╱" large accent />\n                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} />`,
);

replaceOnce(
  'src/web/App.tsx',
  `                activeWorkspace={activeWorkspace}\n                revisionToken={revisionToken}`,
  `                activeWorkspace={activeWorkspace}\n                activeCommand={activeCommand}\n                revisionToken={revisionToken}`,
);

replaceOnce(
  'src/web/App.tsx',
  `                selectedBodyId={selectedBodyId}\n                onBodySelect={handleBodySelect}\n              />`,
  `                selectedBodyId={selectedBodyId}\n                onBodySelect={handleBodySelect}\n                lineDraft={lineDraft}\n                lineCommitting={lineCommitting}\n                onSketchLinePointMove={handleSketchLinePointMove}\n                onSketchLinePoint={handleSketchLinePoint}\n              />`,
);

const registryPath = 'spec/ui/command-registry.v1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const line = registry.commands.find((command) => command.id === 'sketch.line');
if (!line) throw new Error('command registry: sketch.line missing');
if (line.status !== 'planned') throw new Error(`command registry: sketch.line expected planned, got ${line.status}`);
line.status = 'implemented';
line.milestone = 'M3.2';
fs.writeFileSync(registryPath, JSON.stringify(registry));

console.log('M3.2 direct Line wiring codemod applied');
