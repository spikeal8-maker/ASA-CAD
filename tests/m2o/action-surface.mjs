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

console.log('M2O O4 global toolbar/search surface PASS (shared CadUiAction path)');
