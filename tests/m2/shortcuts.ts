import assert from 'node:assert/strict';
import { ShortcutRegistry, type ShortcutContext, type ShortcutStroke } from '../../src/web/ShortcutRegistry';

const registry = new ShortcutRegistry();
const base: ShortcutContext = {
  documentKind: 'part',
  activeCommand: null,
  hasSelection: false,
  cadEditorFocused: true,
  inputKind: 'none',
};

function action(stroke: ShortcutStroke, context: Partial<ShortcutContext> = {}) {
  return registry.resolve(stroke, { ...base, ...context })?.action ?? null;
}

assert.equal(action({ key: 's', ctrlKey: true }), 'system.save');
assert.equal(action({ key: 'z', ctrlKey: true }), 'system.undo');
assert.equal(action({ key: 'z', ctrlKey: true, shiftKey: true }), 'system.redo');
assert.equal(action({ key: 'y', ctrlKey: true }), 'system.redo');
assert.equal(action({ key: 'F5' }), 'system.rebuild');
assert.equal(action({ key: 'F5' }, { cadEditorFocused: false }), null);
assert.equal(action({ key: 'F5' }, { documentKind: 'text' }), null);

assert.equal(action({ key: 'f' }), 'view.fit');
assert.equal(action({ key: '0' }), 'view.iso');
assert.equal(action({ key: '1' }), 'view.front');
assert.equal(action({ key: '2' }), 'view.top');
assert.equal(action({ key: '3' }), 'view.left');
assert.equal(action({ key: '+', ctrlKey: true }), 'view.zoomIn');
assert.equal(action({ key: '=', ctrlKey: true }), 'view.zoomIn');
assert.equal(action({ key: '-', ctrlKey: true }), 'view.zoomOut');
assert.equal(action({ key: 'ArrowLeft' }), 'view.panLeft');
assert.equal(action({ key: 'ArrowRight' }), 'view.panRight');
assert.equal(action({ key: 'ArrowUp' }), 'view.panUp');
assert.equal(action({ key: 'ArrowDown' }), 'view.panDown');

assert.equal(action({ key: 'Escape' }, { hasSelection: true }), 'interaction.cancel');
assert.equal(action({ key: 'Escape' }, { activeCommand: 'part.extrude' }), 'interaction.cancel');
assert.equal(action({ key: 'Enter', ctrlKey: true }, { activeCommand: 'part.extrude' }), 'interaction.commit');
assert.equal(action({ key: 'Delete' }, { hasSelection: true }), 'interaction.delete');
assert.equal(action({ key: 'Delete' }), null);

// Browser/OS navigation remains browser-owned.
for (const key of ['r', 'l', 't', 'w']) {
  assert.equal(action({ key, ctrlKey: true }), null, `Ctrl+${key.toUpperCase()} must remain browser-owned`);
}
assert.equal(action({ key: 'ArrowLeft', altKey: true }), null);
assert.equal(action({ key: 'ArrowRight', altKey: true }), null);

// Numeric/text editors keep their native editing semantics. Save and explicit
// command lifecycle keys are the only M2 shortcuts allowed through this focus gate.
for (const inputKind of ['numeric', 'text', 'editable'] as const) {
  assert.equal(action({ key: 's', ctrlKey: true }, { inputKind }), 'system.save');
  assert.equal(action({ key: 'z', ctrlKey: true }, { inputKind }), null);
  assert.equal(action({ key: 'Delete' }, { inputKind, hasSelection: true }), null);
  assert.equal(action({ key: 'ArrowLeft' }, { inputKind }), null);
  assert.equal(action({ key: 'f' }, { inputKind }), null);
  assert.equal(action({ key: 'F5' }, { inputKind }), null);
  assert.equal(action({ key: 'Escape' }, { inputKind, activeCommand: 'part.extrude' }), 'interaction.cancel');
  assert.equal(action({ key: 'Enter', ctrlKey: true }, { inputKind, activeCommand: 'part.extrude' }), 'interaction.commit');
}

console.log('ASA-CAD M2I ShortcutRegistry PASS');
console.log('  ✓ save/undo/redo/rebuild/view/command lifecycle mappings');
console.log('  ✓ browser-critical combinations stay browser-owned');
console.log('  ✓ numeric/text/contenteditable focus keeps native editing semantics');
