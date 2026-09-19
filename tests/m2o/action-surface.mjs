import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const shellTop = readFileSync('src/web/CadShellTop.tsx', 'utf8');
const commandGroups = readFileSync('src/web/CadShellCommandGroups.tsx', 'utf8');
const shellBottom = readFileSync('src/web/CadShellBottom.tsx', 'utf8');
const mobileTools = readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const lineDimensions = readFileSync('src/web/useSketchLineDimensionController.ts', 'utf8');
const circleDimensions = readFileSync('src/web/useSketchCircleDimensionController.ts', 'utf8');
const radiusDimensions = readFileSync('src/web/useSketchRadiusDimensionController.ts', 'utf8');
const dimensionCreation = readFileSync('src/web/useSketchDimensionCreationControllers.ts', 'utf8');
const dimensionPanel = readFileSync('src/web/SketchDimensionParameterPanel.tsx', 'utf8');
const dimensionPresentation = readFileSync('src/web/SketchDimensionPresentation.ts', 'utf8');
const appActionCatalog = readFileSync('src/web/usePartCadUiActionCatalog.ts', 'utf8');

assert.match(app, /usePartCadUiActionCatalog/, 'App must delegate shared CadUiAction catalog wiring');
assert.match(appActionCatalog, /useM2CadUiActions/, 'focused action-catalog owner must build the shared M2 CadUiAction catalog');
assert.match(shellTop, /CadUiActionSearchResults/, 'command search must render CadUiAction results in shell presentation');
assert.match(shellTop, /CadUiGlobalActionButton/, 'global toolbar must render CadUiAction buttons in shell presentation');
assert.match(shellTop, /props\.getAction\('system\.open'\)/, 'Open must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.save'\)/, 'Save must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.undo'\)/, 'Undo must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.redo'\)/, 'Redo must consume the shared action catalog');
assert.match(shellTop, /<CadShellCommandGroups/, 'top shell must delegate ribbon composition to the focused command-group owner');
assert.match(shellTop, /getAction=\{props\.getAction\}/, 'top shell must pass the shared action catalog into command groups');
assert.doesNotMatch(app, /searchableCommands/, 'legacy registry-only command search must not return');
assert.doesNotMatch(shellTop, /title="Открыть" onClick=\{openLocal\}/, 'global Open must not bypass CadUiAction');
assert.doesNotMatch(shellTop, /title="Сохранить \(Ctrl\+S\)" onClick=\{saveLocal\}/, 'global Save must not bypass CadUiAction');

assert.match(app, /cadUiActionIdForShortcut\(action\)/, 'shortcut dispatch must resolve command shortcuts to shared CadUiAction ids');
assert.match(app, /uiActions\.byId\.get\(sharedActionId\)/, 'shortcut dispatch must consume the shared action catalog');
for (const legacyCase of ["case 'system.save':", "case 'system.undo':", "case 'system.redo':", "case 'system.rebuild':", "case 'view.fit':", "case 'view.iso':", "case 'view.front':", "case 'view.top':", "case 'view.left':"]) {
  assert.equal(app.includes(legacyCase), false, `legacy direct shortcut case must not return: ${legacyCase}`);
}
assert.match(app, /case 'interaction\.cancel':/, 'Esc interaction lifecycle must remain explicit');
assert.match(app, /case 'interaction\.commit':/, 'Ctrl+Enter interaction lifecycle must remain explicit');
assert.match(app, /case 'view\.zoomIn':/, 'camera-only zoom remains an interaction action');
assert.match(app, /case 'view\.panLeft':/, 'camera-only pan remains an interaction action');

for (const ribbonActionId of [
  'sketch.rectangle', 'sketch.circle',
  'constraint.horizontal', 'constraint.vertical', 'constraint.fixed', 'constraint.coincident', 'constraint.parallel', 'constraint.perpendicular',
  'dimension.linear', 'dimension.horizontal', 'dimension.vertical', 'dimension.diameter', 'dimension.radius',
  'sketch.finish', 'part.sketch.create', 'part.extrude', 'part.cutExtrude', 'part.fillet', 'system.rebuild',
]) {
  assert.ok(commandGroups.includes(`action={props.getAction('${ribbonActionId}')}`), `${ribbonActionId} ribbon button must consume CadUiAction`);
}
assert.doesNotMatch(commandGroups, /function CommandButton\(/, 'legacy ribbon CommandButton must not return');
assert.doesNotMatch(commandGroups, /<CommandButton\b/, 'legacy direct ribbon command surface must not return');
assert.match(commandGroups, /<ViewCommandGroups viewName=\{props\.viewName\} getAction=\{props\.getAction\}/, 'view ribbon must receive the shared action catalog');
assert.match(commandGroups, /action=\{props\.getAction\(view\.id\)\}/, 'standard view buttons must consume CadUiAction');
assert.doesNotMatch(commandGroups, /requestView: \(value: string\) => void/, 'view ribbon must not own direct requestView handlers');

assert.match(app, /<MobileToolsPanel/, 'phone Tools sheet must be a real presentation surface');
assert.match(app, /getAction=\{uiAction\}/, 'phone Tools sheet must receive the same shared action catalog');
assert.match(shellBottom, /props\.activePanel === 'tools'/, 'mobile bottom bar must expose the Tools panel state');
assert.match(shellBottom, />⌘<span>Инструменты<\/span><\/button>/, 'mobile bottom bar must expose Tools instead of desktop delegation');
assert.match(mobileTools, /import type \{ CadUiAction \}/, 'mobile Tools presentation must consume typed CadUiAction');
assert.match(mobileTools, /props\.getAction\(tool\.id\)/, 'mobile Tool buttons must resolve shared action objects');
for (const id of ['horizontal', 'vertical', 'fixed', 'coincident', 'parallel', 'perpendicular']) assert.match(mobileTools, new RegExp(`id: 'constraint\\.${id}'`), `mobile Sketch tools must expose ${id} through CadUiAction`);
for (const id of ['linear', 'horizontal', 'vertical', 'diameter', 'radius']) assert.match(mobileTools, new RegExp(`id: 'dimension\\.${id}'`), `mobile Sketch tools must expose dimension.${id} through CadUiAction`);
assert.doesNotMatch(mobileTools, /querySelector|querySelectorAll|\.click\(\)/, 'mobile Tools must never discover/click desktop DOM');

assert.match(workspace, /useSketchDimensionCreation/, 'workspace must compose focused dimension creation owners');
assert.match(dimensionCreation, /useSketchLineDimensionController/, 'dimension creation composition must retain the selected-Line owner');
assert.match(dimensionCreation, /useSketchCircleDimensionController/, 'dimension creation composition must retain the focused Diameter Circle owner');
assert.match(dimensionCreation, /useSketchRadiusDimensionController/, 'dimension creation composition must add the focused Circle-or-Arc Radius owner');
assert.match(lineDimensions, /'linear' \| 'horizontal' \| 'vertical'/, 'selected-Line owner must remain Linear/H/V only');
assert.doesNotMatch(lineDimensions, /diameter/, 'selected-Line owner must not absorb Circle Diameter responsibility');
assert.match(circleDimensions, /id: 'dimension\.diameter'/, 'Circle owner must commit only the Diameter command');
assert.match(circleDimensions, /selectedEntity\?\.type === 'circle'/, 'Diameter eligibility must be Circle-only');
assert.doesNotMatch(circleDimensions, /dimension\.radius/, 'Diameter owner must not absorb Radius responsibility');
assert.doesNotMatch(circleDimensions, /PlaneGCS|BrowserSketchSolver|localStorage|querySelector|undoStack|redoStack/, 'Circle dimension owner must not absorb solver/persistence/DOM/history responsibilities');
assert.match(radiusDimensions, /id: 'dimension\.radius'/, 'Radius owner must commit only the Radius command');
assert.match(radiusDimensions, /selectedEntity\?\.type === 'circle'.*selectedEntity\?\.type === 'arc'/s, 'Radius eligibility must be Circle-or-Arc');
assert.match(radiusDimensions, /data\.diameter \/ 2/, 'Radius Circle initial value must be half the persisted diameter');
assert.match(radiusDimensions, /data\.radius/, 'Radius Arc initial value must use persisted arc radius');
assert.doesNotMatch(radiusDimensions, /PlaneGCS|BrowserSketchSolver|localStorage|querySelector|undoStack|redoStack/, 'Radius owner must not absorb solver/persistence/DOM/history responsibilities');
assert.match(dimensionPresentation, /type === 'linear'.*Линейный размер/, 'canonical presentation must name Linear Dimension');
assert.match(dimensionPresentation, /type === 'horizontal'.*Горизонтальный размер/, 'canonical presentation must name Horizontal Dimension');
assert.match(dimensionPresentation, /type === 'vertical'.*Вертикальный размер/, 'canonical presentation must name Vertical Dimension');
assert.match(dimensionPresentation, /type === 'diameter'.*Диаметральный размер/, 'canonical presentation must name product Diameter Dimension');
assert.match(dimensionPresentation, /type === 'radius'.*Радиальный размер/, 'canonical presentation must name product Radius Dimension');
assert.match(dimensionPanel, /Выбранная окружность/, 'Circle dimension Parameters must present the selected Circle');
assert.match(dimensionPanel, /Выбранная дуга/, 'Radius Parameters must present the selected Arc');
assert.match(dimensionPanel, /Изменить размер/, 'existing dimension edit presentation must remain distinct');

console.log('M2O O4 action surfaces PASS (shell delegates focused shared-action command groups; desktop/mobile/search stay unified)');
