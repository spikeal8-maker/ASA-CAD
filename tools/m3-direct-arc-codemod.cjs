const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing codemod anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique codemod anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

// Part/Sketch workspace controller.
{
  const path = 'src/web/usePartSketchWorkspace.ts';
  let s = read(path);
  s = replaceOnce(s,
    "import { useSketchCircleTool } from './useSketchCircleTool';\n",
    "import { useSketchCircleTool } from './useSketchCircleTool';\nimport { useSketchArcTool } from './useSketchArcTool';\n",
    'workspace arc import');
  const circleTool = `  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`;
  s = replaceOnce(s, circleTool, circleTool + `  const arcTool = useSketchArcTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.arc',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`, 'workspace arc tool');
  const beginCircle = `  function beginCircle() {\n    if (!sketch) return;\n    circleTool.reset();\n    setActiveCommand('sketch.circle');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр окружности');\n  }\n\n`;
  s = replaceOnce(s, beginCircle, beginCircle + `  function beginArc() {\n    if (!sketch) return;\n    arcTool.reset();\n    setActiveCommand('sketch.arc');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр дуги');\n  }\n\n`, 'workspace begin Arc');
  s = replaceOnce(s,
    `    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';`,
    `    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    if (activeCommand === 'sketch.arc') arcTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle' || activeCommand === 'sketch.arc';`,
    'workspace cancel Arc');
  s = replaceOnce(s,
    `    if (activeCommand === 'sketch.line') return lineTool.commitPreview();\n    if (activeCommand === 'part.sketch.create')`,
    `    if (activeCommand === 'sketch.line') return lineTool.commitPreview();\n    if (activeCommand === 'sketch.arc') return arcTool.commitPreview();\n    if (activeCommand === 'part.sketch.create')`,
    'workspace commit Arc');
  s = replaceOnce(s,
    `    circleDraft: circleTool.draft,\n    circleCommitting: circleTool.committing,\n    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    beginCreateSketch,`,
    `    circleDraft: circleTool.draft,\n    circleCommitting: circleTool.committing,\n    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    beginArc,\n    arcDraft: arcTool.draft,\n    arcCommitting: arcTool.committing,\n    handleSketchArcPointMove: arcTool.move,\n    handleSketchArcPoint: arcTool.point,\n    beginCreateSketch,`,
    'workspace Arc return');
  write(path, s);
}

// Part model stage.
{
  const path = 'src/web/PartModelStage.tsx';
  let s = read(path);
  s = replaceOnce(s,
    "import type { SketchCircleDraft } from './useSketchCircleTool';\n",
    "import type { SketchCircleDraft } from './useSketchCircleTool';\nimport type { SketchArcDraft } from './useSketchArcTool';\n",
    'stage arc draft import');
  s = replaceOnce(s,
    "import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';\n",
    "import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';\nimport { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';\n",
    'stage arc layer import');
  s = replaceOnce(s,
    `  circleDraft: SketchCircleDraft;\n  circleCommitting: boolean;\n  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n`,
    `  circleDraft: SketchCircleDraft;\n  circleCommitting: boolean;\n  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n  arcDraft: SketchArcDraft;\n  arcCommitting: boolean;\n  onSketchArcPointMove(point: CadPoint2): void;\n  onSketchArcPoint(point: CadPoint2): void | Promise<void>;\n`,
    'stage arc props');
  const circleBlock = `        {sketchEditing && (\n          <SketchCircleInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.circle'}\n            draft={props.circleDraft}\n            committing={props.circleCommitting}\n            onPointMove={props.onSketchCirclePointMove}\n            onPoint={props.onSketchCirclePoint}\n          />\n        )}\n`;
  s = replaceOnce(s, circleBlock, circleBlock + `\n        {sketchEditing && (\n          <SketchArcInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.arc'}\n            draft={props.arcDraft}\n            committing={props.arcCommitting}\n            onPointMove={props.onSketchArcPointMove}\n            onPoint={props.onSketchArcPoint}\n          />\n        )}\n`, 'stage Arc render');
  write(path, s);
}

// Shared product actions.
{
  const path = 'src/web/M2CadUiActions.ts';
  let s = read(path);
  s = replaceOnce(s, `  circle(): void | Promise<void>;\n`, `  circle(): void | Promise<void>;\n  arc(): void | Promise<void>;\n`, 'actions arc handler');
  s = replaceOnce(s,
    `    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n`,
    `    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.arc': binding(handlers.arc, state.hasSketch, 'Сначала создайте эскиз'),\n`,
    'actions arc binding');
  write(path, s);
}

// Desktop shell wiring.
{
  const path = 'src/web/App.tsx';
  let s = read(path);
  s = replaceOnce(s,
    `    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    beginCreateSketch,`,
    `    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    beginArc,\n    arcDraft,\n    arcCommitting,\n    handleSketchArcPointMove,\n    handleSketchArcPoint,\n    beginCreateSketch,`,
    'app Arc destructure');
  s = replaceOnce(s, `      circle: beginCircle,\n`, `      circle: beginCircle,\n      arc: beginArc,\n`, 'app Arc action');
  s = replaceOnce(s,
    `                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n`,
    `                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n                <CadUiActionButton action={uiAction('sketch.arc')} symbol="⌒" />\n`,
    'app Arc ribbon');
  s = replaceOnce(s,
    `                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n`,
    `                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n                arcDraft={arcDraft}\n                arcCommitting={arcCommitting}\n                onSketchArcPointMove={handleSketchArcPointMove}\n                onSketchArcPoint={handleSketchArcPoint}\n`,
    'app Arc stage props');
  write(path, s);
}

// Mobile shared action presentation.
{
  const path = 'src/web/MobileToolsPanel.tsx';
  let s = read(path);
  s = replaceOnce(s,
    `  { id: 'sketch.circle', symbol: '○' },\n`,
    `  { id: 'sketch.circle', symbol: '○' },\n  { id: 'sketch.arc', symbol: '⌒' },\n`,
    'mobile Arc action');
  write(path, s);
}

// Persisted/solver overlay Arc rendering.
{
  const path = 'src/web/viewport/SketchOverlayLayer.tsx';
  let s = read(path);
  s = replaceOnce(s,
    "import { useSketchViewportFrame } from './SketchViewportFrameContext';\n",
    "import { useSketchViewportFrame } from './SketchViewportFrameContext';\nimport { sketchArcGeometry } from './SketchArcGeometry';\n",
    'overlay arc geometry import');
  s = replaceOnce(s,
    `    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className="cad-sketch-overlay-entity circle"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n`,
    `    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className="cad-sketch-overlay-entity circle"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n    case 'arc': {\n      const geometry = sketchArcGeometry(\n        entity.data.center,\n        entity.data.radius,\n        entity.data.startAngle,\n        entity.data.endAngle,\n      );\n      if (!geometry) return null;\n      return (\n        <path\n          key={entity.id}\n          className="cad-sketch-overlay-entity arc"\n          data-sketch-entity-id={entity.id}\n          d={geometry.path}\n          vectorEffect="non-scaling-stroke"\n        />\n      );\n    }\n`,
    'overlay Arc case');
  write(path, s);
}

// Deterministic Arc fixture.
{
  const path = 'src/web/devFixtures.ts';
  let s = read(path);
  const circleBuilderEnd = `async function buildCircleSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create circle sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create circle sketch');\n  await execute(\n    app,\n    { id: 'sketch.circle', payload: { sketchId, center: [5, -3], diameter: 24 } },\n    'Create direct circle fixture',\n  );\n  return sketchId;\n}\n`;
  s = replaceOnce(s, circleBuilderEnd, circleBuilderEnd + `\nasync function buildArcSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create arc sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create arc sketch');\n  await execute(\n    app,\n    { id: 'sketch.arc', payload: { sketchId, center: [0, 0], start: [12, 0], end: [0, 12] } },\n    'Create direct arc fixture',\n  );\n  return sketchId;\n}\n`, 'fixture Arc builder');
  const circleCase = `  if (name === 'circle') {\n    const activeSketchId = await buildCircleSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture circle: окружность Ø24 мм с центром (5, -3) в XY',\n      activeSketchId,\n    };\n  }\n`;
  s = replaceOnce(s, circleCase, circleCase + `\n  if (name === 'arc') {\n    const activeSketchId = await buildArcSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture arc: дуга R12 мм 0→90° в XY',\n      activeSketchId,\n    };\n  }\n`, 'fixture Arc case');
  write(path, s);
}

// Dev route.
{
  const path = 'src/browser/routes.ts';
  let s = read(path);
  s = replaceOnce(s, `  'circle',\n`, `  'circle',\n  'arc',\n`, 'Arc dev route');
  write(path, s);
}

// Package mandatory M3 boundary suite.
{
  const path = 'package.json';
  const data = JSON.parse(read(path));
  data.scripts['test:m3:arc-direct'] = 'node tests/m3/direct-arc-boundary.mjs';
  data.scripts['test:m3'] = 'npm run test:m3:foundation && npm run test:m3:circle && npm run test:m3:arc-contract && npm run test:m3:arc-direct';
  write(path, `${JSON.stringify(data, null, 2)}\n`);
}

// Promote Arc only now that direct UI/browser acceptance is part of this slice.
{
  const path = 'spec/ui/command-registry.v1.json';
  const data = JSON.parse(read(path));
  const arc = data.commands.find((command) => command.id === 'sketch.arc');
  if (!arc) throw new Error('Missing sketch.arc in command registry');
  arc.status = 'implemented';
  arc.milestone = 'M3.4B';
  arc.backendCommand = 'sketch.arc';
  write(path, `${JSON.stringify(data)}\n`);
}

// Dedicated M3 browser acceptance.
{
  const path = '.github/workflows/m3-browser.yml';
  let s = read(path);
  s = replaceOnce(s,
    `      - name: Exercise M3 direct Circle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-circle-browser.mjs\n`,
    `      - name: Exercise M3 direct Circle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-circle-browser.mjs\n\n      - name: Exercise M3 direct Arc mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-arc-browser.mjs\n`,
    'M3 Arc browser workflow');
  write(path, s);
}

console.log('M3.4B direct Arc codemod applied');
