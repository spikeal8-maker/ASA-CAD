import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const interaction = readFileSync('src/web/viewport/SketchLineInteractionLayer.tsx', 'utf8');
const overlay = readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const workplane = readFileSync('src/web/viewport/SketchWorkplane.ts', 'utf8');
const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = readFileSync('src/web/PartModelStage.tsx', 'utf8');
const actions = readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const mobile = readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const app = readFileSync('src/web/App.tsx', 'utf8');
const handlers = readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const registry = JSON.parse(readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
const layout = JSON.parse(readFileSync('spec/ui/layout-registry.v2.json', 'utf8'));

assert.match(interaction, /onCommit\(from: CadPoint2, to: CadPoint2\)/, 'Line interaction must commit through a callback boundary');
assert.doesNotMatch(interaction, /CadApplication|CadDocument|app\.execute|localStorage|indexedDB/, 'pointer/ghost layer must not own application or persistence mutation');
assert.match(interaction, /data-testid="sketch-line-ghost"/, 'Line tool must expose transient ghost geometry');
assert.match(interaction, /onPointerDown/, 'Line tool must share Pointer Events across mouse/touch');
assert.match(interaction, /clientPointToSketch/, 'Line tool must use the stable Sketch workplane transform');

assert.match(workplane, /DEFAULT_SKETCH_WORKPLANE/, 'direct authoring requires a stable workplane instead of entity auto-fit');
assert.match(overlay, /viewBox=\{sketchWorkplaneViewBox\(\)\}/, 'persisted/solver overlay and direct tool must share one workplane transform');
assert.doesNotMatch(overlay, /sketchDisplayBounds/, 'entity-driven viewBox must not return to direct Sketch authoring');

assert.match(workspace, /function beginLine\(\)/, 'workspace must own Line command lifecycle');
assert.match(workspace, /async function commitLine\(from: CadPoint2, to: CadPoint2\)/, 'workspace must route the second point through a typed commit');
assert.match(workspace, /id: 'sketch\.line'/, 'Line commit must use the existing typed CadApplication command');
assert.match(workspace, /setSelectionMode\('sketch'\)/, 'Line command must enter Sketch input mode');
assert.match(stage, /SketchLineInteractionLayer/, 'Part stage must own transient direct Line presentation');
assert.match(app, /line: beginLine/, 'shared CadUiAction catalog must trigger the same Line lifecycle');
assert.match(app, /lineToolActive=\{activeCommand === 'sketch\.line'\}/, 'App may wire but must not own pointer state');
assert.match(actions, /'sketch\.line': binding\(handlers\.line/, 'desktop/mobile/search must consume one shared Line action');
assert.match(mobile, /id: 'sketch\.line'/, 'mobile Sketch tools must expose the same Line action');
assert.match(handlers, /Line length must be non-zero/, 'application boundary must reject degenerate Line geometry');

const line = registry.commands.find((command) => command.id === 'sketch.line');
assert.ok(line, 'sketch.line missing from command registry');
assert.equal(line.status, 'implemented', 'sketch.line must be promoted only with the full M3.2 vertical slice');
assert.equal(line.backendCommand, 'sketch.line');
const sketchGeometry = layout.workspaces.sketch.groups.find((group) => group.id === 'geometry');
assert.ok(sketchGeometry?.commands.includes('sketch.line'), 'Sketch layout must expose canonical sketch.line');

console.log('M3.2 Line boundary PASS (stable workplane + transient pointer state + shared action + typed commit)');
