import assert from 'node:assert/strict';
import fs from 'node:fs';

const geometry = fs.readFileSync('src/web/viewport/SketchRectangleGeometry.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchRectangleInteractionLayer.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchRectangleTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const routes = fs.readFileSync('src/browser/routes.ts', 'utf8');
const fixtures = fs.readFileSync('src/web/devFixtures.ts', 'utf8');
const protectedPart = fs.readFileSync('tests/m2/part-browser.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/m3-browser.yml', 'utf8');

assert.match(geometry, /canonicalSketchRectangle/, 'Rectangle must share one canonical first/opposite geometry helper');
assert.match(geometry, /Math\.min\(first\[0\], opposite\[0\]\)/, 'Rectangle must normalize drag direction into canonical origin');
assert.match(geometry, /Math\.abs\(opposite\[0\] - first\[0\]\)/, 'Rectangle width must be positive after normalization');
assert.match(geometry, /Math\.abs\(opposite\[1\] - first\[1\]\)/, 'Rectangle height must be positive after normalization');

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
assert.match(layer, /data-rectangle-phase/, 'Rectangle layer must expose deterministic two-point phase');
assert.match(layer, /sketch-rectangle-ghost-edge/, 'Rectangle layer must expose four-edge transient ghost');
assert.equal((layer.match(/<line/g) ?? []).length, 1, 'Rectangle layer source must map one line template over canonical four edges');

assert.match(tool, /canonicalSketchRectangle/, 'direct Rectangle tool must use shared canonical geometry');
assert.match(tool, /id:\s*'sketch\.rectangle'/, 'direct Rectangle must commit through typed sketch.rectangle');
assert.equal(/id:\s*'dimension\.linear'/.test(tool), false, 'direct Rectangle must remain one geometry mutation; driving dimensions are separate');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Rectangle tool must not mutate persisted Sketch DTOs directly');
assert.match(tool, /commitPreview/, 'direct Rectangle must support central commit from its transient preview');

assert.match(workspace, /useSketchRectangleTool/, 'Part workspace must own Rectangle transient state');
assert.match(workspace, /rectangleTool\.reset\(\)/, 'Rectangle activation/cancel must reset transient tool state');
assert.match(workspace, /rectangleTool\.draft\.first/, 'central commit must distinguish direct Rectangle from numeric fallback');
assert.match(workspace, /id:\s*'dimension\.linear'/, 'numeric/driving Rectangle fallback must remain available for the protected Part path');
assert.match(stage, /SketchRectangleInteractionLayer/, 'Part stage must compose direct Rectangle outside B-Rep Three interaction');
assert.match(app, /rectangleDraft=\{rectangleDraft\}/, 'App must wire Rectangle transient state into PartModelStage');
assert.match(routes, /'rectangle'/, 'deterministic Rectangle fixture route must exist');
assert.match(fixtures, /Fixture rectangle:/, 'deterministic Rectangle fixture must be implemented');
assert.match(protectedPart, /Прямоугольник[\s\S]*getByTitle\('Параметры'\)/, 'protected Part must retain explicit numeric Rectangle + driving-dimension fallback');
assert.match(workflow, /direct-rectangle-browser\.mjs/, 'M3 browser lane must protect direct Rectangle');

console.log('ASA-CAD M3.5 direct Rectangle boundary PASS (shared input + canonical drag + one mutation + numeric fallback)');
