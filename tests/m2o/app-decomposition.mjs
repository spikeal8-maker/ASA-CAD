import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const tree = readFileSync('src/web/DocumentTree.tsx', 'utf8');
const parameters = readFileSync('src/web/ParameterPanel.tsx', 'utf8');
const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const sketchSession = readFileSync('src/web/SketchSession.ts', 'utf8');
const sketchSessionHook = readFileSync('src/web/useSketchSession.ts', 'utf8');

assert.match(app, /import \{ DocumentTree \} from '\.\/DocumentTree';/, 'App must import extracted DocumentTree');
assert.doesNotMatch(app, /function DocumentTree\(/, 'DocumentTree implementation must not return to App.tsx');
assert.doesNotMatch(app, /function TreeRow\(/, 'TreeRow implementation must not return to App.tsx');
assert.match(app, /<DocumentTree\b/, 'App must render the extracted DocumentTree component');

assert.match(app, /import \{ ParameterPanel \} from '\.\/ParameterPanel';/, 'App must import extracted ParameterPanel');
assert.doesNotMatch(app, /function ParameterPanel\(/, 'ParameterPanel implementation must not return to App.tsx');
assert.doesNotMatch(app, /function NumericField\(/, 'NumericField implementation must not return to App.tsx');
assert.doesNotMatch(app, /commandRegistryJson/, 'App must not own ParameterPanel command-label metadata after extraction');
assert.match(app, /<ParameterPanel\b/, 'App must render the extracted ParameterPanel component');

assert.match(app, /import \{ usePartSketchWorkspace \} from '\.\/usePartSketchWorkspace';/, 'App must use the focused Part/Sketch workspace controller');
assert.match(app, /const workspace = usePartSketchWorkspace\(/, 'App must create the Part/Sketch workspace controller');
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

assert.match(tree, /export function DocumentTree\(/, 'DocumentTree module must export its focused presentation component');
assert.match(tree, /data-body-id=\{props\.bodyId\}/, 'tree/body selection DOM contract must be preserved');
assert.match(tree, /data-sketch-id=\{props\.sketchId\}/, 'tree must expose explicit Sketch identity for session selection');
assert.match(tree, /onEditSketch\(item\.id\)/, 'Sketch tree rows must explicitly enter the selected Sketch session');

assert.match(parameters, /export function ParameterPanel\(/, 'ParameterPanel module must export its focused presentation component');
assert.match(parameters, /function NumericField\(/, 'ParameterPanel must own its presentation-only numeric field');
assert.match(parameters, /type="number"/, 'numeric parameter input semantics must be preserved');
assert.match(parameters, /min="0\.01"/, 'numeric parameter minimum must be preserved');
assert.match(parameters, /step="1"/, 'numeric parameter step must be preserved');
assert.match(parameters, /StableRef, а не временный индекс грани/, 'face-selection guidance must be preserved');

assert.match(workspace, /export function usePartSketchWorkspace\(/, 'focused Part/Sketch workspace controller must be exported');
assert.match(workspace, /import type \{ CadApplication \} from '\.\.\/contracts\/application';/, 'workspace must depend on the ASA CadApplication contract');
assert.match(workspace, /app\.execute\(/, 'workspace controller must dispatch geometry only through CadApplication');
assert.match(workspace, /app\.captureReference\(/, 'workspace controller must capture topology through CadApplication');
assert.match(workspace, /useSketchSession\(part\)/, 'workspace must own an explicit SketchSession');
assert.match(workspace, /activeSketchId/, 'workspace must route Sketch commands through explicit activeSketchId');
assert.doesNotMatch(workspace, /latestSketch\(/, 'implicit latest-Sketch active context must not return');
assert.match(sketchSession, /activeSketchId: CadSketchId \| null/, 'SketchSession must own explicit activeSketchId');
assert.match(sketchSession, /resolveActiveSketch/, 'SketchSession must resolve selection by stable Sketch ID');
assert.match(sketchSessionHook, /reconcileSketchSession/, 'React SketchSession owner must invalidate stale IDs after document changes');
for (const forbidden of [
  "../runtime/",
  "../browser/",
  "../host/",
  "vendor/",
  "opencascade",
  "TopoDS",
  "localStorage",
  "indexedDB",
]) {
  assert.equal(workspace.includes(forbidden), false, `Part/Sketch workspace must not own runtime/persistence/vendor internals: ${forbidden}`);
}

for (const [name, source] of [
  ['DocumentTree', tree],
  ['ParameterPanel', parameters],
]) {
  for (const forbidden of [
    "../runtime/",
    "../browser/",
    "../application/",
    "../host/",
    "vendor/",
    "opencascade",
    "TopoDS",
  ]) {
    assert.equal(source.includes(forbidden), false, `${name} must remain presentation-only; forbidden dependency: ${forbidden}`);
  }
}

console.log('M2O O5 decomposition PASS (DocumentTree + ParameterPanel + Part/Sketch workspace controller)');
