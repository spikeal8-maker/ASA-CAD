import assert from 'node:assert/strict';
import fs from 'node:fs';

const layer = fs.readFileSync('src/web/viewport/SketchCircleInteractionLayer.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchCircleTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const protectedPart = fs.readFileSync('tests/m2/part-browser.mjs', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(layer, /SketchInteractionSurface/, 'Circle must compose the shared Sketch interaction surface');
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
  assert.equal(layer.includes(forbidden), false, `Circle layer must not duplicate shared input policy: ${forbidden}`);
}
assert.match(layer, /data-circle-phase/, 'Circle layer must expose deterministic interaction phase');
assert.match(layer, /sketch-circle-ghost/, 'Circle layer must expose a transient radius ghost');

assert.match(tool, /id:\s*'sketch\.circle'/, 'direct Circle must commit through typed sketch.circle');
assert.equal(/id:\s*'dimension\.diameter'/.test(tool), false, 'direct Circle must remain one geometry mutation; driving diameter is a separate path');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Circle tool must not mutate persisted Sketch DTOs directly');

assert.match(workspace, /circleTool\.reset\(\)/, 'Circle activation/cancel must reset transient tool state');
assert.match(workspace, /setPanel\('closed'\)/, 'direct Circle must use the accepted collapsed management layout');
assert.match(workspace, /id:\s*'dimension\.diameter'/, 'numeric/driving diameter fallback must remain available');
assert.match(stage, /SketchCircleInteractionLayer/, 'Part stage must compose direct Circle outside B-Rep Three interaction');
assert.match(protectedPart, /getByTitle\('Параметры'\)/, 'protected Part must retain explicit numeric Circle + driving diameter fallback');

const circle = registry.commands.find((command) => command.id === 'sketch.circle');
assert.ok(circle, 'command registry must contain sketch.circle');
assert.equal(circle.status, 'implemented');
assert.equal(circle.milestone, 'M3.3');

console.log('ASA-CAD M3.3 direct Circle boundary PASS (shared input + one geometry commit + numeric dimension fallback)');
