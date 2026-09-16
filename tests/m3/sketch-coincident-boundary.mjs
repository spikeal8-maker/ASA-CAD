import assert from 'node:assert/strict';
import fs from 'node:fs';

const handler = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const coincidentOwner = fs.readFileSync('src/application/commands/SketchCoincidentConstraintOwner.ts', 'utf8');
const controllers = fs.readFileSync('src/web/useSketchConstraintControllers.ts', 'utf8');
const unary = fs.readFileSync('src/web/useSketchConstraintController.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchCoincidentInteractionLayer.tsx', 'utf8');
const bridge = fs.readFileSync('src/web/CoincidentPartModelStage.tsx', 'utf8');
const layers = fs.readFileSync('src/web/SketchDirectToolLayers.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const actions = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const commandGroups = fs.readFileSync('src/web/CadShellCommandGroups.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(coincidentOwner, /requireLineEndpointReference/, 'application owner must validate Coincident point refs');
assert.match(coincidentOwner, /entity\.type !== 'line'/, 'M3.7C application owner must remain Line-only');
assert.match(coincidentOwner, /ref\.point !== 'a' && ref\.point !== 'b'/, 'only Line endpoints a\/b may enter M3.7C');
assert.match(coincidentOwner, /two distinct Lines/, 'same-Line endpoint pairing must be rejected');
assert.match(coincidentOwner, /sameUnorderedEndpointPair/, 'symmetric Coincident duplicates must be rejected deterministically');
assert.match(handler, /addCoincidentConstraint/, 'central handler must delegate Coincident to its focused owner');
assert.doesNotMatch(`${handler}\n${coincidentOwner}`, /PlaneGCS|OpenCascade|vendor\//, 'application constraint owners must remain runtime-neutral');

assert.match(controllers, /useSketchConstraintController\(options\)/, 'constraint composition must reuse the accepted unary H\/V\/Fixed owner');
assert.match(controllers, /canApplyCoincidentConstraint/, 'constraint composition must own Coincident enablement');
assert.match(controllers, /setActiveCommand\('constraint\.coincident'\)/, 'Coincident must enter an explicit transient interaction mode');
assert.match(controllers, /setPanel\('closed'\)/, 'Coincident endpoint picking must uncover the work area on mobile');
assert.match(controllers, /id: 'constraint\.coincident'/, 'second endpoint must commit through typed CadApplication command');
assert.match(controllers, /setActiveCommand\(null\)/, 'successful Coincident commit must close the transient mode');
assert.match(controllers, /setPanel\('tree'\)/, 'successful Coincident commit must restore the normal panel');
assert.doesNotMatch(unary, /constraint\.coincident/, 'accepted unary H\/V\/Fixed owner must not absorb Coincident');

assert.match(layer, /useState<LineEndpoint \| null>/, 'first endpoint selection must remain local transient state');
assert.match(layer, /SketchInteractionSurface/, 'Coincident must reuse shared Sketch pan\/zoom\/touch infrastructure');
assert.match(layer, /entity\.type !== 'line'/, 'endpoint markers must remain Line-only');
assert.match(layer, /entityId: entity\.id, point: 'a'/, 'Line start endpoint must be represented by stable ref a');
assert.match(layer, /entityId: entity\.id, point: 'b'/, 'Line end endpoint must be represented by stable ref b');
assert.doesNotMatch(layer, /CadApplication|app\.execute|PlaneGCS|OpenCascade/, 'interaction layer must not own document mutation or kernel runtime');

assert.match(bridge, /createContext<SketchCoincidentCommit \| null>/, 'Coincident commit seam must use focused React context');
assert.match(bridge, /CommitContext\.Provider/, 'stage bridge must provide only the Coincident commit callback');
assert.match(bridge, /useSketchCoincidentCommit/, 'interaction layer must consume the focused commit context');
assert.match(layers, /activeCommand === 'constraint\.coincident'/, 'Coincident layer must activate from the shared command state');
assert.match(app, /CoincidentPartStage/, 'App must provide the Coincident commit seam without growing frozen model stages');
assert.match(app, /commit=\{workspace\.applyCoincidentConstraint\}/, 'App bridge must commit through focused workspace constraint ownership');
assert.match(workspace, /useSketchConstraintControllers/, 'workspace must compose constraints through one focused facade');
assert.match(workspace, /\.\.\.constraints/, 'workspace facade must expose constraints without per-command growth');
assert.match(workspace, /activeCommand === 'constraint\.coincident'/, 'cancel must keep Coincident inside Sketch workspace');

assert.match(actions, /coincidentConstraint/, 'shared CadUiAction binding must expose Coincident');
assert.match(actions, /'constraint\.coincident'/, 'Coincident must use the shared action id');
assert.match(mobile, /id: 'constraint\.coincident'/, 'mobile Sketch tools must use the same Coincident action');
assert.match(commandGroups, /getAction\('constraint\.coincident'\)/, 'desktop ribbon command-group owner must use the same Coincident action');

const command = registry.commands.find((item) => item.id === 'constraint.coincident');
assert.ok(command, 'constraint.coincident must exist in command registry');
assert.equal(command.milestone, 'M3.7C');
assert.equal(command.status, 'implemented');
assert.equal(command.backendCommand, 'constraint.coincident');

console.log('ASA-CAD M3.7C Coincident boundary PASS (stable Line endpoints + focused lifecycle + delegated desktop/mobile action surfaces)');
