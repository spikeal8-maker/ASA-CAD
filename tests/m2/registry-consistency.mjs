import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const commandRegistry = JSON.parse(await readFile(new URL('../../spec/ui/command-registry.v1.json', import.meta.url), 'utf8'));
const layoutRegistry = JSON.parse(await readFile(new URL('../../spec/ui/layout-registry.v2.json', import.meta.url), 'utf8'));

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
assert.deepEqual([...new Set(missing)].sort(), [], `layout-registry references unknown command IDs: ${[...new Set(missing)].sort().join(', ')}`);

const implementedIds = commandRegistry.commands.filter((entry) => entry.status === 'implemented').map((entry) => entry.id);
const implementationExceptions = new Set([
  'system.new',
  'system.open',
  'system.save',
  'system.undo',
  'system.redo',
  'system.rebuild',
  'system.search',
  'system.settings',
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
  assert.ok(referenced.has(id) || implementationExceptions.has(id), `implemented command ${id} has no layout placement`);
}

const duplicateIds = commandRegistry.commands.map((entry) => entry.id).filter((id, index, all) => all.indexOf(id) !== index);
assert.deepEqual(duplicateIds, [], `duplicate command IDs: ${duplicateIds.join(', ')}`);

console.log(`ASA-CAD UI registry consistency PASS (${commands.size} commands; ${referenced.size} layout references)`);
