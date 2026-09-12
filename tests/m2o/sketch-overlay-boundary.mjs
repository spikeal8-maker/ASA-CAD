import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync('src/web/viewport/SketchOverlayModel.ts', 'utf8');
const layer = readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
const app = readFileSync('src/web/App.tsx', 'utf8');
const stage = readFileSync('src/web/PartModelStage.tsx', 'utf8');
const solveHook = readFileSync('src/web/useActiveSketchSolveOverlay.ts', 'utf8');
const browserSolver = readFileSync('src/browser/BrowserSketchSolverAdapter.ts', 'utf8');
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
assert.match(app, /<PartModelStage\b/, 'App must delegate Part work-area solve/overlay presentation to a focused owner');
assert.doesNotMatch(app, /SketchSolveSession|PlaneGCSSketchSolverRuntime|buildSketchOverlayModel/, 'App must not own solver or overlay orchestration');
assert.match(stage, /useActiveSketchSolveOverlay\(/, 'PartModelStage must activate the focused Sketch solve/overlay hook');
assert.match(stage, /sketchOverlay=\{sketchOverlay\}/, 'PartModelStage must pass the transient overlay into CadViewport');
assert.match(stage, /Boolean\(props\.renderModel \|\| sketchOverlay\)/, 'Sketch-only editing must mount CadViewport even without B-Rep');
assert.match(solveHook, /new SketchSolveSession\(solver\)/, 'focused hook must own transient SketchSolveSession');
assert.match(solveHook, /buildSketchOverlayModel\(sketch, snapshot\)/, 'focused hook must project solve state through SketchOverlayModel');
assert.match(solveHook, /sketch\.entities\.length === 0/, 'empty Sketch must not eagerly initialize PlaneGCS');
assert.match(browserSolver, /import\('\.\.\/runtime\/PlaneGCSSketchSolverRuntime'\)/, 'browser solver must lazy-import the concrete PlaneGCS runtime');
assert.match(browserSolver, /planegcs\.wasm/, 'browser solver must provide an explicit browser PlaneGCS WASM URL');
assert.doesNotMatch(renderContract, /SketchOverlay|CadSketchEntity|sketchEntities/, 'B-Rep CadRenderModel contract must remain free of Sketch overlay geometry');
assert.match(picking, /kind: 'sketch-entity'/, 'shared viewport candidate model must retain Sketch entity picking seam');

console.log('M3.1 Sketch solve-overlay boundary PASS (active transient solver preview outside B-Rep/App ownership)');
