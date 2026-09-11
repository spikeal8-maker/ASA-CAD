import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const session = readFileSync('src/application/SketchSolveSession.ts', 'utf8');
const contract = readFileSync('src/contracts/sketchSolver.ts', 'utf8');
const planeGcs = readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');

assert.match(contract, /degreesOfFreedom: number \| null/, 'solver result must expose explicit DoF availability');
assert.match(session, /previewEntities: CadSolvedSketchEntity\[\]/, 'solve session must own transient solved preview geometry');
assert.match(session, /constraintState: CadSketchConstraintState/, 'solve session must own constraint-state projection');
assert.match(session, /requestId !== this\.requestId/, 'solve session must reject stale async results');
assert.doesNotMatch(session, /CadApplication/, 'solver session must not bypass CadApplication history');
assert.doesNotMatch(session, /\.execute\(/, 'solver session must not persist geometry by executing hidden commands');
assert.doesNotMatch(session, /localStorage|indexedDB|CadProjectHost/, 'solver session must be independent of persistence');
assert.match(planeGcs, /degreesOfFreedom:/, 'PlaneGCS adapter must report DoF availability explicitly');

console.log('M2O Sketch solve boundary PASS (transient preview, explicit DoF, no document/history bypass)');
