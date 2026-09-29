import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import {
  createCadUiActions,
  indexCadUiActions,
  isCadUiActionVisible,
  type CadUiCommandDefinition,
} from '../../src/web/CadUiAction';

const definitions = commandRegistryJson.commands as CadUiCommandDefinition[];
const byId = indexCadUiActions(createCadUiActions(definitions, {
  'part.extrude': { execute: () => undefined },
  'part.revolve': { execute: () => { throw new Error('planned command must never execute'); } },
  'part.collection': { execute: () => { throw new Error('deferred command must never execute'); } },
}));
const implemented = byId.get('part.extrude');
const planned = byId.get('part.revolve');
const deferred = byId.get('part.collection');
assert.ok(implemented && planned && deferred);
assert.equal(implemented.status, 'implemented');
assert.equal(planned.status, 'planned');
assert.equal(deferred.status, 'deferred');

assert.equal(isCadUiActionVisible(implemented, false), true, 'implemented command must remain visible in production');
assert.equal(isCadUiActionVisible(planned, false), false, 'planned command must be hidden in production');
assert.equal(isCadUiActionVisible(deferred, false), false, 'deferred command must be hidden in production');
assert.equal(isCadUiActionVisible(planned, true), true, 'planned command may be visible in explicit dev reference mode');
assert.equal(isCadUiActionVisible(deferred, true), true, 'deferred command may be visible in explicit dev reference mode');
assert.equal(planned.enabled, false, 'planned command must remain disabled in dev reference mode');
assert.equal(deferred.enabled, false, 'deferred command must remain disabled in dev reference mode');

const app = readFileSync('src/web/App.tsx', 'utf8');
const controls = readFileSync('src/web/CadUiActionControls.tsx', 'utf8');
const shellTop = readFileSync('src/web/CadShellTop.tsx', 'utf8');
const referenceGroups = readFileSync('src/web/CadShellReferenceGroups.tsx', 'utf8');
assert.match(app, /showRoadmapCommands=\{devFixture !== null\}/);
assert.doesNotMatch(app, /location\.hostname|hostname\.includes|localhost/);
assert.match(controls, /if \(!isCadUiActionVisible\(action, props\.showRoadmapCommands\)\) return null/);
assert.match(controls, /actions\.filter\(\(action\) => isCadUiActionVisible\(action, props\.showRoadmapCommands\)\)/);
assert.match(shellTop, /showRoadmapCommands=\{props\.showRoadmapCommands\}/);
assert.match(referenceGroups, /showRoadmapCommands=\{props\.showRoadmapCommands\}/);

const commandIds = new Set(definitions.map((command) => command.id));
const tupleIds = [...referenceGroups.matchAll(/\['([^']+)',\s*'[^']+'\]/g)].map((match) => match[1]);
const singletonIds = [...referenceGroups.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const referencedIds = [...new Set([...tupleIds, ...singletonIds])];
const unknownIds = referencedIds.filter((id) => !commandIds.has(id)).sort();
assert.deepEqual(unknownIds, [], `CadShellReferenceGroups contains unknown command IDs: ${unknownIds.join(', ')}`);

console.log(`KOMPAS shell command visibility PASS (production hides planned/deferred; dev reference shows disabled; ${referencedIds.length} reference IDs known)`);
