#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const registryUrl = new URL('../spec/process/fusion-tasks.v1.json', import.meta.url);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const dependencies = task => Array.isArray(task?.depends_on) ? task.depends_on : [];

// Definitions only: this function neither reads nor changes GitHub execution state.
export function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema_version !== 1) return ['Expected registry schema_version 1'];
  if (!/^[\w.-]+\/[\w.-]+$/.test(registry.repository ?? '')) errors.push('Invalid repository owner/name');
  for (const key of ['tasks', 'planned_slices', 'acceptance_cases']) {
    if (!Array.isArray(registry[key]) || !registry[key].length) errors.push(`Expected nonempty ${key}`);
  }
  if (errors.length) return errors;
  const tasks = new Map(), issues = new Set(), slices = new Set(), cases = new Set();
  for (const task of registry.tasks) {
    if (!nonempty(task?.id)) { errors.push('Missing task ID'); continue; }
    if (tasks.has(task.id)) errors.push(`Duplicate task ID: ${task.id}`);
    else tasks.set(task.id, task);
    if (!Number.isSafeInteger(task.issue) || task.issue < 1) errors.push(`Invalid issue: ${task.id}`);
    else if (issues.has(task.issue)) errors.push(`Duplicate issue: ${task.issue}`);
    else issues.add(task.issue);
    for (const key of ['title', 'acceptance', 'planned_slice_id']) {
      if (!nonempty(task[key])) errors.push(`Missing ${key}: ${task.id}`);
    }
    if (!Array.isArray(task.depends_on)) errors.push(`Expected depends_on array: ${task.id}`);
    if (new Set(dependencies(task)).size !== dependencies(task).length) errors.push(`Duplicate dependency: ${task.id}`);
  }
  for (const task of tasks.values()) {
    for (const dep of dependencies(task)) if (!tasks.has(dep)) errors.push(`Unknown dependency: ${task.id} -> ${dep}`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) { errors.push(`Dependency cycle: ${[...path, id].join(' -> ')}`); return; }
    if (visited.has(id) || !tasks.has(id)) return;
    visiting.add(id);
    for (const dep of dependencies(tasks.get(id))) visit(dep, [...path, id]);
    visiting.delete(id); visited.add(id);
  }
  for (const id of tasks.keys()) visit(id);
  const membership = new Map();
  for (const slice of registry.planned_slices) {
    if (!nonempty(slice?.id) || slices.has(slice.id)) errors.push(`Invalid/duplicate slice ID: ${slice?.id}`);
    slices.add(slice?.id);
    if (!Array.isArray(slice?.task_ids) || !slice.task_ids.length) { errors.push(`Empty slice: ${slice?.id}`); continue; }
    for (const id of slice.task_ids) {
      membership.set(id, (membership.get(id) ?? 0) + 1);
      if (!tasks.has(id)) errors.push(`Unknown slice task: ${slice.id} -> ${id}`);
      else if (tasks.get(id).planned_slice_id !== slice.id) errors.push(`Slice mismatch: ${id} -> ${slice.id}`);
    }
  }
  for (const id of tasks.keys()) if (membership.get(id) !== 1) errors.push(`Task must belong to exactly one slice: ${id}`);
  for (const entry of registry.acceptance_cases) {
    if (!nonempty(entry?.id) || cases.has(entry.id)) errors.push(`Invalid/duplicate acceptance ID: ${entry?.id}`);
    cases.add(entry?.id);
    if (!Array.isArray(entry?.task_ids) || !entry.task_ids.length) { errors.push(`Empty acceptance task_ids: ${entry?.id}`); continue; }
    if (new Set(entry.task_ids).size !== entry.task_ids.length) errors.push(`Duplicate acceptance task: ${entry.id}`);
    for (const id of entry.task_ids) if (!tasks.has(id)) errors.push(`Unknown acceptance task: ${entry.id} -> ${id}`);
  }
  const required = registry.scope?.first_release_required_task_ids;
  if (!Array.isArray(required) || !required.length) errors.push('Missing F04 required task IDs');
  else {
    const reachable = new Set();
    function collect(id) { if (reachable.has(id)) return; reachable.add(id); dependencies(tasks.get(id)).forEach(collect); }
    dependencies(tasks.get('F04')).forEach(collect);
    if (!tasks.has('F04')) errors.push('Missing F04 release gate');
    if (new Set(required).size !== required.length) errors.push('Duplicate F04 required task ID');
    for (const id of required) {
      if (!tasks.has(id)) errors.push(`Unknown F04 required task: ${id}`);
      else if (!reachable.has(id)) errors.push(`F04 missing required dependency: ${id}`);
    }
  }
  return errors;
}

function run(args) {
  const [command = 'list', id, ...extra] = args;
  if (!['list', 'show', 'next', 'validate'].includes(command) || extra.length || (command === 'show' ? !id : id)) {
    throw new Error('Usage: node scripts/fusion-tasks.mjs list | show R01 | next | validate');
  }
  const registry = JSON.parse(readFileSync(registryUrl, 'utf8'));
  if (command === 'next') {
    const query = `repo:${registry.repository} is:issue is:open in:title "[FUS/" "[READY]"`;
    console.log(`Очередь READY (проверить live):\n${query}\nhttps://github.com/issues?q=${encodeURIComponent(query)}`);
    console.log(`Проверить точный [FUS/ID][READY], metadata, live зависимости/gate, контракт и назначение по ${registry.workflow}.`);
    console.log('Локальный реестр не доказывает READY. Это навигатор, не scheduler/lock; PROPOSED по порядку не выбирается.');
    return;
  }
  const errors = validateRegistry(registry);
  if (errors.length) throw new Error(errors.join('\n'));
  if (command === 'validate') { console.log(`Fusion registry PASS: ${registry.tasks.length} tasks, ${registry.planned_slices.length} slices`); return; }
  const selected = command === 'show' ? registry.tasks.filter(task => task.id === id) : registry.tasks;
  if (!selected.length) throw new Error(`Unknown task: ${id}`);
  for (const task of selected) {
    console.log(`${task.id} — ${task.title}\nhttps://github.com/${registry.repository}/issues/${task.issue}`);
    console.log(`depends: ${task.depends_on.join(', ') || '—'} | slice: ${task.planned_slice_id}\nacceptance: ${task.acceptance}\n`);
  }
  console.log('Статус и назначение проверяются в GitHub Issue; определения не означают READY.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
