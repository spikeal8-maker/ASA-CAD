import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadPartDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-perpendicular-test' };
  }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used by M3.7E'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3.7E Perpendicular' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};
const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Perpendicular test' } })).createdIds?.[0] as CadSketchId;
const lineA = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [10, 2] } })).createdIds?.[0] as CadSketchEntityId;
const lineB = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [18, 8], to: [25, 16] } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineA && lineB);

const sourceGeometry = JSON.stringify(part().sketches[0].entities);
const created = await app.execute({ id: 'constraint.perpendicular', payload: { sketchId, aEntityId: lineA, bEntityId: lineB } });
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
assert.deepEqual(part().constraints[0], { id: constraintId, type: 'perpendicular', entityIds: [lineA, lineB] });
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Perpendicular intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedA = solved.entities.find((entity) => entity.id === lineA);
const solvedB = solved.entities.find((entity) => entity.id === lineB);
assert.ok(solvedA?.type === 'line' && solvedB?.type === 'line');
if (solvedA?.type !== 'line' || solvedB?.type !== 'line') throw new Error('Expected solved Lines');
const av = [solvedA.data.to[0] - solvedA.data.from[0], solvedA.data.to[1] - solvedA.data.from[1]] as const;
const bv = [solvedB.data.to[0] - solvedB.data.from[0], solvedB.data.to[1] - solvedB.data.from[1]] as const;
const scale = Math.hypot(...av) * Math.hypot(...bv);
assert.ok(scale > 0 && Math.abs(av[0] * bv[0] + av[1] * bv[1]) / scale < 1e-5, 'PlaneGCS must solve Line directions perpendicular');

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.deepEqual(reopened.kind === 'part' ? reopened.constraints[0] : null, part().constraints[0], 'Save/Open must preserve Perpendicular ID and Line refs');

const beforeDuplicate = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({ id: 'constraint.perpendicular', payload: { sketchId, aEntityId: lineB, bEntityId: lineA } });
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate, 'symmetric duplicate must roll back');

const sameLine = await app.execute({ id: 'constraint.perpendicular', payload: { sketchId, aEntityId: lineA, bEntityId: lineA } });
assert.equal(sameLine.ok, false);
assert.match(sameLine.error?.message ?? '', /two distinct Lines/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [40, 0], diameter: 8 } })).createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = serializeCadDocument(app.getDocument());
const wrongType = await app.execute({ id: 'constraint.perpendicular', payload: { sketchId, aEntityId: lineA, bEntityId: circleId } });
assert.equal(wrongType.ok, false);
assert.match(wrongType.error?.message ?? '', /requires two Line entities/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);

const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } })).createdIds?.[0] as CadSketchId;
const otherLine = (await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 0], to: [3, 4] } })).createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({ id: 'constraint.perpendicular', payload: { sketchId, aEntityId: lineA, bEntityId: otherLine } });
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch Perpendicular must roll back');

const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketch = (await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const undoA = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, 0], to: [5, 1] } })).createdIds?.[0] as CadSketchEntityId;
const undoB = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [8, 2], to: [12, 6] } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({ id: 'constraint.perpendicular', payload: { sketchId: undoSketch, aEntityId: undoA, bEntityId: undoB } });
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Perpendicular ID');

const handler = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const controllers = fs.readFileSync('src/web/useSketchConstraintControllers.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchCoincidentInteractionLayer.tsx', 'utf8');
const bridge = fs.readFileSync('src/web/CoincidentPartModelStage.tsx', 'utf8');
const appSource = fs.readFileSync('src/web/App.tsx', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const ribbon = fs.readFileSync('src/web/CadShellTop.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
assert.match(handler, /'constraint\.perpendicular'/, 'focused constraint owner must register Perpendicular');
assert.match(handler, /addLinePairConstraint/, 'Parallel and Perpendicular must share Line-pair validation');
assert.match(handler, /sameUnorderedEntityPair/, 'Line-pair constraints must reject symmetric duplicates');
assert.doesNotMatch(handler, /PlaneGCS|OpenCascade|vendor\//, 'application constraint owner must remain runtime-neutral');
assert.match(controllers, /setActiveCommand\('constraint\.perpendicular'\)/, 'Perpendicular must enter explicit transient mode');
assert.match(controllers, /id: 'constraint\.perpendicular'/, 'second Line must commit one typed CadApplication command');
assert.match(layer, /tool="constraint\.perpendicular"/, 'Perpendicular must activate shared whole-Line picker');
assert.match(layer, /SketchLinePairInteractionLayer/, 'Parallel and Perpendicular must share picker ownership');
assert.match(layer, /pointSegmentDistance/, 'whole-Line hit testing must remain geometric');
assert.doesNotMatch(layer, /CadApplication|app\.execute|OpenCascade|PlaneGCS/, 'interaction layer must not mutate document or own solver runtime');
assert.match(bridge, /useSketchPerpendicularCommit/, 'stage bridge must expose focused Perpendicular commit context');
assert.match(appSource, /perpendicularCommit=\{workspace\.applyPerpendicularConstraint\}/, 'App must wire Perpendicular through focused workspace ownership');
assert.match(mobile, /id: 'constraint\.perpendicular'/, 'mobile Tools must expose Perpendicular');
assert.match(ribbon, /getAction\('constraint\.perpendicular'\)/, 'desktop ribbon must consume the same action');
const command = registry.commands.find((item: { id: string }) => item.id === 'constraint.perpendicular');
assert.ok(command, 'constraint.perpendicular must exist in registry');
assert.equal(command.milestone, 'M3.7E');
assert.equal(command.status, 'implemented');
assert.equal(command.backendCommand, 'constraint.perpendicular');

undoApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD M3.7E Perpendicular PASS (Line pair + duplicate/type/scope guards + PlaneGCS + persistence/history + shared UI ownership)');
