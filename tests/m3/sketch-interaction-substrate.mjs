import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const viewportDir = 'src/web/viewport';
const sharedPath = path.join(viewportDir, 'SketchInteractionSurface.tsx');
const shared = fs.readFileSync(sharedPath, 'utf8');

for (const token of ['onPointerDown=', 'onPointerMove=', 'onPointerUp=', 'panSketchViewport', 'zoomSketchViewport', 'touchesRef']) {
  assert.match(shared, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `shared Sketch surface must own ${token}`);
}

const toolLayers = fs.readdirSync(viewportDir)
  .filter((name) => /^Sketch.+InteractionLayer\.tsx$/.test(name));
assert.ok(toolLayers.length > 0, 'at least one tool-specific Sketch interaction layer must exist');

for (const name of toolLayers) {
  const source = fs.readFileSync(path.join(viewportDir, name), 'utf8');
  assert.match(source, /SketchInteractionSurface/, `${name} must compose SketchInteractionSurface`);
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
    assert.equal(source.includes(forbidden), false, `${name} must not duplicate shared gesture/input policy: ${forbidden}`);
  }
}

console.log(`ASA-CAD M3 Sketch interaction substrate PASS (${toolLayers.join(', ')})`);
