import assert from 'node:assert/strict';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import {
  createCadUiActions,
  executeCadUiAction,
  indexCadUiActions,
  type CadUiCommandDefinition,
} from '../../src/web/CadUiAction';
import {
  cadUiActionIdForShortcut,
  createM2CadUiActionBindings,
  type M2CadUiActionHandlers,
} from '../../src/web/M2CadUiActions';

const calls: string[] = [];
const call = (id: string) => () => { calls.push(id); };
const handlers: M2CadUiActionHandlers = {
  open: call('open'),
  save: call('save'),
  undo: call('undo'),
  redo: call('redo'),
  rebuild: call('rebuild'),
  createSketch: call('createSketch'),
  rectangle: call('rectangle'),
  circle: call('circle'),
  finishSketch: call('finishSketch'),
  extrude: call('extrude'),
  cutExtrude: call('cutExtrude'),
  fillet: call('fillet'),
  fit: call('fit'),
  front: call('front'),
  back: call('back'),
  top: call('top'),
  bottom: call('bottom'),
  left: call('left'),
  right: call('right'),
  isometric: call('isometric'),
};

const definitions = commandRegistryJson.commands as CadUiCommandDefinition[];
const bindings = createM2CadUiActionBindings(handlers, {
  canUndo: false,
  canRedo: true,
  hasSketch: true,
  canExtrude: false,
  canCutExtrude: true,
  canFillet: false,
});
const actions = indexCadUiActions(createCadUiActions(definitions, bindings));

assert.equal(actions.get('system.undo')?.enabled, false);
assert.equal(actions.get('system.undo')?.disabledReason, 'Нечего отменять');
assert.equal(actions.get('system.redo')?.enabled, true);
assert.equal(actions.get('sketch.rectangle')?.enabled, true);
assert.equal(actions.get('part.extrude')?.enabled, false);
assert.equal(actions.get('part.cutExtrude')?.enabled, true);
assert.equal(actions.get('part.fillet')?.enabled, false);

assert.equal(await executeCadUiAction(actions.get('system.redo')!), true);
assert.equal(await executeCadUiAction(actions.get('part.cutExtrude')!), true);
assert.equal(await executeCadUiAction(actions.get('part.extrude')!), false);
assert.deepEqual(calls, ['redo', 'cutExtrude']);

assert.equal(cadUiActionIdForShortcut('system.save'), 'system.save');
assert.equal(cadUiActionIdForShortcut('system.rebuild'), 'system.rebuild');
assert.equal(cadUiActionIdForShortcut('view.fit'), 'view.fit');
assert.equal(cadUiActionIdForShortcut('interaction.cancel'), null);
assert.equal(cadUiActionIdForShortcut('interaction.commit'), null);
assert.equal(cadUiActionIdForShortcut('view.zoomIn'), null);

console.log('M2O O4 M2 action bindings PASS (shared enablement/execution + shortcut command mapping)');
