import assert from 'node:assert/strict';
import fs from 'node:fs';

const layer = fs.readFileSync('src/web/viewport/SketchArcInteractionLayer.tsx', 'utf8');
const geometry = fs.readFileSync('src/web/viewport/SketchArcGeometry.ts', 'utf8');
const tool = fs.readFileSync('src/web/useSketchArcTool.ts', 'utf8');
const numeric = fs.readFileSync('src/web/SketchArcNumericInput.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const editing = fs.readFileSync('src/web/useSketchEditingController.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const sketchStage = fs.readFileSync('src/web/SketchEditingStage.tsx', 'utf8');
const directTools = fs.readFileSync('src/web/SketchDirectToolLayers.tsx', 'utf8');
const overlay = fs.readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const fixture = fs.readFileSync('src/web/devFixtures.ts', 'utf8');
const routes = fs.readFileSync('src/browser/routes.ts', 'utf8');
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
assert.match(layer, /data-arc-phase/, 'Arc layer must expose deterministic interaction phase');
assert.match(layer, /sketch-arc-radius-ghost/, 'Arc must expose transient center/start radius ghost');
assert.match(layer, /sketch-arc-ghost/, 'Arc must expose transient sweep ghost');

assert.match(tool, /id:\s*'sketch\.arc'/, 'direct Arc must commit through typed sketch.arc');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Arc tool must not mutate persisted Sketch DTOs directly');
assert.match(tool, /center.*start.*end/s, 'Arc tool must preserve center -> start -> end construction order');
assert.equal((tool.match(/id:\s*'sketch\.arc'/g) ?? []).length, 1, 'One existing command owns each Arc history frame');
assert.equal(/\.(undo|redo|replaceDocument)\(/.test(tool), false, 'Transient Arc input must not manufacture application history');
assert.match(numeric, /Number\.isFinite\(radius\)\s*&&\s*radius > MIN_ARC_RADIUS/, 'Reject nonfinite/zero radius');
assert.match(numeric, /Number\.isFinite\(pointerRadius\)\s*&&\s*pointerRadius > MIN_ARC_RADIUS/, 'Reject an endpoint at its center');
assert.match(numeric, /validDirection\s*&&\s*!error/, 'Invalid directions/typed fields must not generate a projected endpoint');
assert.match(numeric, /Math\.abs\(sweep\) >= MIN_ARC_UI_SWEEP/, 'Near-zero UI sweep must not become canonical intent');
assert.match(numeric, /\[\.\.\.first,\s*\.\.\.end\]\.every\(Number\.isFinite\)/, 'Both submitted endpoints must be finite');
assert.match(numeric, /Math\.max\(-MAX_ARC_UI_SWEEP,\s*Math\.min\(MAX_ARC_UI_SWEEP,\s*state\.sweep \+ delta\)\)/, 'Accumulated signed sweep must use the bounded UI clamp');
assert.match(numeric, /radialPoint\(state\.center,\s*radius,\s*firstAngle \+ sweep\)/, 'Clamp must also project the effective endpoint');
assert.match(numeric, /start: sweep < 0 \? end : first, end: sweep < 0 \? first : end/, 'CW canonicalization must swap already projected endpoints');
assert.match(tool, /if \(!view\.canonical \|\| !owner\.sketchId\)/, 'Invalid projection must stop before executing');
assert.match(tool, /payload:\s*\{\s*sketchId: owner\.sketchId,\s*\.\.\.view\.canonical\s*\}/, 'The typed command must consume the validated canonical pair');
assert.match(layer, /sketchArcGeometryFromConstruction\(canonical\.center,\s*canonical\.start,\s*canonical\.end\)/, 'Ghost and payload must share the canonical pair');
assert.match(geometry, /\$\{largeArcFlag\} 0 \$\{endX\}/, 'positive CAD CCW Arc must use SVG sweep-flag=0 after Y inversion');

assert.match(workspace, /useSketchEditingController/, 'Part/Sketch facade must compose the focused Sketch editing owner');
assert.match(editing, /useSketchArcTool/, 'Sketch editing owner must own Arc tool lifecycle');
assert.match(editing, /arcTool\.reset\(\)/, 'Arc activation/cancel must reset transient tool state');
assert.match(editing, /setActiveCommand\('sketch\.arc'\)/, 'Arc activation must use canonical command id');
assert.match(stage, /SketchEditingStage/, 'Part stage must delegate direct Sketch presentation');
assert.match(sketchStage, /<SketchDirectToolLayers/, 'Sketch editing stage must delegate direct-tool composition');
assert.match(directTools, /SketchArcInteractionLayer/, 'direct-tool owner must compose Arc outside B-Rep Three interaction');
assert.match(overlay, /case 'arc'/, 'persisted/solver Arc must render in Sketch overlay');
assert.match(fixture, /Fixture arc:/, 'Arc must have deterministic review fixture');
assert.match(routes, /'arc'/, 'Arc fixture must be a supported dev route');

const arc = registry.commands.find((command) => command.id === 'sketch.arc');
assert.ok(arc, 'command registry must contain sketch.arc');
assert.equal(arc.status, 'implemented');
assert.equal(arc.milestone, 'M3.4B/U2');
assert.equal(arc.backendCommand, 'sketch.arc');

console.log('ASA-CAD Arc boundary PASS (shared input + canonical projection + invalid guards + one typed command/history)');
