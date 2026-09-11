import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/web/App.tsx', 'utf8');
const hook = readFileSync('src/web/useSketchSolveOverlay.ts', 'utf8');
const browserAdapter = readFileSync('src/browser/BrowserSketchSolverAdapter.ts', 'utf8');
const solveSession = readFileSync('src/application/SketchSolveSession.ts', 'utf8');
const overlayModel = readFileSync('src/web/viewport/SketchOverlayModel.ts', 'utf8');
const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');

assert.match(app, /useSketchSolveOverlay/, 'App must consume the M3 solve-overlay orchestration hook');
assert.match(app, /sketchOverlay=\{sketchOverlay\}/, 'active Sketch overlay must be passed through the viewport seam');
assert.match(app, /<SketchSolveStatus/, 'solve status must have an explicit product projection');
assert.doesNotMatch(app, /PlaneGCS|PlaneGCSSketchSolverRuntime|vendor\/toubkal/, 'App must not import concrete solver/vendor internals');

assert.match(hook, /new SketchSolveSession\(new BrowserSketchSolverAdapter\(\)\)/, 'browser M3 orchestration must use ASA solve-session + lazy browser adapter');
assert.match(hook, /activeSketchId/, 'solve orchestration must target explicit active Sketch ID');
assert.match(hook, /revisionToken/, 'solve orchestration must react to in-place CadApplication mutations');
assert.match(hook, /activeSketch\.entities\.length === 0/, 'empty Sketch must not initialize the solver');
assert.doesNotMatch(hook, /latestSketch\(/, 'M3 solve path must never infer active Sketch from document order');

assert.match(browserAdapter, /import\('\.\.\/runtime\/PlaneGCSSketchSolverRuntime'\)/, 'PlaneGCS runtime must load lazily behind browser adapter');
assert.doesNotMatch(browserAdapter, /from ['"][^'"]*vendor/, 'browser product adapter must not statically import vendor modules');

assert.doesNotMatch(solveSession, /CadApplication|\.execute\(/, 'transient solve session must not own persisted application history');
assert.match(overlayModel, /source: useSolvedPreview \? 'solver-preview' : 'document'/, 'overlay model must distinguish persisted vs transient geometry');
assert.match(viewport, /sketchOverlay\?: SketchOverlayModel \| null/, 'viewport must keep Sketch overlay separate from B-Rep render model');

console.log('M3.1 solve-overlay boundary PASS (explicit Sketch -> lazy solver -> transient overlay, no history/runtime bypass)');
