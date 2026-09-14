import assert from 'node:assert/strict';
import fs from 'node:fs';

const commands = fs.readFileSync('src/contracts/commands.ts', 'utf8');
const transform = fs.readFileSync('src/application/SketchEntityTransform.ts', 'utf8');
const edit = fs.readFileSync('src/application/commands/SketchEditCommandHandlers.ts', 'utf8');
const solveOverlay = fs.readFileSync('src/web/useActiveSketchSolveOverlay.ts', 'utf8');
const drag = fs.readFileSync('src/web/useSketchEntityDrag.ts', 'utf8');
const selection = fs.readFileSync('src/web/viewport/SketchSelectionLayer.tsx', 'utf8');
const stage = fs.readFileSync('src/web/SketchEditingStage.tsx', 'utf8');
const partStage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');

assert.match(commands, /\| 'sketch\.entity\.translate'/, 'typed command ID must contain Sketch translation');
assert.match(commands, /'sketch\.entity\.translate':\s*\{[\s\S]*sketchId:[\s\S]*entityId:[\s\S]*delta:/, 'translation payload must be sketchId + stable entityId + delta');

for (const semantic of [
  /case 'line':[\s\S]*from: translate\(entity\.data\.from\)[\s\S]*to: translate\(entity\.data\.to\)/,
  /case 'circle':[\s\S]*center: translate\(entity\.data\.center\)/,
  /case 'arc':[\s\S]*center: translate\(entity\.data\.center\)/,
]) {
  assert.match(transform, semantic, 'rigid transform family is incomplete');
}
assert.match(transform, /id: entity\.id/, 'rigid translation must retain stable entity ID');
assert.match(transform, /buildSketchTranslationCandidate/, 'drag preview must use a transient candidate builder');

assert.match(edit, /'sketch\.entity\.translate'/, 'translation belongs to focused Sketch edit owner');
assert.match(edit, /Fixed sketch entity cannot be translated/, 'application boundary must protect fixed entities');
assert.doesNotMatch(edit, /OpenCascade|PlaneGCS|window\.oc/, 'edit command owner must stay runtime-neutral');

assert.match(solveOverlay, /previewCandidate/, 'solve bridge must expose transient candidate solving');
assert.match(drag, /previewCandidate\(candidateFor/, 'pointer move/end must validate transient candidates');
assert.match(drag, /commit\(current\.entityId, delta\)/, 'pointer-up may commit exactly one typed translation');
assert.match(drag, /restorePersistedPreview/, 'cancel/failure must restore persisted solver preview');
assert.match(drag, /selectedEntityId !== entityId/, 'drag may begin only on the selected stable-ID entity');
assert.match(drag, /constraint\.type === 'fixed'/, 'drag controller must reject fixed entity before transient motion');

assert.match(selection, /setPointerCapture/, 'selection interaction layer must own pointer capture for drag');
assert.match(selection, /screenPointToSketchPoint/, 'drag must use shared Sketch viewport coordinate conversion');
assert.match(selection, /data-dragging-sketch-entity-id/, 'drag state must be observable for deterministic browser regression');
assert.match(stage, /useSketchEntityDrag/, 'SketchEditingStage must own drag orchestration');
assert.match(stage, /onSketchEntityTranslate/, 'durable drag commit must be delegated out of presentation');
assert.doesNotMatch(partStage, /useSketchEntityDrag|SketchEntityTransform|previewCandidate/, 'PartModelStage must not absorb Sketch drag logic');

for (const source of [drag, selection, stage]) {
  assert.doesNotMatch(source, /vendor\/|window\.oc|TopoDS|OpenCascade/, 'M3.6B UI must not reach vendor/OCC internals');
}

console.log('ASA-CAD M3.6B drag architecture PASS (typed stable-ID command + transient solver candidate + focused Sketch interaction owner)');
