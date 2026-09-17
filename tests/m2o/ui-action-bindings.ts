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
  line: call('line'),
  rectangle: call('rectangle'),
  circle: call('circle'),
  arc: call('arc'),
  deleteSketchEntity: call('deleteSketchEntity'),
  horizontalConstraint: call('horizontalConstraint'),
  verticalConstraint: call('verticalConstraint'),
  fixedConstraint: call('fixedConstraint'),
  coincidentConstraint: call('coincidentConstraint'),
  parallelConstraint: call('parallelConstraint'),
  perpendicularConstraint: call('perpendicularConstraint'),
  tangentConstraint: call('tangentConstraint'),
  concentricConstraint: call('concentricConstraint'),
  equalConstraint: call('equalConstraint'),
  symmetricConstraint: call('symmetricConstraint'),
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
  hasSketchEntitySelection: true,
  canApplyOrientationConstraint: true,
  canApplyFixedConstraint: true,
  canApplyCoincidentConstraint: true,
  canApplyParallelConstraint: true,
  canApplyPerpendicularConstraint: true,
  canApplyTangentConstraint: true,
  canApplyConcentricConstraint: true,
  canApplyEqualConstraint: true,
  canApplySymmetryConstraint: true,
  canExtrude: false,
  canCutExtrude: true,
  canFillet: false,
});
const actions = indexCadUiActions(createCadUiActions(definitions, bindings));

assert.equal(actions.get('system.undo')?.enabled, false);
assert.equal(actions.get('system.undo')?.disabledReason, 'Нечего отменять');
assert.equal(actions.get('system.redo')?.enabled, true);
assert.equal(actions.get('sketch.rectangle')?.enabled, true);
assert.equal(actions.get('constraint.horizontal')?.enabled, true);
assert.equal(actions.get('constraint.vertical')?.enabled, true);
assert.equal(actions.get('constraint.fixed')?.enabled, true);
assert.equal(actions.get('constraint.coincident')?.enabled, true);
assert.equal(actions.get('constraint.parallel')?.enabled, true);
assert.equal(actions.get('constraint.perpendicular')?.enabled, true);
assert.equal(actions.get('constraint.tangent')?.enabled, true);
assert.equal(actions.get('constraint.concentric')?.enabled, true);
assert.equal(actions.get('constraint.equal')?.enabled, true);
assert.equal(actions.get('constraint.symmetric')?.enabled, true);
assert.equal(actions.get('part.extrude')?.enabled, false);
assert.equal(actions.get('part.cutExtrude')?.enabled, true);
assert.equal(actions.get('part.fillet')?.enabled, false);

assert.equal(await executeCadUiAction(actions.get('system.redo')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.horizontal')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.vertical')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.fixed')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.coincident')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.parallel')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.perpendicular')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.tangent')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.concentric')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.equal')!), true);
assert.equal(await executeCadUiAction(actions.get('constraint.symmetric')!), true);
assert.equal(await executeCadUiAction(actions.get('part.cutExtrude')!), true);
assert.equal(await executeCadUiAction(actions.get('part.extrude')!), false);
assert.deepEqual(calls, ['redo', 'horizontalConstraint', 'verticalConstraint', 'fixedConstraint', 'coincidentConstraint', 'parallelConstraint', 'perpendicularConstraint', 'tangentConstraint', 'concentricConstraint', 'equalConstraint', 'symmetricConstraint', 'cutExtrude']);

const disabledConstraints = indexCadUiActions(createCadUiActions(definitions, createM2CadUiActionBindings(handlers, {
  canUndo: false,
  canRedo: false,
  hasSketch: true,
  hasSketchEntitySelection: false,
  canApplyOrientationConstraint: false,
  canApplyFixedConstraint: false,
  canApplyCoincidentConstraint: false,
  canApplyParallelConstraint: false,
  canApplyPerpendicularConstraint: false,
  canApplyTangentConstraint: false,
  canApplyConcentricConstraint: false,
  canApplyEqualConstraint: false,
  canApplySymmetryConstraint: false,
  canExtrude: false,
  canCutExtrude: false,
  canFillet: false,
})));
assert.equal(disabledConstraints.get('constraint.horizontal')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.horizontal')?.disabledReason, 'Выберите отрезок эскиза');
assert.equal(disabledConstraints.get('constraint.vertical')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.fixed')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.fixed')?.disabledReason, 'Выберите незакреплённый отрезок эскиза');
assert.equal(disabledConstraints.get('constraint.coincident')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.coincident')?.disabledReason, 'Создайте два отрезка эскиза');
assert.equal(disabledConstraints.get('constraint.parallel')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.parallel')?.disabledReason, 'Создайте два отрезка эскиза');
assert.equal(disabledConstraints.get('constraint.perpendicular')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.perpendicular')?.disabledReason, 'Создайте два отрезка эскиза');
assert.equal(disabledConstraints.get('constraint.tangent')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.tangent')?.disabledReason, 'Создайте отрезок и окружность эскиза');
assert.equal(disabledConstraints.get('constraint.concentric')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.equal')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.equal')?.disabledReason, disabledConstraints.get('constraint.parallel')?.disabledReason);
assert.equal(disabledConstraints.get('constraint.symmetric')?.enabled, false);
assert.equal(disabledConstraints.get('constraint.symmetric')?.disabledReason, 'Создайте три отрезка эскиза');

assert.equal(cadUiActionIdForShortcut('system.save'), 'system.save');
assert.equal(cadUiActionIdForShortcut('system.rebuild'), 'system.rebuild');
assert.equal(cadUiActionIdForShortcut('view.fit'), 'view.fit');
assert.equal(cadUiActionIdForShortcut('interaction.cancel'), null);
assert.equal(cadUiActionIdForShortcut('interaction.commit'), null);
assert.equal(cadUiActionIdForShortcut('view.zoomIn'), null);

console.log('M2O O4 M2 action bindings PASS (shared enablement/execution + H/V/Fixed/Coincident/Parallel/Perpendicular/Tangent/Concentric actions + shortcut command mapping)');
