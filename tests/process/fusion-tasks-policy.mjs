import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRegistry } from '../../scripts/fusion-tasks.mjs';

const registry = JSON.parse(readFileSync(new URL('../../spec/process/fusion-tasks.v1.json', import.meta.url), 'utf8'));
assert.deepEqual(validateRegistry(registry), [], 'Published definitions must form a valid task registry');

function rejects(name, mutate, expected) {
  const invalid = structuredClone(registry);
  mutate(invalid);
  assert.match(validateRegistry(invalid).join('\n'), expected, name);
}
rejects('dependency cycle', data => {
  data.tasks.find(task => task.id === 'R01').depends_on.push('F04');
}, /Dependency cycle:/);
rejects('unknown dependency', data => {
  data.tasks.find(task => task.id === 'F04').depends_on.push('UNKNOWN');
}, /Unknown dependency: F04 -> UNKNOWN/);
rejects('duplicate task ID', data => {
  data.tasks.push(structuredClone(data.tasks[0]));
}, /Duplicate task ID:/);
rejects('missing required release dependency', data => {
  for (const task of data.tasks) task.depends_on = task.depends_on.filter(id => id !== 'S05');
}, /F04 missing required dependency: S05/);

console.log(`Fusion task policy PASS: ${registry.tasks.length} definitions; cycle, unknown dependency, duplicate ID and missing F04 gate rejected`);
