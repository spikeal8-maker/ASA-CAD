import assert from 'node:assert/strict';
import {
  cadUiCommandLabel,
  createCadUiAction,
  createCadUiActionMap,
  searchableCadUiCommands,
} from '../../src/web/presentation/CadUiActions';

let invoked = 0;
const action = createCadUiAction('part.extrude', {
  enabled: false,
  reason: 'profile required',
  invoke: () => { invoked += 1; },
});
assert.equal(action.id, 'part.extrude');
assert.equal(action.label, 'Элемент выдавливания');
assert.equal(action.status, 'implemented');
assert.equal(action.enabled, false);
assert.equal(action.reason, 'profile required');
await action.invoke();
assert.equal(invoked, 1);

const map = createCadUiActionMap({
  'part.sketch.create': { invoke: () => {} },
  'part.extrude': { enabled: true, invoke: () => {} },
});
assert.equal(map.get('part.sketch.create')?.label, 'Создать эскиз');
assert.equal(map.get('part.extrude')?.enabled, true);

assert.equal(cadUiCommandLabel('view.fit'), 'Показать всё');
assert.ok(searchableCadUiCommands('выдав', 'part').some((entry) => entry.id === 'part.extrude'));
assert.equal(searchableCadUiCommands('вращ', 'part').some((entry) => entry.id === 'part.revolve'), false, 'planned commands must stay out of product search');
assert.equal(searchableCadUiCommands('эскиз', 'assembly').some((entry) => entry.id === 'part.sketch.create'), false, 'search must honor document kind');

console.log('ASA-CAD shared CadUiAction model PASS');
