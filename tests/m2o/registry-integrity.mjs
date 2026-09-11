import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const commandRegistry = JSON.parse(readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
const layoutRegistry = JSON.parse(readFileSync('spec/ui/layout-registry.v2.json', 'utf8'));

const ALLOWED_STATUSES = new Set(['planned', 'implemented', 'experimental', 'deferred']);

const REQUIRED_IMPLEMENTED_M2 = new Set([
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
  'part.sketch.create',
  'part.extrude',
  'part.cutExtrude',
  'part.fillet',
  'sketch.rectangle',
  'sketch.circle',
  'dimension.linear',
  'sketch.finish',
]);

// These IDs existed in an older planning registry but duplicate the canonical
// KOMPAS-inventory/layout IDs. Reintroducing them would recreate drift.
const FORBIDDEN_LEGACY_IDS = new Set([
  'part.pattern.linear',
  'part.check.geometry',
  'view.measure',
  'draft.hatch',
  'drawing.sheet.add',
  'drawing.sheet.format',
  'drawing.sheet.orientation',
  'drawing.sheet.scale',
  'spec.generate',
  'spec.refresh',
  'spec.section.add',
  'spec.row.add',
  'spec.position.assign',
  'spec.sort',
  'text.table.insert',
  'text.symbol.insert',
  'text.linkDocument',
]);

assert.ok(Array.isArray(commandRegistry.commands), 'command-registry.v1.json must contain commands[]');

const commandById = new Map();
for (const command of commandRegistry.commands) {
  assert.equal(typeof command.id, 'string', 'Every command must have a string id');
  assert.ok(command.id.length > 0, 'Command id must not be empty');
  assert.ok(!commandById.has(command.id), `Duplicate command-registry id: ${command.id}`);
  assert.ok(!FORBIDDEN_LEGACY_IDS.has(command.id), `${command.id}: legacy duplicate command ID must not return`);
  commandById.set(command.id, command);
  assert.ok(
    ALLOWED_STATUSES.has(command.status),
    `${command.id}: unsupported status '${command.status}'. Allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
  );
}

for (const id of REQUIRED_IMPLEMENTED_M2) {
  const command = commandById.get(id);
  assert.ok(command, `Accepted M2 command missing from command registry: ${id}`);
  assert.equal(command.status, 'implemented', `${id}: accepted M2 command must remain status=implemented`);
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
  `M2O registry integrity PASS (${commandById.size} commands; ${layoutCommandPaths.size} layout command references; ${REQUIRED_IMPLEMENTED_M2.size} protected M2 statuses)`,
);
