import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveCadBackendCommandId } from '../../src';

interface UiCommandEntry {
  id: string;
  labelRu: string;
  backendCommand?: string;
  milestone: string;
}

const registry = JSON.parse(
  await readFile(new URL('../../spec/ui/command-registry.v1.json', import.meta.url), 'utf8'),
) as { commands: UiCommandEntry[] };

const requiredFirstSlice = new Map<string, string>([
  ['system.rebuild', 'Перестроить'],
  ['part.sketch.create', 'Создать эскиз'],
  ['sketch.line', 'Отрезок'],
  ['sketch.rectangle', 'Прямоугольник'],
  ['sketch.circle', 'Окружность'],
  ['dimension.linear', 'Линейный размер'],
  ['sketch.finish', 'Завершить эскиз'],
  ['part.extrude', 'Элемент выдавливания'],
  ['part.cutExtrude', 'Вырезать выдавливанием'],
  ['part.fillet', 'Скругление'],
]);

for (const [uiId, expectedLabel] of requiredFirstSlice) {
  const entry = registry.commands.find((command) => command.id === uiId);
  assert.ok(entry, `UI registry is missing required first-slice command ${uiId}`);
  assert.equal(entry.labelRu, expectedLabel, `${uiId} label drifted from the approved Russian UI contract`);
  const backend = resolveCadBackendCommandId(entry.backendCommand ?? entry.id);
  assert.ok(backend, `${uiId} does not resolve to an implemented CadApplication command`);
}

const uiIds = registry.commands.map((command) => command.id);
assert.equal(new Set(uiIds).size, uiIds.length, 'UI command registry contains duplicate IDs');

console.log('ASA-CAD M1 command-registry -> CadApplication validation PASS');
