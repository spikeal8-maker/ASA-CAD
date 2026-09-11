import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');

assert.match(app, /useM2CadUiActions/, 'App must build the shared M2 CadUiAction catalog');
assert.match(app, /CadUiActionSearchResults/, 'command search must render CadUiAction results');
assert.match(app, /CadUiGlobalActionButton/, 'global toolbar must render CadUiAction buttons');
assert.match(app, /uiAction\('system\.open'\)/, 'Open must consume the shared action catalog');
assert.match(app, /uiAction\('system\.save'\)/, 'Save must consume the shared action catalog');
assert.match(app, /uiAction\('system\.undo'\)/, 'Undo must consume the shared action catalog');
assert.match(app, /uiAction\('system\.redo'\)/, 'Redo must consume the shared action catalog');
assert.doesNotMatch(app, /searchableCommands/, 'legacy registry-only command search must not return');
assert.doesNotMatch(app, /title="Открыть" onClick=\{openLocal\}/, 'global Open must not bypass CadUiAction');
assert.doesNotMatch(app, /title="Сохранить \(Ctrl\+S\)" onClick=\{saveLocal\}/, 'global Save must not bypass CadUiAction');
assert.doesNotMatch(app, /title="Отменить \(Ctrl\+Z\)" onClick=\{undo\}/, 'global Undo must not bypass CadUiAction');
assert.doesNotMatch(app, /title="Повторить \(Ctrl\+Y \/ Ctrl\+Shift\+Z\)" onClick=\{redo\}/, 'global Redo must not bypass CadUiAction');

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
// Interaction lifecycle and camera pan/zoom intentionally remain direct interaction actions.
assert.match(app, /case 'interaction\.cancel':/, 'Esc interaction lifecycle must remain explicit');
assert.match(app, /case 'interaction\.commit':/, 'Ctrl+Enter interaction lifecycle must remain explicit');
assert.match(app, /case 'view\.zoomIn':/, 'camera-only zoom remains an interaction action');
assert.match(app, /case 'view\.panLeft':/, 'camera-only pan remains an interaction action');

for (const ribbonActionId of [
  'sketch.rectangle',
  'sketch.circle',
  'sketch.finish',
  'part.sketch.create',
  'part.extrude',
  'part.cutExtrude',
  'part.fillet',
  'system.rebuild',
]) {
  assert.match(
    app,
    new RegExp(`CadUiActionButton action=\\{uiAction\\('${ribbonActionId.replaceAll('.', '\\.')} '\)?`),
    `${ribbonActionId} ribbon button must consume CadUiAction`,
  );
}
assert.doesNotMatch(app, /function CommandButton\(/, 'legacy ribbon CommandButton must not return');
assert.doesNotMatch(app, /<CommandButton\b/, 'legacy direct ribbon command surface must not return');
assert.match(app, /<ViewCommandGroups viewName=\{viewName\} getAction=\{uiAction\}/, 'view ribbon must receive the shared action catalog');
assert.match(app, /action=\{props\.getAction\(view\.id\)\}/, 'standard view buttons must consume CadUiAction');
assert.doesNotMatch(app, /requestView: \(value: string\) => void/, 'view ribbon must not own direct requestView handlers');

console.log('M2O O4 action surfaces PASS (toolbar/search + shortcuts + ribbon)');
