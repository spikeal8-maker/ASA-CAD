import assert from 'node:assert/strict';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import {
  createCadUiActions,
  executeCadUiAction,
  indexCadUiActions,
  searchCadUiActions,
  type CadUiCommandDefinition,
} from '../../src/web/CadUiAction';

const definitions = commandRegistryJson.commands as CadUiCommandDefinition[];
let saveCount = 0;
let rectangleCount = 0;

const actions = createCadUiActions(definitions, {
  'system.save': { execute: () => { saveCount += 1; } },
  'sketch.rectangle': {
    execute: () => { rectangleCount += 1; },
    enabled: false,
    disabledReason: 'Сначала создайте эскиз',
  },
  'part.revolve': { execute: () => { throw new Error('planned command must never execute'); } },
});

const byId = indexCadUiActions(actions);
const save = byId.get('system.save');
assert.ok(save, 'system.save action missing');
assert.equal(save.label, 'Сохранить');
assert.equal(save.status, 'implemented');
assert.equal(save.enabled, true);

// The exact same action object can be handed to desktop and mobile renderers.
const desktopSave = save;
const mobileSave = save;
assert.equal(desktopSave, mobileSave);
assert.equal(await executeCadUiAction(desktopSave), true);
assert.equal(await executeCadUiAction(mobileSave), true);
assert.equal(saveCount, 2);

const rectangle = byId.get('sketch.rectangle');
assert.ok(rectangle, 'sketch.rectangle action missing');
assert.equal(rectangle.enabled, false);
assert.equal(rectangle.disabledReason, 'Сначала создайте эскиз');
assert.equal(await executeCadUiAction(rectangle), false);
assert.equal(rectangleCount, 0);

const revolve = byId.get('part.revolve');
assert.ok(revolve, 'part.revolve action missing');
assert.equal(revolve.status, 'planned');
assert.equal(revolve.enabled, false, 'planned action must stay disabled even if an executor was accidentally supplied');
assert.equal(await executeCadUiAction(revolve), false);

const search = searchCadUiActions(actions, 'сохран');
assert.ok(search.some((action) => action.id === 'system.save'));
assert.equal(searchCadUiActions(actions, '   ').length, 0);

assert.throws(
  () => indexCadUiActions([save, save]),
  /Duplicate CadUiAction id/,
);

console.log('M2O O4 shared CadUiAction model PASS (registry metadata + state binding + shared execution/search)');
