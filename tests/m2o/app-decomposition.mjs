import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const shellTop = readFileSync('src/web/CadShellTop.tsx', 'utf8');
const shellMain = readFileSync('src/web/CadShellMain.tsx', 'utf8');
const shellBottom = readFileSync('src/web/CadShellBottom.tsx', 'utf8');
const newDocumentDialog = readFileSync('src/web/NewDocumentDialog.tsx', 'utf8');
const plannedDocumentStage = readFileSync('src/web/PlannedDocumentStage.tsx', 'utf8');
const documentPresentation = readFileSync('src/web/CadDocumentPresentation.ts', 'utf8');
const tree = readFileSync('src/web/DocumentTree.tsx', 'utf8');
const parameters = readFileSync('src/web/ParameterPanel.tsx', 'utf8');
const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const selection = readFileSync('src/web/usePartSelectionController.ts', 'utf8');
const editing = readFileSync('src/web/useSketchEditingController.ts', 'utf8');
const dimensions = readFileSync('src/web/useSketchDimensionController.ts', 'utf8');
const features = readFileSync('src/web/usePartFeatureController.ts', 'utf8');
const sketchSession = readFileSync('src/web/SketchSession.ts', 'utf8');
const sketchSessionHook = readFileSync('src/web/useSketchSession.ts', 'utf8');

for (const [importName, fileName] of [
  ['CadShellTop', 'CadShellTop'],
  ['CadShellMain', 'CadShellMain'],
  ['CadShellBottom', 'CadShellBottom'],
  ['NewDocumentDialog', 'NewDocumentDialog'],
  ['PlannedDocumentStage', 'PlannedDocumentStage'],
]) {
  assert.match(app, new RegExp(`import \\{ ${importName} \\} from '\\.\\/${fileName}';`));
  assert.match(app, new RegExp(`<${importName}\\b`));
}
assert.match(app, /import \{ documentNames \} from '\.\/CadDocumentPresentation';/);
for (const legacyShellFragment of [
  'function WorkspaceTab(',
  'function CommandGroup(',
  'function RibbonTextButton(',
  'function ViewCommandGroups(',
  'function kindIcon(',
  'const documentDescriptions:',
]) {
  assert.equal(app.includes(legacyShellFragment), false, `shell presentation must not return to App.tsx: ${legacyShellFragment}`);
}

assert.match(app, /import \{ DocumentTree \} from '\.\/DocumentTree';/);
assert.doesNotMatch(app, /function DocumentTree\(/);
assert.doesNotMatch(app, /function TreeRow\(/);
assert.match(app, /<DocumentTree\b/);

assert.match(app, /import \{ ParameterPanel \} from '\.\/ParameterPanel';/);
assert.doesNotMatch(app, /function ParameterPanel\(/);
assert.doesNotMatch(app, /function NumericField\(/);
assert.match(app, /<ParameterPanel\b/);

assert.match(app, /import \{ usePartSketchWorkspace \} from '\.\/usePartSketchWorkspace';/);
assert.match(app, /const workspace = usePartSketchWorkspace\(/);
for (const legacyRootFragment of [
  'function beginCreateSketch(',
  'function commitCreateSketch(',
  'function beginRectangle(',
  'function commitRectangle(',
  'function beginCircle(',
  'function commitCircle(',
  'function finishSketch(',
  'function beginExtrude(',
  'function commitExtrude(',
  'function beginCut(',
  'function commitCut(',
  'function beginFillet(',
  'function commitFillet(',
  'function beginDimensionEdit(',
  'function commitDimensionEdit(',
  'function cancelCommand(',
  'function commitActiveCommand(',
  'const [activeWorkspace,',
  'const [activeCommand,',
  'const [selectionMode,',
  'const [selectedPick,',
  'const [selectedBodyId,',
  'const [sketchPlane,',
  'const [rectangleWidth,',
  'const [rectangleHeight,',
  'const [circleDiameter,',
  'const [extrudeDistance,',
  'const [filletRadius,',
  'const [editingDimensionId,',
  'const [dimensionEditValue,',
]) {
  assert.equal(app.includes(legacyRootFragment), false, `Part/Sketch ownership must not return to App.tsx: ${legacyRootFragment}`);
}

assert.match(tree, /export function DocumentTree\(/);
assert.match(tree, /data-body-id=\{props\.bodyId\}/);
assert.match(tree, /data-sketch-id=\{props\.sketchId\}/);
assert.match(tree, /onEditSketch\(item\.id\)/);

assert.match(parameters, /export function ParameterPanel\(/);
assert.match(parameters, /function NumericField\(/);
assert.match(parameters, /type="number"/);
assert.match(parameters, /min="0\.01"/);
assert.match(parameters, /step="1"/);

assert.match(workspace, /export function usePartSketchWorkspace\(/);
assert.match(workspace, /useSketchSession\(part\)/);
assert.match(workspace, /usePartSelectionController\(/);
assert.match(workspace, /useSketchEditingController\(/);
assert.match(workspace, /useSketchDimensionController\(/);
assert.match(workspace, /usePartFeatureController\(/);
assert.doesNotMatch(workspace, /app\.execute\(/, 'facade must not own geometry mutations');
assert.doesNotMatch(workspace, /app\.captureReference\(/, 'facade must not own topology capture');
assert.doesNotMatch(workspace, /latestSketch\(/);

assert.match(selection, /export function usePartSelectionController\(/);
assert.doesNotMatch(selection, /CadApplication|app\.execute|captureReference/,
  'selection owner must stay transient and application-free');
assert.match(editing, /export function useSketchEditingController\(/);
assert.match(editing, /app\.execute\(/);
assert.doesNotMatch(editing, /captureReference\(/, 'Sketch editing must not own B-Rep topology capture');
assert.match(dimensions, /export function useSketchDimensionController\(/);
assert.match(dimensions, /part\.dimension\.setValue/);
assert.match(features, /export function usePartFeatureController\(/);
assert.match(features, /app\.execute\(/);
assert.match(features, /app\.captureReference\(/);

assert.match(sketchSession, /activeSketchId: CadSketchId \| null/);
assert.match(sketchSession, /resolveActiveSketch/);
assert.match(sketchSessionHook, /reconcileSketchSession/);

for (const [name, source] of [
  ['workspace facade', workspace],
  ['selection controller', selection],
  ['Sketch editing controller', editing],
  ['Sketch dimension controller', dimensions],
  ['Part feature controller', features],
]) {
  for (const forbidden of [
    '../runtime/',
    '../browser/',
    '../host/',
    'vendor/',
    'opencascade',
    'TopoDS',
    'localStorage',
    'indexedDB',
  ]) {
    assert.equal(source.includes(forbidden), false, `${name} must not own runtime/persistence/vendor internals: ${forbidden}`);
  }
}

for (const [name, source] of [
  ['CadShellTop', shellTop],
  ['CadShellMain', shellMain],
  ['CadShellBottom', shellBottom],
  ['NewDocumentDialog', newDocumentDialog],
  ['PlannedDocumentStage', plannedDocumentStage],
  ['CadDocumentPresentation', documentPresentation],
  ['DocumentTree', tree],
  ['ParameterPanel', parameters],
]) {
  for (const forbidden of [
    '../runtime/',
    '../browser/',
    '../application/',
    '../host/',
    'vendor/',
    'opencascade',
    'TopoDS',
  ]) {
    assert.equal(source.includes(forbidden), false, `${name} must remain presentation-only: ${forbidden}`);
  }
}

console.log('M2O/M3M decomposition PASS (App orchestration root + extracted shell presentation + focused Part/Sketch owners)');
