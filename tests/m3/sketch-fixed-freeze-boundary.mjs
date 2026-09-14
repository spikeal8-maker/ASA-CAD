import assert from 'node:assert/strict';
import fs from 'node:fs';

const commands = fs.readFileSync('src/contracts/commands.ts', 'utf8');
const handlers = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const controller = fs.readFileSync('src/web/useSketchConstraintController.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const actions = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const shell = fs.readFileSync('src/web/CadShellTop.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(commands, /'constraint\.fixed':[\s\S]*frozenGeometry:[\s\S]*type: 'line'/, 'Fixed command must carry serializable solved Line geometry');
assert.match(handlers, /addFixedConstraint/, 'Fixed must have a focused atomic application handler');
assert.match(handlers, /validateFrozenLineGeometry/, 'application boundary must validate frozen coordinates');
assert.match(handlers, /Fixed constraint already exists/, 'duplicate Fixed must be rejected deterministically');
assert.match(handlers, /assertFrozenGeometryMatchesOrientation/, 'frozen geometry must remain compatible with persisted H\/V intent');
assert.match(handlers, /sketch\.entities\[entityIndex\] = [\s\S]*persistConstraint/, 'entity freeze and Fixed persistence must occur in one command handler');
assert.doesNotMatch(handlers, /PlaneGCS|OpenCascade|vendor\//, 'application constraint owner must stay runtime-neutral');

assert.match(controller, /BrowserSketchSolverAdapter/, 'web Fixed owner must use the ASA lazy sketch-solver seam');
assert.match(controller, /freezeSolver\.solve\(document, activeSketchId\)/, 'Fixed must re-solve the current persisted Sketch before commit');
assert.match(controller, /!solved\.ok \|\| !solved\.converged/, 'non-converged solve must block Fixed before mutation');
assert.match(controller, /id: 'constraint\.fixed'/, 'focused controller must execute the typed Fixed command');
assert.match(controller, /frozenGeometry:[\s\S]*from: solvedEntity\.data\.from[\s\S]*to: solvedEntity\.data\.to/, 'Fixed payload must come from solved DTO geometry');
assert.doesNotMatch(controller, /OpenCascade|vendor\//, 'Fixed UI owner must not depend on B-Rep/vendor internals');

assert.match(workspace, /\.\.\.constraints/, 'frozen Part\/Sketch facade must compose constraint controller without per-command growth');
assert.match(actions, /'constraint\.fixed': binding/, 'shared CadUiAction model must expose Fixed');
assert.match(actions, /canApplyFixedConstraint/, 'desktop/mobile/search must share one Fixed enablement contract');
assert.match(mobile, /id: 'constraint\.fixed'/, 'mobile Sketch tools must consume shared Fixed action');
assert.match(shell, /getAction\('constraint\.fixed'\)/, 'desktop Sketch ribbon must consume shared Fixed action');
assert.match(app, /fixedConstraint: applyFixedConstraint/, 'App may wire but not own Fixed semantics');
assert.doesNotMatch(app, /id:\s*'constraint\.fixed'/, 'App must not execute Fixed directly');

for (const id of ['constraint.horizontal', 'constraint.vertical']) {
  const command = registry.commands.find((item) => item.id === id);
  assert.equal(command?.status, 'implemented', `${id} must remain implemented`);
}
const fixed = registry.commands.find((item) => item.id === 'constraint.fixed');
assert.ok(fixed, 'constraint.fixed missing from registry');
assert.equal(fixed.status, 'implemented', 'Fixed may be product-visible only with M3.7B acceptance');
assert.equal(fixed.milestone, 'M3.7B');
assert.equal(fixed.backendCommand, 'constraint.fixed');

console.log('ASA-CAD M3.7B Fixed boundary PASS (solve seam -> serializable freeze -> atomic command -> shared actions)');
