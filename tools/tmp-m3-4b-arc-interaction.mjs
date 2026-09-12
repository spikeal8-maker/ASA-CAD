import fs from 'node:fs';

function edit(path, mutate) {
  const source = fs.readFileSync(path, 'utf8');
  const next = mutate(source);
  if (next === source) throw new Error(`No change produced for ${path}`);
  fs.writeFileSync(path, next);
}
function once(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, first + 1) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

edit('src/web/viewport/SketchOverlayLayer.tsx', (source) => {
  source = once(source,
    "import { useSketchViewportFrame } from './SketchViewportFrameContext';\n",
    "import { useSketchViewportFrame } from './SketchViewportFrameContext';\nimport { sketchArcSvgPath } from './SketchArcGeometry';\n",
    'overlay Arc import');
  return once(source,
`    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className=\"cad-sketch-overlay-entity circle\"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect=\"non-scaling-stroke\"\n        />\n      );\n`,
`    case 'circle':\n      return (\n        <circle\n          key={entity.id}\n          className=\"cad-sketch-overlay-entity circle\"\n          data-sketch-entity-id={entity.id}\n          cx={entity.data.center[0]}\n          cy={-entity.data.center[1]}\n          r={entity.data.diameter / 2}\n          vectorEffect=\"non-scaling-stroke\"\n        />\n      );\n    case 'arc':\n      return (\n        <path\n          key={entity.id}\n          className=\"cad-sketch-overlay-entity arc\"\n          data-sketch-entity-id={entity.id}\n          d={sketchArcSvgPath(entity.data)}\n          fill=\"none\"\n          vectorEffect=\"non-scaling-stroke\"\n        />\n      );\n`, 'overlay Arc case');
});

edit('src/web/usePartSketchWorkspace.ts', (source) => {
  source = once(source,
    "import { useSketchCircleTool } from './useSketchCircleTool';\n",
    "import { useSketchCircleTool } from './useSketchCircleTool';\nimport { useSketchArcTool } from './useSketchArcTool';\n",
    'Arc tool import');
  source = once(source,
`  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`,
`  const circleTool = useSketchCircleTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.circle',\n    setNotice,\n    onCommitted: (diameter) => {\n      setCircleDiameter(diameter);\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n  const arcTool = useSketchArcTool({\n    app,\n    sketchId: activeSketchId,\n    active: activeCommand === 'sketch.arc',\n    setNotice,\n    onCommitted: () => {\n      setActiveCommand(null);\n      setPanel('tree');\n      setActiveWorkspace('sketch');\n      clearTransientSelection();\n    },\n  });\n`, 'Arc tool instance');
  source = once(source,
`  function beginCircle() {\n    if (!sketch) return;\n    circleTool.reset();\n    setActiveCommand('sketch.circle');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр окружности');\n  }\n`,
`  function beginCircle() {\n    if (!sketch) return;\n    circleTool.reset();\n    setActiveCommand('sketch.circle');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр окружности');\n  }\n\n  function beginArc() {\n    if (!sketch) return;\n    arcTool.reset();\n    setActiveCommand('sketch.arc');\n    setPanel('closed');\n    clearTransientSelection();\n    setNotice('Укажите центр дуги');\n  }\n`, 'beginArc');
  source = once(source,
`    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';\n`,
`    if (activeCommand === 'sketch.line') lineTool.reset();\n    if (activeCommand === 'sketch.circle') circleTool.reset();\n    if (activeCommand === 'sketch.arc') arcTool.reset();\n    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle' || activeCommand === 'sketch.arc';\n`, 'Arc cancel');
  source = once(source,
`    if (activeCommand === 'sketch.circle') {\n      if (circleTool.draft.center) return circleTool.commitPreview();\n      return commitCircle();\n    }\n`,
`    if (activeCommand === 'sketch.circle') {\n      if (circleTool.draft.center) return circleTool.commitPreview();\n      return commitCircle();\n    }\n    if (activeCommand === 'sketch.arc') return arcTool.commitPreview();\n`, 'Arc commitActiveCommand');
  source = once(source,
`    circleDraft: circleTool.draft,\n    circleCommitting: circleTool.committing,\n    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n`,
`    circleDraft: circleTool.draft,\n    circleCommitting: circleTool.committing,\n    handleSketchCirclePointMove: circleTool.move,\n    handleSketchCirclePoint: circleTool.point,\n    arcDraft: arcTool.draft,\n    arcCommitting: arcTool.committing,\n    handleSketchArcPointMove: arcTool.move,\n    handleSketchArcPoint: arcTool.point,\n`, 'Arc return handlers');
  source = once(source,
`    beginCircle,\n    commitCircle,\n`,
`    beginCircle,\n    commitCircle,\n    beginArc,\n`, 'beginArc return');
  return source;
});

edit('src/web/PartModelStage.tsx', (source) => {
  source = once(source,
    "import type { SketchCircleDraft } from './useSketchCircleTool';\n",
    "import type { SketchCircleDraft } from './useSketchCircleTool';\nimport type { SketchArcDraft } from './useSketchArcTool';\n",
    'stage Arc draft import');
  source = once(source,
    "import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';\n",
    "import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';\nimport { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';\n",
    'stage Arc layer import');
  source = once(source,
`  circleDraft: SketchCircleDraft;\n  circleCommitting: boolean;\n  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n`,
`  circleDraft: SketchCircleDraft;\n  circleCommitting: boolean;\n  onSketchCirclePointMove(point: CadPoint2): void;\n  onSketchCirclePoint(point: CadPoint2): void | Promise<void>;\n  arcDraft: SketchArcDraft;\n  arcCommitting: boolean;\n  onSketchArcPointMove(point: CadPoint2): void;\n  onSketchArcPoint(point: CadPoint2): void | Promise<void>;\n`, 'stage Arc props');
  return once(source,
`        {sketchEditing && (\n          <SketchCircleInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.circle'}\n            draft={props.circleDraft}\n            committing={props.circleCommitting}\n            onPointMove={props.onSketchCirclePointMove}\n            onPoint={props.onSketchCirclePoint}\n          />\n        )}\n`,
`        {sketchEditing && (\n          <SketchCircleInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.circle'}\n            draft={props.circleDraft}\n            committing={props.circleCommitting}\n            onPointMove={props.onSketchCirclePointMove}\n            onPoint={props.onSketchCirclePoint}\n          />\n        )}\n\n        {sketchEditing && (\n          <SketchArcInteractionLayer\n            model={sketchOverlay}\n            frame={sketchFrame}\n            viewportState={sketchViewport}\n            onViewportStateChange={setSketchViewport}\n            active={props.activeCommand === 'sketch.arc'}\n            draft={props.arcDraft}\n            committing={props.arcCommitting}\n            onPointMove={props.onSketchArcPointMove}\n            onPoint={props.onSketchArcPoint}\n          />\n        )}\n`, 'stage Arc render');
});

edit('src/web/M2CadUiActions.ts', (source) => {
  source = once(source, "  circle(): void | Promise<void>;\n", "  circle(): void | Promise<void>;\n  arc(): void | Promise<void>;\n", 'action Arc handler');
  return once(source,
    "    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n",
    "    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),\n    'sketch.arc': binding(handlers.arc, state.hasSketch, 'Сначала создайте эскиз'),\n",
    'action Arc binding');
});

edit('src/web/MobileToolsPanel.tsx', (source) => once(source,
  "  { id: 'sketch.circle', symbol: '○' },\n",
  "  { id: 'sketch.circle', symbol: '○' },\n  { id: 'sketch.arc', symbol: '⌒' },\n",
  'mobile Arc tool'));

edit('src/browser/routes.ts', (source) => once(source,
  "  'circle',\n",
  "  'circle',\n  'arc',\n",
  'Arc fixture route'));

edit('src/web/devFixtures.ts', (source) => {
  source = once(source,
`async function buildCircleSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create circle sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create circle sketch');\n  await execute(\n    app,\n    { id: 'sketch.circle', payload: { sketchId, center: [5, -3], diameter: 24 } },\n    'Create direct circle fixture',\n  );\n  return sketchId;\n}\n`,
`async function buildCircleSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create circle sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create circle sketch');\n  await execute(\n    app,\n    { id: 'sketch.circle', payload: { sketchId, center: [5, -3], diameter: 24 } },\n    'Create direct circle fixture',\n  );\n  return sketchId;\n}\n\nasync function buildArcSketch(app: CadApplication): Promise<CadSketchId> {\n  const sketchResult = await execute(\n    app,\n    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },\n    'Create arc sketch',\n  );\n  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create arc sketch');\n  await execute(\n    app,\n    { id: 'sketch.arc', payload: { sketchId, center: [0, 0], start: [20, 0], end: [0, 20] } },\n    'Create direct arc fixture',\n  );\n  return sketchId;\n}\n`, 'Arc fixture builder');
  return once(source,
`  if (name === 'circle') {\n    const activeSketchId = await buildCircleSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture circle: окружность Ø24 мм с центром (5, -3) в XY',\n      activeSketchId,\n    };\n  }\n`,
`  if (name === 'circle') {\n    const activeSketchId = await buildCircleSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture circle: окружность Ø24 мм с центром (5, -3) в XY',\n      activeSketchId,\n    };\n  }\n\n  if (name === 'arc') {\n    const activeSketchId = await buildArcSketch(app);\n    return {\n      name,\n      workspace: 'sketch',\n      expectedRecomputeStatus: 'dirty',\n      message: 'Fixture arc: четверть окружности R20 в XY',\n      activeSketchId,\n    };\n  }\n`, 'Arc fixture case');
});

edit('src/web/App.tsx', (source) => {
  source = once(source,
`    circleDraft,\n    circleCommitting,\n    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n`,
`    circleDraft,\n    circleCommitting,\n    handleSketchCirclePointMove,\n    handleSketchCirclePoint,\n    arcDraft,\n    arcCommitting,\n    handleSketchArcPointMove,\n    handleSketchArcPoint,\n`, 'App Arc workspace props');
  source = once(source, "      circle: beginCircle,\n", "      circle: beginCircle,\n      arc: beginArc,\n", 'App Arc action');
  source = once(source,
    "                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n",
    "                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />\n                <CadUiActionButton action={uiAction('sketch.arc')} symbol=\"⌒\" />\n",
    'App Arc ribbon');
  return once(source,
`                circleDraft={circleDraft}\n                circleCommitting={circleCommitting}\n                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n`,
`                circleDraft={circleDraft}\n                circleCommitting={circleCommitting}\n                onSketchCirclePointMove={handleSketchCirclePointMove}\n                onSketchCirclePoint={handleSketchCirclePoint}\n                arcDraft={arcDraft}\n                arcCommitting={arcCommitting}\n                onSketchArcPointMove={handleSketchArcPointMove}\n                onSketchArcPoint={handleSketchArcPoint}\n`, 'App Arc stage props');
});

edit('spec/ui/command-registry.v1.json', (source) => {
  const data = JSON.parse(source);
  const arc = data.commands.find((command) => command.id === 'sketch.arc');
  if (!arc) throw new Error('Missing sketch.arc registry entry');
  arc.status = 'implemented';
  arc.milestone = 'M3.4';
  arc.backendCommand = 'sketch.arc';
  return `${JSON.stringify(data)}\n`;
});

edit('package.json', (source) => {
  const data = JSON.parse(source);
  data.scripts['test:m3:arc-direct'] = 'node tests/m3/direct-arc-boundary.mjs';
  if (!data.scripts['test:m3'].includes('test:m3:arc-direct')) data.scripts['test:m3'] += ' && npm run test:m3:arc-direct';
  return `${JSON.stringify(data, null, 2)}\n`;
});

edit('.github/workflows/m3-browser.yml', (source) => once(source,
`      - name: Exercise M3 direct Circle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-circle-browser.mjs\n`,
`      - name: Exercise M3 direct Circle mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-circle-browser.mjs\n\n      - name: Exercise M3 direct Arc mouse/touch/persistence\n        env:\n          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/\n        run: node tests/m3/direct-arc-browser.mjs\n`, 'M3 Arc browser step'));

console.log('M3.4B Arc interaction wiring applied');
