import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-equal-test' };
  }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used by M3.7D'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Equal' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};

const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Equal test' } })).createdIds?.[0] as CadSketchId;
const lineA = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [10, 2] } })).createdIds?.[0] as CadSketchEntityId;
const lineB = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [18, 8], to: [25, 16] } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineA && lineB);

const sourceGeometry = JSON.stringify(part().sketches[0].entities);
const created = await app.execute({ id: 'constraint.equal', payload: { sketchId, aEntityId: lineA, bEntityId: lineB } });
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
assert.deepEqual(part().constraints[0], { id: constraintId, type: 'equal', entityIds: [lineA, lineB] });
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Equal intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedA = solved.entities.find((entity) => entity.id === lineA);
const solvedB = solved.entities.find((entity) => entity.id === lineB);
assert.ok(solvedA?.type === 'line' && solvedB?.type === 'line');
if (solvedA?.type !== 'line' || solvedB?.type !== 'line') throw new Error('Expected solved Lines');
const adx = solvedA.data.to[0] - solvedA.data.from[0];
const ady = solvedA.data.to[1] - solvedA.data.from[1];
const bdx = solvedB.data.to[0] - solvedB.data.from[0];
const bdy = solvedB.data.to[1] - solvedB.data.from[1];
const lenA = Math.hypot(adx, ady), lenB = Math.hypot(bdx, bdy);
assert.ok(Math.abs(lenA - lenB) < 1e-5, 'PlaneGCS must solve equal Line lengths');

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.deepEqual(reopened.kind === 'part' ? reopened.constraints[0] : null, part().constraints[0], 'Save/Open must preserve Equal ID and Line refs');

const beforeDuplicate = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({ id: 'constraint.equal', payload: { sketchId, aEntityId: lineB, bEntityId: lineA } });
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate, 'symmetric duplicate must roll back');

const sameLine = await app.execute({ id: 'constraint.equal', payload: { sketchId, aEntityId: lineA, bEntityId: lineA } });
assert.equal(sameLine.ok, false);
assert.match(sameLine.error?.message ?? '', /two distinct Lines/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [40, 0], diameter: 8 } })).createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = serializeCadDocument(app.getDocument());
const wrongType = await app.execute({ id: 'constraint.equal', payload: { sketchId, aEntityId: lineA, bEntityId: circleId } });
assert.equal(wrongType.ok, false);
assert.match(wrongType.error?.message ?? '', /requires two Line entities/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);

const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } })).createdIds?.[0] as CadSketchId;
const otherLine = (await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 0], to: [3, 4] } })).createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({ id: 'constraint.equal', payload: { sketchId, aEntityId: lineA, bEntityId: otherLine } });
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch Equal must roll back');

const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketch = (await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const undoA = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, 0], to: [5, 1] } })).createdIds?.[0] as CadSketchEntityId;
const undoB = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [8, 2], to: [12, 6] } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({ id: 'constraint.equal', payload: { sketchId: undoSketch, aEntityId: undoA, bEntityId: undoB } });
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Equal ID');

const source = (path: string) => readFileSync(path, 'utf8');
const handler = source('src/application/commands/SketchConstraintCommandHandlers.ts');
const owner = source('src/application/commands/SketchLinePairConstraintOwner.ts');
const controller = source('src/web/useSketchConstraintControllers.ts');
const layer = source('src/web/viewport/SketchCoincidentInteractionLayer.tsx');
assert.match(handler, /addLinePairConstraint/); assert.match(owner, /sameUnorderedEntityPair/); assert.doesNotMatch(owner, /PlaneGCS|OpenCascade|vendor\//);
assert.match(controller, /setActiveCommand\('constraint\.equal'\)/); assert.match(controller, /id: 'constraint\.equal'/);
assert.match(layer, /tool="constraint\.equal"/); assert.match(layer, /pointSegmentDistance/); assert.doesNotMatch(layer, /CadApplication|app\.execute|OpenCascade/);
const appSource = source('src/web/App.tsx'), shell = source('src/web/CadShellCommandGroups.tsx'), mobile = source('src/web/MobileToolsPanel.tsx');
assert.match(appSource, /equalConstraint: workspace\.beginEqualConstraint/); assert.match(appSource, /equalCommit={workspace\.applyEqualConstraint}/);
assert.match(shell, /constraint\.equal/); assert.match(mobile, /constraint\.equal/);
const registry = JSON.parse(source('spec/ui/command-registry.v1.json')); const product = registry.commands.find((item: { id: string }) => item.id === 'constraint.equal');
assert.equal(product?.milestone, 'M3'); assert.equal(product?.status, 'implemented'); assert.equal(product?.backendCommand, 'constraint.equal');

undoApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD Equal PASS (Line↔Line length + validation + PlaneGCS + persistence/history + focused ownership)');
