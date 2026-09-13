import assert from 'node:assert/strict';
import fs from 'node:fs';

const commands = fs.readFileSync('src/contracts/commands.ts', 'utf8');
const handlers = fs.readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const session = fs.readFileSync('src/web/SketchSession.ts', 'utf8');
const overlay = fs.readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const selectionLayer = fs.readFileSync('src/web/viewport/SketchSelectionLayer.tsx', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const actions = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const shortcuts = fs.readFileSync('src/web/ShortcutRegistry.ts', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(commands, /'sketch\.entity\.delete'/, 'typed command union must contain sketch.entity.delete');
assert.match(commands, /'sketch\.entity\.delete':\s*\{\s*sketchId:\s*CadSketchId;\s*entityId:\s*CadSketchEntityId;/s,
  'delete payload must be explicit sketchId + entityId');
assert.match(handlers, /deleteSketchEntityWithDependencies/, 'application handler must own atomic dependency deletion');
assert.match(handlers, /part\.constraints\s*=\s*part\.constraints\.filter/, 'delete must remove dependent constraints from Part');
assert.match(handlers, /part\.dimensions\s*=\s*part\.dimensions\.filter/, 'delete must remove dependent dimensions from Part');
assert.match(handlers, /sketch\.constraintIds\s*=\s*sketch\.constraintIds\.filter/, 'delete must clear Sketch constraint IDs');
assert.match(handlers, /sketch\.dimensionIds\s*=\s*sketch\.dimensionIds\.filter/, 'delete must clear Sketch dimension IDs');

assert.match(session, /selectedEntityId:\s*CadSketchEntityId\s*\|\s*null/, 'Sketch selection must be transient session state');
assert.equal(
  /import\s+type\s+\{[^}]*\bCadDocument\b[^}]*\}\s+from/s.test(session),
  false,
  'SketchSession must not import persisted CadDocument',
);
assert.equal(/\bdocument\s*:/.test(session), false, 'SketchSession state must not contain persisted document data');
assert.match(session, /reconcileSketchSession/, 'selection must reconcile after undo/open/delete');

assert.doesNotMatch(overlay, /onEntitySelect|data-sketch-select-id/, 'accepted Sketch overlay must remain read-only');
assert.match(selectionLayer, /data-sketch-select-id/, 'selection hit targets must expose stable ASA entity IDs');
assert.match(selectionLayer, /onEntitySelect\(entity\.id\)/, 'selection must report entity.id, never an SVG index');
assert.equal(/\bindex\b/.test(selectionLayer), false, 'Sketch selection must not use child/index identity');
assert.match(selectionLayer, /selectedEntityId === entity\.id/, 'selected Sketch entity must have explicit presentation state');
assert.match(stage, /sketchOverlay=\{sketchOverlay\}/, 'PartModelStage must preserve the accepted CadViewport overlay boundary');
assert.match(stage, /<SketchSelectionLayer/, 'Sketch selection interaction must remain separate from B-Rep Three interaction');
assert.match(stage, /sketchSelectionEnabled\s*=\s*sketchEditing\s*&&\s*props\.activeCommand\s*===\s*null/,
  'selection must be disabled while a direct Sketch command owns pointer input');

assert.match(actions, /'sketch\.entity\.delete':\s*binding/, 'mobile/search must use shared CadUiAction delete intent');
assert.match(actions, /hasSketchEntitySelection/, 'delete UI action must depend on transient selection');
assert.match(shortcuts, /key\s*===\s*'Delete'\s*\|\|\s*key\s*===\s*'Backspace'/,
  'Delete and Backspace must resolve through central shortcut policy');
assert.match(mobile, /id:\s*'sketch\.entity\.delete'/, 'mobile Tools must expose the same shared delete action');

const definition = registry.commands.find((command) => command.id === 'sketch.entity.delete');
assert.ok(definition, 'command registry must contain sketch.entity.delete');
assert.equal(definition.status, 'implemented');
assert.equal(definition.backendCommand, 'sketch.entity.delete');
assert.equal(definition.milestone, 'M3.6A');

console.log('ASA-CAD M3.6A selection/delete boundary PASS (stable IDs + transient selection + atomic dependencies + shared action + O8 overlay boundary)');
