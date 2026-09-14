import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const shellTop = readFileSync('src/web/CadShellTop.tsx', 'utf8');
const shellBottom = readFileSync('src/web/CadShellBottom.tsx', 'utf8');
const mobileTools = readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');

assert.match(app, /useM2CadUiActions/, 'App must build the shared M2 CadUiAction catalog');
assert.match(shellTop, /CadUiActionSearchResults/, 'command search must render CadUiAction results in shell presentation');
assert.match(shellTop, /CadUiGlobalActionButton/, 'global toolbar must render CadUiAction buttons in shell presentation');
assert.match(shellTop, /props\.getAction\('system\.open'\)/, 'Open must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.save'\)/, 'Save must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.undo'\)/, 'Undo must consume the shared action catalog');
assert.match(shellTop, /props\.getAction\('system\.redo'\)/, 'Redo must consume the shared action catalog');
assert.doesNotMatch(app, /searchableCommands/, 'legacy registry-only command search must not return');
assert.doesNotMatch(shellTop, /title="Открыть" onClick=\{openLocal\}/, 'global Open must not bypass CadUiAction');
assert.doesNotMatch(shellTop, /title="Сохранить \(Ctrl\+S\)" onClick=\{saveLocal\}/, 'global Save must not bypass CadUiAction');
assert.doesNotMatch(shellTop, /title="Отменить \(Ctrl\+Z\)" onClick=\{undo\}/, 'global Undo must not bypass CadUiAction');
assert.doesNotMatch(shellTop, /title="Повторить \(Ctrl\+Y \/ Ctrl\+Shift\+Z\)" onClick=\{redo\}/, 'global Redo must not bypass CadUiAction');

assert.match(app, /cadUiActionIdForShortcut\(action\)/, 'shortcut dispatch must resolve command shortcuts to shared CadUiAction ids');
assert.match(app, /uiActions\.byId\.get\(sharedActionId\)/, 'shortcut dispatch must consume the shared action catalog');
for (const legacyCase of [
  "case 'system.save':",
  "case 'system.undo':",
  "case 'system.redo':",
  "case 'system.rebuild':",
  "case 'view.fit':",
  "case 'view.iso':",
  "case 'view.front':",
  "case 'view.top':",
  "case 'view.left':",
]) {
  assert.equal(app.includes(legacyCase), false, `legacy direct shortcut case must not return: ${legacyCase}`);
}
assert.match(app, /case 'interaction\.cancel':/, 'Esc interaction lifecycle must remain explicit');
assert.match(app, /case 'interaction\.commit':/, 'Ctrl+Enter interaction lifecycle must remain explicit');
assert.match(app, /case 'view\.zoomIn':/, 'camera-only zoom remains an interaction action');
assert.match(app, /case 'view\.panLeft':/, 'camera-only pan remains an interaction action');

for (const ribbonActionId of [
  'sketch.rectangle',
  'sketch.circle',
  'constraint.horizontal',
  'constraint.vertical',
  'sketch.finish',
  'part.sketch.create',
  'part.extrude',
  'part.cutExtrude',
  'part.fillet',
  'system.rebuild',
]) {
  assert.ok(
    shellTop.includes(`action={props.getAction('${ribbonActionId}')}`),
    `${ribbonActionId} ribbon button must consume CadUiAction`,
  );
}
assert.doesNotMatch(shellTop, /function CommandButton\(/, 'legacy ribbon CommandButton must not return');
assert.doesNotMatch(shellTop, /<CommandButton\b/, 'legacy direct ribbon command surface must not return');
assert.match(shellTop, /<ViewCommandGroups viewName=\{props\.viewName\} getAction=\{props\.getAction\}/, 'view ribbon must receive the shared action catalog');
assert.match(shellTop, /action=\{props\.getAction\(view\.id\)\}/, 'standard view buttons must consume CadUiAction');
assert.doesNotMatch(shellTop, /requestView: \(value: string\) => void/, 'view ribbon must not own direct requestView handlers');

assert.match(app, /<MobileToolsPanel/, 'phone Tools sheet must be a real presentation surface');
assert.match(app, /getAction=\{uiAction\}/, 'phone Tools sheet must receive the same shared action catalog');
assert.match(shellBottom, /props\.activePanel === 'tools'/, 'mobile bottom bar must expose the Tools panel state');
assert.match(shellBottom, />⌘<span>Инструменты<\/span><\/button>/, 'mobile bottom bar must expose Tools instead of desktop delegation');
assert.match(mobileTools, /import type \{ CadUiAction \}/, 'mobile Tools presentation must consume typed CadUiAction');
assert.match(mobileTools, /props\.getAction\(tool\.id\)/, 'mobile Tool buttons must resolve shared action objects');
assert.match(mobileTools, /id: 'constraint\.horizontal'/, 'mobile Sketch tools must expose Horizontal through CadUiAction');
assert.match(mobileTools, /id: 'constraint\.vertical'/, 'mobile Sketch tools must expose Vertical through CadUiAction');
assert.doesNotMatch(mobileTools, /querySelector|querySelectorAll|\.click\(\)/, 'mobile Tools must never discover/click desktop DOM');

console.log('M2O O4 action surfaces PASS (App action owner + H/V ribbon/mobile surfaces + extracted shell presentation)');
