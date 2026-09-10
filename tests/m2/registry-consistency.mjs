import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const commandRegistry = JSON.parse(await readFile(new URL('../../spec/ui/command-registry.v1.json', import.meta.url), 'utf8'));
const layoutRegistry = JSON.parse(await readFile(new URL('../../spec/ui/layout-registry.v2.json', import.meta.url), 'utf8'));

const allowedStatuses = new Set(['implemented', 'experimental', 'planned', 'deferred']);
const commands = new Map(commandRegistry.commands.map((entry) => [entry.id, entry]));
const referenced = new Set();
const missing = [];

function collect(value) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item);
    return;
  }
  if (typeof value !== 'object') return;
  if (Array.isArray(value.commands)) {
    for (const id of value.commands) {
      referenced.add(id);
      if (!commands.has(id)) missing.push(id);
    }
  }
  for (const nested of Object.values(value)) collect(nested);
}

collect(layoutRegistry.workspaces);
assert.deepEqual(
  [...new Set(missing)].sort(),
  [],
  `layout-registry references unknown command IDs: ${[...new Set(missing)].sort().join(', ')}`,
);

for (const entry of commandRegistry.commands) {
  assert.ok(allowedStatuses.has(entry.status), `${entry.id}: unsupported status ${entry.status}`);
  assert.equal(typeof entry.labelRu, 'string', `${entry.id}: labelRu is required`);
  assert.ok(entry.labelRu.trim().length > 0, `${entry.id}: empty labelRu`);
}

const implementedIds = commandRegistry.commands.filter((entry) => entry.status === 'implemented').map((entry) => entry.id);
const shellPlacement = new Set([
  'system.new',
  'system.open',
  'system.save',
  'system.undo',
  'system.redo',
  'system.rebuild',
  'system.search',
  'system.settings',
  'command.cancel',
  'view.fit',
  'view.front',
  'view.back',
  'view.top',
  'view.bottom',
  'view.left',
  'view.right',
  'view.iso',
]);

for (const id of implementedIds) {
  assert.ok(referenced.has(id) || shellPlacement.has(id), `implemented command ${id} has no shell/layout placement`);
}

const acceptedM2Commands = [
  'system.new',
  'system.undo',
  'system.redo',
  'system.rebuild',
  'command.cancel',
  'view.fit',
  'view.front',
  'view.back',
  'view.top',
  'view.bottom',
  'view.left',
  'view.right',
  'view.iso',
  'part.sketch.create',
  'sketch.rectangle',
  'sketch.circle',
  'sketch.finish',
  'part.extrude',
  'part.cutExtrude',
  'part.fillet',
];
for (const id of acceptedM2Commands) {
  assert.equal(commands.get(id)?.status, 'implemented', `${id}: accepted M2 command must be marked implemented`);
}

const duplicateIds = commandRegistry.commands.map((entry) => entry.id).filter((id, index, all) => all.indexOf(id) !== index);
assert.deepEqual(duplicateIds, [], `duplicate command IDs: ${duplicateIds.join(', ')}`);

assert.equal(
  layoutRegistry.rules?.sourceOfCommandIdentity,
  'spec/ui/command-registry.v1.json',
  'layout registry must declare command-registry as command identity authority',
);

console.log(`ASA-CAD UI registry consistency PASS (${commands.size} commands; ${referenced.size} layout references; ${implementedIds.length} implemented)`);
