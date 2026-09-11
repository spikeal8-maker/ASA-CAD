import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const tree = readFileSync('src/web/DocumentTree.tsx', 'utf8');
const parameters = readFileSync('src/web/ParameterPanel.tsx', 'utf8');

assert.match(app, /import \{ DocumentTree \} from '\.\/DocumentTree';/, 'App must import extracted DocumentTree');
assert.doesNotMatch(app, /function DocumentTree\(/, 'DocumentTree implementation must not return to App.tsx');
assert.doesNotMatch(app, /function TreeRow\(/, 'TreeRow implementation must not return to App.tsx');
assert.match(app, /<DocumentTree\b/, 'App must render the extracted DocumentTree component');

assert.match(app, /import \{ ParameterPanel \} from '\.\/ParameterPanel';/, 'App must import extracted ParameterPanel');
assert.doesNotMatch(app, /function ParameterPanel\(/, 'ParameterPanel implementation must not return to App.tsx');
assert.doesNotMatch(app, /function NumericField\(/, 'NumericField implementation must not return to App.tsx');
assert.doesNotMatch(app, /commandRegistryJson/, 'App must not own ParameterPanel command-label metadata after extraction');
assert.match(app, /<ParameterPanel\b/, 'App must render the extracted ParameterPanel component');

assert.match(tree, /export function DocumentTree\(/, 'DocumentTree module must export its focused presentation component');
assert.match(tree, /data-body-id=\{props\.bodyId\}/, 'tree/body selection DOM contract must be preserved');
assert.match(tree, /aria-pressed=\{props\.bodyId \? Boolean\(props\.selected\) : undefined\}/, 'tree accessibility selection contract must be preserved');

assert.match(parameters, /export function ParameterPanel\(/, 'ParameterPanel module must export its focused presentation component');
assert.match(parameters, /function NumericField\(/, 'ParameterPanel must own its presentation-only numeric field');
assert.match(parameters, /type="number"/, 'numeric parameter input semantics must be preserved');
assert.match(parameters, /min="0\.01"/, 'numeric parameter minimum must be preserved');
assert.match(parameters, /step="1"/, 'numeric parameter step must be preserved');
assert.match(parameters, /StableRef, а не временный индекс грани/, 'face-selection guidance must be preserved');

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

console.log('M2O O5 decomposition PASS (DocumentTree + ParameterPanel focused presentation boundaries)');
