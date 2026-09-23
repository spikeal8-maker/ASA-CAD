import assert from 'node:assert/strict';
import fs from 'node:fs';

const geometry = fs.readFileSync('src/web/viewport/SketchRectangleGeometry.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchRectangleInteractionLayer.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchRectangleTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const editing = fs.readFileSync('src/web/useSketchEditingController.ts', 'utf8');
const parametricRectangle = fs.readFileSync('src/web/SketchParametricRectangleOwner.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const sketchStage = fs.readFileSync('src/web/SketchEditingStage.tsx', 'utf8');
const directTools = fs.readFileSync('src/web/SketchDirectToolLayers.tsx', 'utf8');
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

assert.match(workspace, /useSketchEditingController/, 'Part/Sketch facade must compose the focused Sketch editing owner');
assert.match(editing, /useSketchRectangleTool/, 'Sketch editing owner must own Rectangle transient state');
assert.match(editing, /rectangleTool\.reset\(\)/, 'Rectangle activation/cancel must reset transient tool state');
assert.match(editing, /hasRectangleDraft/, 'central commit must distinguish direct Rectangle from numeric fallback');
assert.match(editing, /commitParametricRectangle/, 'numeric Rectangle must delegate to its focused parametric owner');
assert.match(parametricRectangle, /id:\s*'dimension\.linear'/, 'numeric/driving Rectangle fallback must retain driving dimensions');
assert.match(parametricRectangle, /constraint\.horizontal/, 'numeric Rectangle must retain horizontal relations');
assert.match(parametricRectangle, /constraint\.vertical/, 'numeric Rectangle must retain vertical relations');
assert.match(parametricRectangle, /constraint\.coincident/, 'numeric Rectangle must keep all four edges connected');
assert.match(stage, /SketchEditingStage/, 'Part stage must delegate direct Sketch presentation');
assert.match(sketchStage, /<SketchDirectToolLayers/, 'Sketch editing stage must delegate direct-tool composition');
assert.match(directTools, /SketchRectangleInteractionLayer/, 'direct-tool owner must compose Rectangle outside B-Rep Three interaction');
assert.match(app, /rectangleDraft=\{rectangleDraft\}/, 'App must keep wiring Rectangle transient state through the stable PartModelStage contract');
assert.match(routes, /'rectangle'/, 'deterministic Rectangle fixture route must exist');
assert.match(fixtures, /Fixture rectangle:/, 'deterministic Rectangle fixture must be implemented');
assert.match(protectedPart, /Прямоугольник[\s\S]*getByTitle\('Параметры'\)/, 'protected Part must retain explicit numeric Rectangle + driving-dimension fallback');
assert.match(workflow, /direct-rectangle-browser\.mjs/, 'M3 browser lane must protect direct Rectangle');

console.log('ASA-CAD M3.5 direct Rectangle boundary PASS (focused direct-tool owner + shared input + canonical drag + one mutation + numeric fallback)');
