import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const session = readFileSync('src/application/SketchSolveSession.ts', 'utf8');
const contract = readFileSync('src/contracts/sketchSolver.ts', 'utf8');
const planeGcs = readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const planeGcsVendor = readFileSync('vendor/toubkal/src/services/solver/PlaneGCSSolverAdapter.ts', 'utf8');
const solveStatus = readFileSync('src/web/SketchSolveStatus.tsx', 'utf8');

assert.match(contract, /degreesOfFreedom: number \| null/, 'solver result must expose explicit DoF availability');
assert.match(session, /previewEntities: CadSolvedSketchEntity\[\]/, 'solve session must own transient solved preview geometry');
assert.match(session, /constraintState: CadSketchConstraintState/, 'solve session must own constraint-state projection');
assert.match(session, /requestId !== this\.requestId/, 'solve session must reject stale async results');
assert.doesNotMatch(
  session,
  /from ['"][^'"]*(?:contracts\/application|CadApplicationImpl)['"]|import\s+(?:type\s+)?\{[^}]*CadApplication[^}]*\}/s,
  'solver session must not import/depend on CadApplication history ownership',
);
assert.doesNotMatch(session, /\.execute\(/, 'solver session must not persist geometry by executing hidden commands');
assert.doesNotMatch(session, /localStorage|indexedDB|CadProjectHost/, 'solver session must be independent of persistence');
assert.match(planeGcs, /degreesOfFreedom:/, 'PlaneGCS adapter must report DoF availability explicitly');
assert.match(planeGcsVendor, /get_gcs_conflicting_constraints()/, 'PlaneGCS native conflict diagnostics must cross the vendor seam');
assert.match(planeGcsVendor, /get_gcs_redundant_constraints()/, 'PlaneGCS native redundancy diagnostics must cross the vendor seam');
assert.match(session, /'over-constrained'/, 'solve session must expose over-constrained state');
assert.match(session, /PLANEGCS_CONFLICTING_CONSTRAINTS/, 'over state must recognize native conflict diagnostics');
assert.match(session, /PLANEGCS_REDUNDANT_CONSTRAINTS/, 'over state must recognize native redundancy diagnostics');
assert.match(solveStatus, /Эскиз: недоопределён/, 'SketchSolveStatus must present under-constrained state');
assert.match(solveStatus, /Эскиз: полностью определён/, 'SketchSolveStatus must present fully-constrained state');
assert.match(solveStatus, /Эскиз: переопределён/, 'SketchSolveStatus must present over-constrained state');

console.log('M2O Sketch solve boundary PASS (native DoF + native over-constraint diagnostics + transient preview)');
