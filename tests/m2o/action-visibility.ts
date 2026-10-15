import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import {
  createCadUiActions,
  indexCadUiActions,
  isCadUiActionVisible,
  executeCadUiAction,
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

assert.equal(isCadUiActionVisible(implemented, false), true, 'optional action filter retains implemented commands');
assert.equal(isCadUiActionVisible(planned, false), false, 'optional action filter omits planned commands');
assert.equal(isCadUiActionVisible(deferred, false), false, 'optional action filter omits deferred commands');
assert.equal(isCadUiActionVisible(planned, true), true, 'planned command may be visible in explicit dev reference mode');
assert.equal(isCadUiActionVisible(deferred, true), true, 'deferred command may be visible in explicit dev reference mode');
assert.equal(planned.enabled, false, 'planned command must remain disabled in dev reference mode');
assert.equal(deferred.enabled, false, 'deferred command must remain disabled in dev reference mode');

const app = readFileSync('src/web/App.tsx', 'utf8');
const mobile = readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const shellTop = readFileSync('src/web/CadShellTop.tsx', 'utf8');
const kTop = readFileSync('src/web/kompas/KompasTop.tsx', 'utf8');
const ribbon = readFileSync('src/web/kompas/KompasRibbon.tsx', 'utf8');
assert.match(app, /showRoadmapCommands=\{devFixture !== null\}/);
assert.doesNotMatch(app, /location\.hostname|hostname\.includes|localhost/);
assert.match(mobile, /disabled=\{!action\.enabled\}/, 'mobile Tools cannot execute an unavailable action');
assert.match(mobile, /action=\{props\.getAction\(tool\.id\)\}/, 'mobile Tools use the shared action objects');
assert.match(shellTop, /<KompasTop/, 'every UI surface uses the canonical KOMPAS shell');
assert.match(kTop, /lookup\(getAction, target\)/, 'new KOMPAS commands read the shared action catalog');
assert.match(kTop, /if \(!action\.enabled\)/, 'disabled/planned actions must never execute');
assert.match(ribbon, /data-st=\{status\}/, 'KOMPAS ribbon labels the actual implementation status');
assert.match(ribbon, /kompasShell\.run\(command\.id, command\.label\)/, 'visible KOMPAS reference commands go through the guarded resolver');
assert.doesNotMatch(ribbon, /isCadUiActionVisible/, 'KOMPAS reference ribbon retains status-marked roadmap commands');
assert.equal(await executeCadUiAction(planned), false, 'planned executor must never run');
assert.equal(await executeCadUiAction(deferred), false, 'deferred executor must never run');

console.log('KOMPAS visibility PASS (status-marked reference ribbon; shared mobile actions; unavailable actions never execute)');
