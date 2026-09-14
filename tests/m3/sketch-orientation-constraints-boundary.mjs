import assert from 'node:assert/strict';
import fs from 'node:fs';

const handlers = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const controller = fs.readFileSync('src/web/useSketchConstraintController.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const actions = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(handlers, /addLineOrientationConstraint/, 'H/V must share a focused orientation semantic owner');
assert.match(handlers, /entity\.type !== 'line'/, 'H/V must reject non-Line geometry at application boundary');
assert.match(handlers, /constraint\.type === type/, 'same-type duplicate H/V must be rejected');
assert.match(handlers, /constraint\.type === opposite/, 'direct H/V opposite conflict must be rejected');
assert.doesNotMatch(handlers, /PlaneGCS|OpenCascade|vendor\//, 'constraint command owner must stay runtime-neutral');

assert.match(controller, /useSketchConstraintController/, 'web constraint behavior must have a focused controller');
assert.match(controller, /selectedEntity\?\.type === 'line'/, 'shared UI enablement must require selected Line');
assert.match(controller, /id: type === 'horizontal' \? 'constraint\.horizontal' : 'constraint\.vertical'/, 'controller must execute typed H/V commands only');
assert.doesNotMatch(controller, /constraint\.coincident/, 'focused unary constraint controller must not absorb Coincident');

assert.match(workspace, /useSketchConstraintController/, 'Part/Sketch facade must compose the focused constraint controller');
assert.match(workspace, /\.\.\.constraints/, 'workspace facade must compose the focused constraint controller without per-command growth');
assert.match(actions, /'constraint\.horizontal': binding/, 'shared CadUiAction map must expose Horizontal');
assert.match(actions, /'constraint\.vertical': binding/, 'shared CadUiAction map must expose Vertical');
assert.match(actions, /canApplyOrientationConstraint/, 'desktop/mobile/search must share one H/V enablement contract');
assert.match(mobile, /id: 'constraint\.horizontal'/, 'mobile Sketch tools must use the shared Horizontal action');
assert.match(mobile, /id: 'constraint\.vertical'/, 'mobile Sketch tools must use the shared Vertical action');
assert.match(app, /horizontalConstraint: applyHorizontalConstraint/, 'App may wire but not own Horizontal semantics');
assert.match(app, /verticalConstraint: applyVerticalConstraint/, 'App may wire but not own Vertical semantics');
assert.doesNotMatch(app, /id:\s*'constraint\.(horizontal|vertical)'/, 'App must not execute constraint commands directly');

for (const id of ['constraint.horizontal', 'constraint.vertical']) {
  const command = registry.commands.find((item) => item.id === id);
  assert.ok(command, `${id} missing from command registry`);
  assert.equal(command.status, 'implemented', `${id} must be promoted only with M3.7A acceptance`);
  assert.equal(command.milestone, 'M3.7A');
  assert.equal(command.backendCommand, id);
}
console.log('ASA-CAD M3.7A orientation boundary PASS (focused owner + Line-only semantics + shared actions + Fixed remains separate)');
