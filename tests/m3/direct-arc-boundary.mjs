import assert from 'node:assert/strict';
import fs from 'node:fs';

const layer = fs.readFileSync('src/web/viewport/SketchArcInteractionLayer.tsx', 'utf8');
const surface = fs.readFileSync('src/web/viewport/SketchInteractionSurface.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchArcTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const overlay = fs.readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(layer, /SketchInteractionSurface/, 'Arc must compose shared SketchInteractionSurface');
assert.match(layer, /data-arc-phase/, 'Arc layer must expose deterministic center/start/end phase');
assert.match(layer, /sketch-arc-ghost/, 'Arc layer must expose transient sweep ghost');
for (const forbidden of ['onPointerDown=', 'onPointerUp=', 'onPointerCancel=', 'onWheel=', 'touchesRef', 'panSketchViewport', 'zoomSketchViewport']) {
  assert.equal(layer.includes(forbidden), false, `Arc layer must not duplicate shared input policy: ${forbidden}`);
}
assert.match(surface, /tool: string/, 'shared Sketch surface remains generic across direct tools');

assert.match(tool, /id:\s*'sketch\.arc'/, 'direct Arc must commit through one typed sketch.arc command');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Arc tool must not mutate persisted Sketch DTOs directly');
assert.match(tool, /center/, 'Arc tool owns center draft');
assert.match(tool, /start/, 'Arc tool owns start draft');
assert.match(tool, /preview/, 'Arc tool owns transient end/sweep preview');

assert.match(workspace, /useSketchArcTool/, 'Part/Sketch workspace must own Arc tool lifecycle');
assert.match(workspace, /activeCommand === 'sketch\.arc'/, 'Arc activation/cancel/commit must flow through workspace lifecycle');
assert.match(stage, /SketchArcInteractionLayer/, 'Part stage must compose direct Arc outside B-Rep Three interaction');
assert.match(overlay, /case 'arc'/, 'persisted/solver Arc must render in SketchOverlayLayer');

const arc = registry.commands.find((command) => command.id === 'sketch.arc');
assert.ok(arc, 'command registry must contain sketch.arc');
assert.equal(arc.status, 'implemented', 'Arc becomes implemented only with direct UI/browser acceptance');
assert.equal(arc.backendCommand, 'sketch.arc');

console.log('ASA-CAD M3.4B direct Arc boundary PASS (shared input + transient ghost + one typed history mutation)');
