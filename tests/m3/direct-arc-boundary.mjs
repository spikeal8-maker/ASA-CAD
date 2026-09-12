import assert from 'node:assert/strict';
import fs from 'node:fs';

const tool = fs.readFileSync('src/web/useSketchArcTool.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchArcInteractionLayer.tsx', 'utf8');
const overlay = fs.readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const routes = fs.readFileSync('src/browser/routes.ts', 'utf8');
const fixtures = fs.readFileSync('src/web/devFixtures.ts', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(layer, /SketchInteractionSurface/, 'Arc must compose the shared Sketch interaction surface');
for (const forbidden of [
  'touchesRef',
  'GestureState',
  'TOUCH_TAP_THRESHOLD',
  'panSketchViewport',
  'zoomSketchViewport',
  'getBoundingClientRect',
  'onPointerDown=',
  'onPointerUp=',
  'onPointerCancel=',
  'onWheel=',
]) {
  assert.equal(layer.includes(forbidden), false, `Arc layer must not duplicate shared input policy: ${forbidden}`);
}
assert.match(layer, /data-arc-phase/, 'Arc layer must expose deterministic center/start/sweep phases');
assert.match(layer, /sketch-arc-ghost/, 'Arc layer must expose transient sweep ghost');

assert.match(tool, /id: 'sketch\.arc'/, 'direct Arc must commit through typed sketch.arc');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Arc tool must not mutate persisted Sketch DTOs directly');
assert.match(tool, /center.*start.*end/s, 'Arc tool must use the accepted center-start-end construction contract');

assert.match(workspace, /arcTool\.reset\(\)/, 'Arc activation/cancel must reset transient tool state');
assert.match(workspace, /setActiveCommand\('sketch\.arc'\)/, 'workspace must own Arc command lifecycle');
assert.match(stage, /SketchArcInteractionLayer/, 'Part stage must compose direct Arc outside B-Rep Three interaction');
assert.match(overlay, /case 'arc':/, 'persisted/solved Arc must render through the Sketch overlay');
assert.match(routes, /'arc'/, 'deterministic Arc route must be registered');
assert.match(fixtures, /Fixture arc:/, 'deterministic Arc fixture must exist before M3.4B acceptance');

const arc = registry.commands.find((command) => command.id === 'sketch.arc');
assert.ok(arc, 'command registry must contain sketch.arc');
assert.equal(arc.status, 'implemented');
assert.equal(arc.milestone, 'M3.4B');
assert.equal(arc.backendCommand, 'sketch.arc');

console.log('ASA-CAD M3.4B direct Arc boundary PASS (shared input + one typed commit + overlay + deterministic fixture)');
