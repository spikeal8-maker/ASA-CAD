import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync('src/web/viewport/SketchOverlayModel.ts', 'utf8');
const layer = readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
const app = readFileSync('src/web/App.tsx', 'utf8');
const partStage = readFileSync('src/web/PartModelStage.tsx', 'utf8');
const sketchStage = readFileSync('src/web/SketchEditingStage.tsx', 'utf8');
const solveHook = readFileSync('src/web/useActiveSketchSolveOverlay.ts', 'utf8');
const browserSolver = readFileSync('src/browser/BrowserSketchSolverAdapter.ts', 'utf8');
const buildConfig = readFileSync('build/rspack.asa.config.cjs', 'utf8');
const renderContract = readFileSync('src/contracts/render.ts', 'utf8');
const picking = readFileSync('src/web/viewport/ViewportPicking.ts', 'utf8');
const runtimeCss = readFileSync('src/web/runtime.css', 'utf8');

for (const [name, source] of [['model', model], ['layer', layer]]) {
  assert.doesNotMatch(source, /from ['"][^'"]*(?:three|opencascade|vendor|runtime\/)[^'"]*['"]/, `${name} must be kernel/Three/vendor independent`);
  assert.doesNotMatch(source, /CadProjectHost|localStorage|indexedDB/, `${name} must be persistence independent`);
}

assert.match(model, /source: SketchOverlaySource/, 'overlay model must record document vs solver-preview source');
assert.match(model, /solveSnapshot\.sketchId === sketch\.id/, 'solver preview must be scoped to the active Sketch id');
assert.match(model, /solveSnapshot\.status === 'solved'/, 'only a successful solve may replace document geometry in overlay');
assert.match(layer, /data-sketch-entity-id/, 'overlay layer must preserve stable Sketch entity identity in presentation DOM');
assert.match(runtimeCss, /\.cad-sketch-overlay\s*\{[\s\S]*pointer-events:\s*none;/, 'M3.1 overlay must stay read-only until direct Sketch interaction owns pointer routing');

assert.match(viewport, /sketchOverlay\?: SketchOverlayModel \| null/, 'CadViewport must accept Sketch overlay independently from B-Rep model');
assert.match(viewport, /<SketchOverlayLayer model=\{sketchOverlay\}/, 'CadViewport must mount Sketch overlay as a sibling presentation layer');
assert.match(app, /<PartModelStage\b/, 'App must delegate Part work-area presentation');
assert.doesNotMatch(app, /SketchSolveSession|PlaneGCSSketchSolverRuntime|buildSketchOverlayModel/, 'App must not own solver or overlay orchestration');
assert.match(partStage, /<SketchEditingStage/, 'PartModelStage must delegate active Sketch presentation wholesale');
assert.doesNotMatch(partStage, /useActiveSketchSolveOverlay|SketchSelectionLayer|SketchLineInteractionLayer/, 'PartModelStage must not regain Sketch editing orchestration');
assert.match(sketchStage, /useActiveSketchSolveOverlay\(/, 'SketchEditingStage must activate the focused Sketch solve/overlay hook');
const overlayBinding = sketchStage.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*solve\.overlay;/);
assert.ok(overlayBinding, 'SketchEditingStage must bind solve.overlay for presentation');
const overlayName = overlayBinding[1];
assert.match(sketchStage, new RegExp(`sketchOverlay=\\{${overlayName}\\}`), 'SketchEditingStage must pass transient overlay into CadViewport');
assert.match(sketchStage, new RegExp(`<CadViewport\\s+model=\\{null\\}\\s+sketchOverlay=\\{${overlayName}\\}`), 'isolated Sketch mode must not composite unprojected B-Rep geometry');
assert.match(sketchStage, /data-sketch-context="isolated-2d"/, 'Sketch editing stage must expose deliberate isolated workplane mode');
assert.match(solveHook, /new SketchSolveSession\(solver\)/, 'focused hook must own transient SketchSolveSession');
assert.match(solveHook, /buildSketchOverlayModel\(sketch, snapshot\)/, 'focused hook must project solve state through SketchOverlayModel');
assert.match(solveHook, /sketch\.entities\.length === 0/, 'empty Sketch must not eagerly initialize PlaneGCS');
assert.match(browserSolver, /import\('\.\.\/runtime\/PlaneGCSSketchSolverRuntime'\)/, 'browser solver must lazy-import the concrete PlaneGCS runtime');
assert.match(browserSolver, /planegcs\.wasm/, 'browser solver must provide an emitted PlaneGCS WASM URL');
assert.ok(buildConfig.includes('planegcs_dist') && buildConfig.includes('parser: { url: false }'), 'ASA build must isolate Emscripten planegcs.js new-URL parsing without disabling ASA WASM asset URLs globally');
assert.doesNotMatch(renderContract, /SketchOverlay|CadSketchEntity|sketchEntities/, 'B-Rep CadRenderModel contract must remain free of Sketch overlay geometry');
assert.match(picking, /kind: 'sketch-entity'/, 'shared viewport candidate model must retain Sketch entity picking seam');

console.log('M3.1 Sketch solve-overlay boundary PASS (SketchEditingStage owns isolated workplane + transient solver preview)');
