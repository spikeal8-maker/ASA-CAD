import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 140)}`);
  const next = source.replace(from, to);
  if (next === source) throw new Error(`No change produced for ${path}`);
  fs.writeFileSync(path, next);
}

// Shared action surface: Arc becomes a real desktop/mobile/search action only
// in this direct UI slice.
replaceOnce(
  'src/web/M2CadUiActions.ts',
  `  circle(): void | Promise<void>;\n  finishSketch(): void | Promise<void>;`,
  `  circle(): void | Promise<void>;\n  arc(): void | Promise<void>;\n  finishSketch(): void | Promise<void>;`,
);
replaceOnce(
  'src/web/M2CadUiActions.ts',
  `    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.finish':`,
  `    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.arc': binding(handlers.arc, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.finish':`,
);

replaceOnce(
  'src/web/MobileToolsPanel.tsx',
  `  { id: 'sketch.circle', symbol: '○' },\n  { id: 'sketch.finish', symbol: '✓' },`,
  `  { id: 'sketch.circle', symbol: '○' },\n  { id: 'sketch.arc', symbol: '⌒' },\n  { id: 'sketch.finish', symbol: '✓' },`,
);

// Workspace lifecycle owns active Arc tool state, not App/viewport.
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `import { useSketchCircleTool } from './useSketchCircleTool';`,
  `import { useSketchCircleTool } from './useSketchCircleTool';\nimport { useSketchArcTool } from './useSketchArcTool';`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n\n  const resetTransient`,
  `  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n  const arcTool = useSketchArcTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.arc',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n\n  const resetTransient`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `  async function commitCircle() {`,
  `  function beginArc() {\n    if (!sketch) return;\n    arcTool.reset();\n    setActiveCommand('sketch.arc');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр дуги');\n  }\n\n  async function commitCircle() {`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';`,
  `    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    if (activeCommand === 'sketch.arc') arcTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle' || activeCommand === 'sketch.arc';`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    if (activeCommand === 'sketch.circle') {\n      if (circleTool.draft.center) return circleTool.commitPreview();\n      return commitCircle();\n    }\n    if (activeCommand === 'part.extrude')`,
  `    if (activeCommand === 'sketch.circle') {\n      if (circleTool.draft.center) return circleTool.commitPreview();\n      return commitCircle();\n    }\n    if (activeCommand === 'sketch.arc') return arcTool.commitPreview();\n    if (activeCommand === 'part.extrude')`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    beginCreateSketch,`,
  `    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    arcDraft: arcTool.draft,\n    arcCommitting: arcTool.committing,\n    handleSketchArcPointMove: arcTool.move,\n    handleSketchArcPoint: arcTool.point,\n    beginCreateSketch,`,
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    beginCircle,\n    commitCircle,\n    finishSketch,`,
  `    beginCircle,\n    commitCircle,\n    beginArc,\n    finishSketch,`,
);

// Part presentation composes the Arc-specific layer on the shared surface.
replaceOnce(
  'src/web/PartModelStage.tsx',
  `import type { SketchCircleDraft } from './useSketchCircleTool';`,
  `import type { SketchCircleDraft } from './useSketchCircleTool';\nimport type { SketchArcDraft } from './useSketchArcTool';`,
);
replaceOnce(
  'src/web/PartModelStage.tsx',
  `import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';`,
  `import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';\nimport { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';`,
);
replaceOnce(
  'src/web/PartModelStage.tsx',
  `  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n}`,
  `  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n  arcDraft: SketchArcDraft;\n  arcCommitting: boolean;\n  onSketchArcPointMove(point: CadPoint2): void;\n  onSketchArcPoint(point: CadPoint2): void | Promise<void>;\n}`,
);
replaceOnce(
  'src/web/PartModelStage.tsx',
  `        {sketchEditing && (\n          <div\n            className="sketch-solve-hud"`,
  `        {sketchEditing && (\n          <SketchArcInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.arc'}\n            draft={props.arcDraft}\n            committing={props.arcCommitting}\n            onPointMove={props.onSketchArcPointMove}\n            onPoint={props.onSketchArcPoint}\n          />\n        )}\n\n        {sketchEditing && (\n          <div\n            className="sketch-solve-hud"`,
);

// Persisted/solver Arc presentation is separate from interaction ghost state.
replaceOnce(
  'src/web/viewport/SketchOverlayLayer.tsx',
  `import type { SketchOverlayModel } from './SketchOverlayModel';`,
  `import type { SketchOverlayModel } from './SketchOverlayModel';\nimport { sketchArcSvgPath } from '../SketchArcGeometry';`,
);
replaceOnce(
  'src/web/viewport/SketchOverlayLayer.tsx',
  `    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className="cad-sketch-overlay-entity circle"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n  }`,
  `    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className="cad-sketch-overlay-entity circle"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n    case 'arc':\n      return (\n        <path\n          key={entity.id}\n          className="cad-sketch-overlay-entity arc"\n          data-sketch-entity-id={entity.id}\n          data-sketch-entity-type="arc"\n          data-arc-radius={entity.data.radius}\n          data-arc-start-angle={entity.data.startAngle}\n          data-arc-end-angle={entity.data.endAngle}\n          d={sketchArcSvgPath(\n            entity.data.center,\n            entity.data.radius,\n            entity.data.startAngle,\n            entity.data.endAngle,\n          )}\n          fill="none"\n          stroke="currentColor"\n          strokeWidth={0.45}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n  }`,
);

// App only wires already-owned workspace/actions/presentation state.
replaceOnce(
  'src/web/App.tsx',
  `    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    beginCreateSketch,`,
  `    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    arcDraft,\n    arcCommitting,\n    handleSketchArcPointMove,\n    handleSketchArcPoint,\n    beginCreateSketch,`,
);
replaceOnce(
  'src/web/App.tsx',
  `    beginCircle,\n    commitCircle,\n    finishSketch,`,
  `    beginCircle,\n    commitCircle,\n    beginArc,\n    finishSketch,`,
);
replaceOnce(
  'src/web/App.tsx',
  `      circle: beginCircle,\n      finishSketch,`,
  `      circle: beginCircle,\n      arc: beginArc,\n      finishSketch,`,
);
replaceOnce(
  'src/web/App.tsx',
  `                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n              </CommandGroup>`,
  `                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n                <CadUiActionButton action={uiAction('sketch.arc')} symbol="⌒" />\n              </CommandGroup>`,
);
replaceOnce(
  'src/web/App.tsx',
  `                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n              />`,
  `                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n                arcDraft={arcDraft}\n                arcCommitting={arcCommitting}\n                onSketchArcPointMove={handleSketchArcPointMove}\n                onSketchArcPoint={handleSketchArcPoint}\n              />`,
);

// Deterministic review route uses the same typed sketch.arc command.
replaceOnce(
  'src/browser/routes.ts',
  `  'circle',\n  'extrude',`,
  `  'circle',\n  'arc',\n  'extrude',`,
);
replaceOnce(
  'src/web/devFixtures.ts',
  `async function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {`,
  `async function buildArcSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create arc sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create arc sketch');\n  await execute(\n    app,\n    { id: 'sketch.arc', payload: { sketchId, center: [0, 0], start: [15, 0], end: [0, 15] } },\n    'Create direct arc fixture',\n  );\n  return sketchId;\n}\n\nasync function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {`,
);
replaceOnce(
  'src/web/devFixtures.ts',
  `  if (name === 'extrude') {`,
  `  if (name === 'arc') {\n    const activeSketchId = await buildArcSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture arc: R15, 90° CCW, центр (0, 0) в XY',\n      activeSketchId,\n    };\n  }\n\n  if (name === 'extrude') {`,
);

// Registry truth: implemented only now that a shared UI/browser path exists.
const registryPath = 'spec/ui/command-registry.v1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const arc = registry.commands.find((command) => command.id === 'sketch.arc');
if (!arc) throw new Error('Missing sketch.arc registry command');
arc.status = 'implemented';
arc.milestone = 'M3.4B';
arc.backendCommand = 'sketch.arc';
fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);

const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts['test:m3:direct-arc'] = 'node tests/m3/direct-arc-boundary.mjs';
packageJson.scripts['test:m3'] = 'npm run test:m3:foundation && npm run test:m3:circle && npm run test:m3:arc-contract && npm run test:m3:direct-arc';
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('M3.4B Direct Arc codemod applied');
