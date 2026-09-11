import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync('src/web/viewport/SketchOverlayModel.ts', 'utf8');
const layer = readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
const renderContract = readFileSync('src/contracts/render.ts', 'utf8');
const picking = readFileSync('src/web/viewport/ViewportPicking.ts', 'utf8');

for (const [name, source] of [['model', model], ['layer', layer]]) {
  assert.doesNotMatch(source, /from ['"][^'"]*(?:three|opencascade|vendor|runtime\/)[^'"]*['"]/, `${name} must be kernel/Three/vendor independent`);
  assert.doesNotMatch(source, /CadProjectHost|localStorage|indexedDB/, `${name} must be persistence independent`);
}

assert.match(model, /source: SketchOverlaySource/, 'overlay model must record document vs solver-preview source');
assert.match(model, /solveSnapshot\.sketchId === sketch\.id/, 'solver preview must be scoped to the active Sketch id');
assert.match(model, /solveSnapshot\.status === 'solved'/, 'only a successful solve may replace document geometry in overlay');
assert.match(layer, /data-sketch-entity-id/, 'overlay layer must preserve stable Sketch entity identity in presentation DOM');
assert.match(layer, /pointer-events: none|pointerEvents/m, 'overlay interaction must not be invented inside presentation component');

assert.match(viewport, /sketchOverlay\?: SketchOverlayModel \| null/, 'CadViewport must accept Sketch overlay independently from B-Rep model');
assert.match(viewport, /<SketchOverlayLayer model=\{sketchOverlay\}/, 'CadViewport must mount Sketch overlay as a sibling presentation layer');
assert.doesNotMatch(renderContract, /SketchOverlay|CadSketchEntity|sketchEntities/, 'B-Rep CadRenderModel contract must remain free of Sketch overlay geometry');
assert.match(picking, /kind: 'sketch-entity'/, 'shared viewport candidate model must retain future Sketch entity picking seam');

console.log('M2O O8 Sketch overlay boundary PASS (separate transient 2D layer outside B-Rep/Three/runtime)');
