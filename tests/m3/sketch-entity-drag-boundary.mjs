import assert from 'node:assert/strict';
import fs from 'node:fs';

const commands = fs.readFileSync('src/contracts/commands.ts', 'utf8');
const handlers = fs.readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const transform = fs.readFileSync('src/application/SketchEntityTransform.ts', 'utf8');
const solveSession = fs.readFileSync('src/application/SketchSolveSession.ts', 'utf8');
const solveHook = fs.readFileSync('src/web/useActiveSketchSolveOverlay.ts', 'utf8');
const dragHook = fs.readFileSync('src/web/useSketchEntityDrag.ts', 'utf8');
const selection = fs.readFileSync('src/web/viewport/SketchSelectionLayer.tsx', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const app = fs.readFileSync('src/web/App.tsx', 'utf8');
const viewport = fs.readFileSync('src/web/CadViewport.tsx', 'utf8');

assert.match(commands, /'sketch\.entity\.translate'/, 'typed command union must contain sketch.entity.translate');
assert.match(commands, /'sketch\.entity\.translate':\s*\{\s*sketchId:\s*CadSketchId;\s*entityId:\s*CadSketchEntityId;\s*delta:\s*readonly \[number, number\];/s,
  'translate payload must be explicit sketchId + entityId + 2D delta');
assert.match(handlers, /handler<'sketch\.entity\.translate'>/, 'translate command must be handled inside the typed Sketch command registry');
assert.match(handlers, /isFixedSketchEntity/, 'Fixed entity translation must be rejected deterministically');
assert.match(handlers, /translateSketchEntity/, 'application handler and preview must share rigid DTO translation semantics');

assert.match(transform, /case 'line':[\s\S]*from: translatePoint[\s\S]*to: translatePoint/, 'Line rigid translation must move both endpoints');
assert.match(transform, /case 'circle':[\s\S]*center: translatePoint/, 'Circle rigid translation must move its center');
assert.match(transform, /case 'arc':[\s\S]*center: translatePoint/, 'Arc rigid translation must move only its center while preserving radius/angles via data spread');
assert.equal(/\.entities\.(push|splice)/.test(transform), false, 'pure transform helper must not mutate persisted entity arrays');

assert.match(solveSession, /solveCandidate\(/, 'SketchSolveSession must expose transient candidate solving');
assert.match(solveSession, /const candidate = structuredClone\(document\)/, 'candidate solving must clone persisted document first');
assert.match(solveSession, /sketch\.entities = structuredClone/, 'only cloned Sketch entities may be replaced for candidate solve');
assert.match(solveHook, /previewCandidate/, 'React solve bridge must expose candidate preview');
assert.match(solveHook, /restorePersistedPreview/, 'React solve bridge must restore persisted preview on cancel/failure');

assert.match(dragHook, /translateSketchEntitiesCandidate/, 'drag controller must construct transient geometry candidates');
assert.match(dragHook, /previewCandidate\(candidate\)/, 'pointer movement/end must validate candidates through solver preview');
assert.match(dragHook, /solved\.status !== 'solved'/, 'failed solve must block commit');
assert.match(dragHook, /await commit\(current\.entityId, delta\)/, 'pointer-up must commit through application command seam only after solve');
assert.equal(/\.entities\.(push|splice)|\.data\s*=/.test(dragHook), false, 'drag controller must not mutate persisted DTOs directly');

assert.match(selection, /setPointerCapture/, 'selected stable-ID hit target must own pointer capture during drag');
assert.match(selection, /selectedEntityId !== entityId/, 'drag may start only on the currently selected stable entity ID');
assert.match(selection, /screenPointToSketchPoint/, 'drag pointer must map through the accepted stable Sketch viewport frame');
assert.match(stage, /useSketchEntityDrag/, 'Part stage must compose the transient drag controller');
assert.match(stage, /sketchOverlay=\{sketchOverlay\}/, 'accepted CadViewport -> SketchOverlay boundary must remain intact');
assert.equal(app.includes('sketch.entity.translate'), false, 'Sketch rigid-drag command logic must not return to App.tsx');
assert.equal(viewport.includes('sketch.entity.translate'), false, 'Sketch rigid-drag command logic must not enter the B-Rep Three viewport');
assert.equal(viewport.includes('useSketchEntityDrag'), false, 'B-Rep Three viewport must not own Sketch drag interaction');

console.log('ASA-CAD M3.6B rigid drag boundary PASS (typed translation + cloned solver candidate + stable-ID pointer drag + O8 boundaries)');
