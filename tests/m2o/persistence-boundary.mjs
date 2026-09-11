import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/web/App.tsx', 'utf8');

assert.doesNotMatch(appSource, /\blocalStorage\b/, 'App.tsx must not access localStorage directly');
assert.doesNotMatch(appSource, /\bserializeCadDocument\b/, 'App.tsx must not serialize project persistence directly');
assert.doesNotMatch(appSource, /\bparseCadDocument\b/, 'App.tsx must not parse project persistence directly');
assert.match(appSource, /useCadProjectPersistence/, 'App.tsx must use the editor persistence hook');
const persistenceHook = readFileSync('src/web/useCadProjectPersistence.ts', 'utf8');
assert.match(persistenceHook, /CadEditorPersistence/, 'persistence hook must use CadEditorPersistence');
assert.match(persistenceHook, /CadProjectSession/, 'persistence hook must construct CadProjectSession');

console.log('M2O O3 persistence architecture PASS (App -> CadEditorPersistence -> CadProjectSession/Host)');
