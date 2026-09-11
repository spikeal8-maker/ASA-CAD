import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const tree = readFileSync('src/web/DocumentTree.tsx', 'utf8');

assert.match(app, /import \{ DocumentTree \} from '\.\/DocumentTree';/, 'App must import extracted DocumentTree');
assert.doesNotMatch(app, /function DocumentTree\(/, 'DocumentTree implementation must not return to App.tsx');
assert.doesNotMatch(app, /function TreeRow\(/, 'TreeRow implementation must not return to App.tsx');
assert.match(app, /<DocumentTree\b/, 'App must render the extracted DocumentTree component');

assert.match(tree, /export function DocumentTree\(/, 'DocumentTree module must export its focused presentation component');
assert.match(tree, /data-body-id=\{props\.bodyId\}/, 'tree/body selection DOM contract must be preserved');
assert.match(tree, /aria-pressed=\{props\.bodyId \? Boolean\(props\.selected\) : undefined\}/, 'tree accessibility selection contract must be preserved');
for (const forbidden of [
  "../runtime/",
  "../browser/",
  "../application/",
  "../host/",
  "vendor/",
  "opencascade",
  "TopoDS",
]) {
  assert.equal(tree.includes(forbidden), false, `DocumentTree must remain presentation-only; forbidden dependency: ${forbidden}`);
}

console.log('M2O O5.1 DocumentTree extraction PASS (focused presentation boundary)');
