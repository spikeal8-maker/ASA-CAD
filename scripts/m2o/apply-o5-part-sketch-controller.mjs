import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O5.3 codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'document imports',
  `import {
  createEmptyCadDocument,
  type CadDocument,
  type CadDocumentKind,
  type CadPartDocument,
} from '../contracts/document';
import type { CadBodyId, CadDimensionId, CadSketchEntityId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
`,
  `import {
  createEmptyCadDocument,
  type CadDocument,
  type CadDocumentKind,
} from '../contracts/document';
`,
);

replaceOnce(
  'workspace hook import',
  "import { ParameterPanel } from './ParameterPanel';\n",
  "import { ParameterPanel } from './ParameterPanel';\nimport { usePartSketchWorkspace } from './usePartSketchWorkspace';\n",
);

const helpersStart = source.indexOf('\nfunction partDocument(document: CadDocument): CadPartDocument | null {');
const appStart = source.indexOf('\nexport function App(props: CadProjectPersistenceOverrides) {');
if (helpersStart < 0 || appStart < 0 || helpersStart >= appStart) {
  throw new Error('O5.3 could not locate legacy Part/Sketch helper block');
}
source = `${source.slice(0, helpersStart)}${source.slice(appStart)}`;

replaceOnce(
  'Part Sketch state declarations',
  `  const [activeWorkspace, setActiveWorkspace] = useState('solid');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'none' | 'face' | 'edge'>('none');
  const [selectedPick, setSelectedPick] = useState<CadViewportPick | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<CadBodyId | null>(null);
  const [sketchPlane, setSketchPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
  const [rectangleWidth, setRectangleWidth] = useState(60);
  const [rectangleHeight, setRectangleHeight] = useState(40);
  const [circleDiameter, setCircleDiameter] = useState(12);
  const [extrudeDistance, setExtrudeDistance] = useState(10);
  const [filletRadius, setFilletRadius] = useState(1);
  const [editingDimensionId, setEditingDimensionId] = useState<CadDimensionId | null>(null);
  const [dimensionEditValue, setDimensionEditValue] = useState(0);
`,
  '',
);

replaceOnce(
  'Part Sketch derived state',
  `  const document = app.getDocument();
  const state = app.getState();
  const part = partDocument(document);
  const sketch = latestSketch(part);
  const rectangleReady = hasRectangle(sketch);
  const circleReady = hasCircle(sketch);
  const hasSolid = Boolean(part?.bodies.length);
  const lastFeature = part?.features.at(-1);
  const canExtrude = Boolean(sketch && rectangleReady && !hasSolid && part?.features.length === 0);
  const canCut = Boolean(sketch && circleReady && hasSolid && lastFeature?.type === 'extrude');
  const canFillet = Boolean(hasSolid && lastFeature?.type === 'cut-extrude');
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();
  const selectedPointText = selectedPick
    ? selectedPick.point.map((value) => Number(value).toFixed(2)).join(', ')
    : '';
  const selectedBody = selectedBodyId && part
    ? part.bodies.find((body) => body.id === selectedBodyId) ?? null
    : null;

  const clearTransientSelection = useCallback(() => {
    setSelectionMode('none');
    setSelectedPick(null);
    setSelectedBodyId(null);
  }, []);
`,
  `  const document = app.getDocument();
  const state = app.getState();
  const renderModel = runtime.getRenderModel(document);
  const runtimeState = runtime.getLoadState();
  const workspace = usePartSketchWorkspace({
    app,
    document,
    renderModelAvailable: Boolean(renderModel),
    setPanel: setActivePanel,
    setNotice,
  });
  const {
    activeWorkspace,
    setActiveWorkspace,
    activeCommand,
    selectionMode,
    selectedPick,
    selectedBodyId,
    sketchPlane,
    setSketchPlane,
    rectangleWidth,
    setRectangleWidth,
    rectangleHeight,
    setRectangleHeight,
    circleDiameter,
    setCircleDiameter,
    extrudeDistance,
    setExtrudeDistance,
    filletRadius,
    setFilletRadius,
    dimensionEditValue,
    setDimensionEditValue,
    part,
    sketch,
    rectangleReady,
    circleReady,
    hasSolid,
    canExtrude,
    canCut,
    canFillet,
    selectedPointText,
    selectedBody,
    clearTransientSelection,
    clearSelectedPick,
    resetTransient,
    resetToWorkspace,
    resetForDocument,
    handleViewportPick,
    handleBodySelect,
    beginCreateSketch,
    commitCreateSketch,
    beginRectangle,
    commitRectangle,
    beginCircle,
    commitCircle,
    finishSketch,
    beginExtrude,
    commitExtrude,
    beginCut,
    commitCut,
    beginFillet,
    commitFillet,
    beginDimensionEdit,
    commitDimensionEdit,
    cancelCommand,
    commitActiveCommand,
  } = workspace;
`,
);

replaceOnce(
  'fixture loading reset',
  `    setFixtureStatus('loading');
    setActivePanel('tree');
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
`,
  `    setFixtureStatus('loading');
    setActivePanel('tree');
    resetTransient();
`,
);
replaceOnce(
  'fixture completion reset',
  `        setActiveWorkspace(result.workspace);
        setActivePanel('tree');
        setActiveCommand(null);
        setEditingDimensionId(null);
        clearTransientSelection();
`,
  `        resetToWorkspace(result.workspace);
        setActivePanel('tree');
`,
);
replaceOnce(
  'fixture effect deps',
  `  }, [app, clearTransientSelection, devFixture]);
`,
  `  }, [app, devFixture, resetToWorkspace, resetTransient]);
`,
);

const pickStart = source.indexOf('  const handleViewportPick = useCallback((pick:');
const createDocumentStart = source.indexOf('  async function createDocument(kind: CadDocumentKind) {');
if (pickStart < 0 || createDocumentStart < 0 || pickStart >= createDocumentStart) {
  throw new Error('O5.3 could not locate legacy selection callbacks');
}
source = `${source.slice(0, pickStart)}${source.slice(createDocumentStart)}`;

replaceOnce(
  'createDocument reset',
  `    setNewDialogOpen(false);
    setActivePanel('tree');
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
    setActiveWorkspace(kind === 'part' ? 'solid' : kind);
`,
  `    setNewDialogOpen(false);
    setActivePanel('tree');
    resetForDocument(kind);
`,
);
replaceOnce(
  'resetAfterOpen body',
  `  const resetAfterOpen = useCallback((kind: CadDocumentKind) => {
    setActivePanel('tree');
    setActiveCommand(null);
    setEditingDimensionId(null);
    clearTransientSelection();
    setActiveWorkspace(kind === 'part' ? 'solid' : kind);
  }, [clearTransientSelection]);
`,
  `  const resetAfterOpen = useCallback((kind: CadDocumentKind) => {
    setActivePanel('tree');
    resetForDocument(kind);
  }, [resetForDocument]);
`,
);

const lifecycleStart = source.indexOf('  function beginCreateSketch() {');
const undoStart = source.indexOf('  async function undo() {');
if (lifecycleStart < 0 || undoStart < 0 || lifecycleStart >= undoStart) {
  throw new Error('O5.3 could not locate legacy Part/Sketch lifecycle block');
}
source = `${source.slice(0, lifecycleStart)}${source.slice(undoStart)}`;

replaceOnce(
  'shortcut selected pick clearing',
  `        if (activeCommand && selectedPick) {
          setSelectedPick(null);
          setNotice('Выбор очищен; команда остаётся активной');
`,
  `        if (activeCommand && selectedPick) {
          clearSelectedPick();
          setNotice('Выбор очищен; команда остаётся активной');
`,
);

writeFileSync(path, source);
console.log('Applied O5.3 Part/Sketch workspace controller wiring');
