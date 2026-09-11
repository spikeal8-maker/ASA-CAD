import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const commandRegistry = JSON.parse(readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
const layoutRegistry = JSON.parse(readFileSync('spec/ui/layout-registry.v2.json', 'utf8'));

const ALLOWED_STATUSES = new Set(['planned', 'implemented', 'experimental', 'deferred']);

assert.ok(Array.isArray(commandRegistry.commands), 'command-registry.v1.json must contain commands[]');

const commandById = new Map();
for (const command of commandRegistry.commands) {
  assert.equal(typeof command.id, 'string', 'Every command must have a string id');
  assert.ok(command.id.length > 0, 'Command id must not be empty');
  assert.ok(!commandById.has(command.id), `Duplicate command-registry id: ${command.id}`);
  commandById.set(command.id, command);
  assert.ok(
    ALLOWED_STATUSES.has(command.status),
    `${command.id}: unsupported status '${command.status}'. Allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
  );
}

const layoutCommandPaths = new Map();

function walk(value, path = 'layout') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === 'commands' && Array.isArray(child)) {
      child.forEach((commandId, index) => {
        assert.equal(typeof commandId, 'string', `${childPath}[${index}] must be a string command id`);
        const usages = layoutCommandPaths.get(commandId) ?? [];
        usages.push(`${childPath}[${index}]`);
        layoutCommandPaths.set(commandId, usages);
      });
    } else {
      walk(child, childPath);
    }
  }
}

walk(layoutRegistry);

const missingFromCommandRegistry = [...layoutCommandPaths.keys()]
  .filter((id) => !commandById.has(id))
  .sort();

assert.deepEqual(
  missingFromCommandRegistry,
  [],
  `layout-registry references unknown command ids:\n${missingFromCommandRegistry
    .map((id) => `- ${id} @ ${layoutCommandPaths.get(id).join(', ')}`)
    .join('\n')}`,
);

for (const [id, command] of commandById) {
  if (command.status === 'implemented' && command.backendCommand !== undefined) {
    assert.equal(typeof command.backendCommand, 'string', `${id}: implemented backendCommand must be a string`);
    assert.ok(command.backendCommand.length > 0, `${id}: implemented backendCommand must not be empty`);
  }
}

console.log(
  `M2O registry integrity PASS (${commandById.size} commands; ${layoutCommandPaths.size} layout command references)`,
);
