import assert from 'node:assert/strict';
import fs from 'node:fs';

const interaction = fs.readFileSync('src/web/viewport/SketchLineInteractionLayer.tsx', 'utf8');
const surface = fs.readFileSync('src/web/viewport/SketchInteractionSurface.tsx', 'utf8');
const overlay = fs.readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const viewportGeometry = fs.readFileSync('src/web/viewport/SketchViewportGeometry.ts', 'utf8');
const tool = fs.readFileSync('src/web/useSketchLineTool.ts', 'utf8');
const workspace = fs.readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const styles = fs.readFileSync('src/web/styles.css', 'utf8');
const bindings = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

for (const source of [interaction, surface]) {
  for (const forbidden of ['CadApplication', 'OpenCascade', 'vendor/', 'CadProjectHost', 'localStorage']) {
    assert.equal(source.includes(forbidden), false, `Sketch interaction presentation must not depend on ${forbidden}`);
  }
}

assert.match(interaction, /SketchInteractionSurface/, 'Line must reuse the shared Sketch interaction substrate');
for (const forbidden of ['touchesRef', 'panSketchViewport', 'zoomSketchViewport', 'onPointerDown=', 'onPointerUp=', 'getBoundingClientRect']) {
  assert.equal(interaction.includes(forbidden), false, `Line layer must not duplicate shared input policy: ${forbidden}`);
}
assert.match(surface, /onPointerDown=/, 'shared Sketch surface must use Pointer Events');
assert.match(surface, /onPointerMove=/, 'shared Sketch surface must own transient pointer movement');
assert.match(surface, /onPointerUp=/, 'shared Sketch surface must arbitrate touch taps on release');
assert.match(surface, /touchesRef\.current\.size >= 2/, 'secondary touches must enter navigation arbitration');
assert.match(surface, /panSketchViewport/, 'shared two-touch navigation must pan transient Sketch view state');
assert.match(surface, /zoomSketchViewport/, 'shared pinch/wheel navigation must zoom transient Sketch view state');
assert.match(surface, /wasMultiTouch/, 'multi-touch contacts must not become geometry points on release');

assert.match(viewportGeometry, /SketchViewportState/, 'Sketch view must have explicit transient state');
assert.match(viewportGeometry, /span: 100/, 'Sketch must open with a usable stable engineering frame');
assert.equal(viewportGeometry.includes('CadSketchEntity'), false, 'Sketch viewport frame must not refit from entity bounds');
assert.match(stage, /useState\(resetSketchViewportState\)/, 'Part stage must own transient Sketch camera state');
assert.match(stage, /\[props\.activeSketch\?\.id\]/, 'Sketch camera may reset only when active Sketch changes');
assert.match(overlay, /useSketchViewportFrame/, 'persisted\/solver overlay must consume the same stable Sketch frame');
assert.equal(/sketchDisplayFrame\(model\.entities\)/.test(overlay), false, 'overlay must not refit after geometry commit');

assert.match(tool, /id: 'sketch\.line'/, 'Line tool must commit through typed sketch.line command');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Line tool must not mutate persisted Sketch entities directly');
assert.match(stage, /SketchLineInteractionLayer/, 'Part stage must compose the separate Line interaction layer');
assert.match(bindings, /'sketch\.line': binding\(handlers\.line/, 'shared action catalog must bind sketch.line');

assert.match(workspace, /setPanel\('closed'\)/, 'direct Line must collapse management UI before drawing');
assert.match(app, /activePanel === 'closed' \? ' panel-closed'/, 'shell must expose explicit closed management state');
assert.match(styles, /\.content-area\.panel-closed \.management-panel \{ display: none; \}/, 'closed panel must not cover the workplane');

const line = registry.commands.find((command) => command.id === 'sketch.line');
assert.ok(line, 'command registry must contain sketch.line');
assert.equal(line.status, 'implemented', 'sketch.line must be implemented only with the M3.2 product path');
assert.equal(line.milestone, 'M3.2');

console.log('ASA-CAD M3.2 direct Line architecture boundary PASS (shared input substrate + stable view + panel collapse)');
