import assert from 'node:assert/strict';
import fs from 'node:fs';

const layer = fs.readFileSync('src/web/viewport/SketchRectangleInteractionLayer.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchRectangleTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const protectedPart = fs.readFileSync('tests/m2/part-browser.mjs', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(layer, /SketchInteractionSurface/, 'Rectangle must compose the shared Sketch interaction surface');
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
  assert.equal(layer.includes(forbidden), false, `Rectangle layer must not duplicate shared input policy: ${forbidden}`);
}
assert.match(layer, /data-rectangle-phase/, 'Rectangle layer must expose deterministic interaction phase');
assert.match(layer, /sketch-rectangle-ghost/, 'Rectangle layer must expose a transient four-edge ghost');

assert.match(tool, /id:\s*'sketch\.rectangle'/, 'direct Rectangle must commit through typed sketch.rectangle');
assert.equal(/id:\s*'dimension\.linear'/.test(tool), false, 'direct Rectangle must remain one geometry mutation; driving dimensions are a separate path');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Rectangle tool must not mutate persisted Sketch DTOs directly');
assert.match(tool, /Math\.min\(from\[0\], to\[0\]\)/, 'Rectangle must normalize X direction');
assert.match(tool, /Math\.min\(from\[1\], to\[1\]\)/, 'Rectangle must normalize Y direction');
assert.match(tool, /Math\.abs\(to\[0\] - from\[0\]\)/, 'Rectangle width must be positive');
assert.match(tool, /Math\.abs\(to\[1\] - from\[1\]\)/, 'Rectangle height must be positive');

assert.match(workspace, /rectangleTool\.reset\(\)/, 'Rectangle activation/cancel must reset transient tool state');
assert.match(workspace, /rectangleTool\.commitPreview\(\)/, 'Ctrl+Enter must commit an active direct Rectangle draft');
assert.match(workspace, /id:\s*'dimension\.linear'/, 'explicit numeric Rectangle fallback must remain available for protected Part');
assert.match(stage, /SketchRectangleInteractionLayer/, 'Part stage must compose direct Rectangle outside B-Rep Three interaction');
assert.match(protectedPart, /filter\(\{ hasText: 'Ширина' \}\)/, 'protected Part must retain explicit numeric Rectangle + driving dimensions fallback');

const rectangle = registry.commands.find((command) => command.id === 'sketch.rectangle');
assert.ok(rectangle, 'command registry must contain sketch.rectangle');
assert.equal(rectangle.status, 'implemented');

console.log('ASA-CAD M3.5 direct Rectangle boundary PASS (shared input + one geometry commit + numeric dimension fallback)');
