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
    return { ok: true, diagnostics: [], runtimeRevision: 'm3-tangent-test' };
  }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used by Tangent'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3 Tangent Line-Circle' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};
const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Tangent test' } })).createdIds?.[0] as CadSketchId;
const lineId = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [12, 1] } })).createdIds?.[0] as CadSketchEntityId;
const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [6, 5], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineId && circleId);

const sourceGeometry = JSON.stringify(part().sketches[0].entities);
const created = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: circleId, bEntityId: lineId } });
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
assert.deepEqual(part().constraints[0], { id: constraintId, type: 'tangent', entityIds: [lineId, circleId] }, 'Tangent persistence must canonicalize Line before Circle');
assert.deepEqual(part().sketches[0].constraintIds, [constraintId]);
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Tangent intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedLine = solved.entities.find((entity) => entity.id === lineId);
const solvedCircle = solved.entities.find((entity) => entity.id === circleId);
assert.ok(solvedLine?.type === 'line' && solvedCircle?.type === 'circle');
if (solvedLine?.type !== 'line' || solvedCircle?.type !== 'circle') throw new Error('Expected solved Line and Circle');
const [x1, y1] = solvedLine.data.from, [x2, y2] = solvedLine.data.to;
const [cx, cy] = solvedCircle.data.center;
const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
assert.ok(length > 1e-8, 'Solved Tangent Line must remain non-degenerate');
const distance = Math.abs(dy * cx - dx * cy + x2 * y1 - y2 * x1) / length;
const radius = solvedCircle.data.diameter / 2;
assert.ok(Math.abs(distance - radius) < 1e-5, `PlaneGCS must solve Line↔Circle tangent: distance=${distance}, radius=${radius}`);

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.deepEqual(reopened.kind === 'part' ? reopened.constraints[0] : null, part().constraints[0], 'Save/Open must preserve Tangent ID and stable refs');

const beforeDuplicate = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: lineId, bEntityId: circleId } });
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate, 'duplicate Tangent must roll back');

const sameEntity = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: lineId, bEntityId: lineId } });
assert.equal(sameEntity.ok, false);
assert.match(sameEntity.error?.message ?? '', /two distinct entities/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const otherLine = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [20, 0], to: [25, 3] } })).createdIds?.[0] as CadSketchEntityId;
const beforeLineLine = serializeCadDocument(app.getDocument());
const lineLine = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: lineId, bEntityId: otherLine } });
assert.equal(lineLine.ok, false);
assert.match(lineLine.error?.message ?? '', /one Line and one Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeLineLine);

const otherCircle = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [30, 6], diameter: 6 } })).createdIds?.[0] as CadSketchEntityId;
const beforeCircleCircle = serializeCadDocument(app.getDocument());
const circleCircle = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: circleId, bEntityId: otherCircle } });
assert.equal(circleCircle.ok, false);
assert.match(circleCircle.error?.message ?? '', /one Line and one Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeCircleCircle);

const arcId = (await app.execute({ id: 'sketch.arc', payload: { sketchId, center: [40, 5], start: [44, 5], end: [40, 9] } })).createdIds?.[0] as CadSketchEntityId;
const beforeArc = serializeCadDocument(app.getDocument());
const lineArc = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: lineId, bEntityId: arcId } });
assert.equal(lineArc.ok, false);
assert.match(lineArc.error?.message ?? '', /one Line and one Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeArc, 'Line↔Arc Tangent is explicitly out of scope for the first slice');

const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } })).createdIds?.[0] as CadSketchId;
const crossCircle = (await app.execute({ id: 'sketch.circle', payload: { sketchId: otherSketchId, center: [1, 4], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({ id: 'constraint.tangent', payload: { sketchId, aEntityId: lineId, bEntityId: crossCircle } });
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch Tangent must roll back');

const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketch = (await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const undoLine = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, 0], to: [8, 0] } })).createdIds?.[0] as CadSketchEntityId;
const undoCircle = (await undoApp.execute({ id: 'sketch.circle', payload: { sketchId: undoSketch, center: [4, 4], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({ id: 'constraint.tangent', payload: { sketchId: undoSketch, aEntityId: undoLine, bEntityId: undoCircle } });
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Tangent ID');

const handler = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const owner = fs.readFileSync('src/application/commands/SketchTangentConstraintOwner.ts', 'utf8');
const router = fs.readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const runtime = fs.readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
assert.match(handler, /'constraint\.tangent'/, 'constraint handler map must register Tangent');
assert.match(handler, /addLineCircleTangentConstraint/, 'general constraint map must delegate Tangent semantics');
assert.match(owner, /exactly one Line and one Circle/, 'focused owner must enforce first-slice operand scope');
assert.match(owner, /constraint\.type === 'tangent'/, 'focused owner must reject duplicate Tangent intent');
assert.doesNotMatch(`${handler}\n${owner}`, /PlaneGCS|OpenCascade|vendor\//, 'application Tangent owners must remain runtime-neutral');
assert.match(router, /case 'constraint\.tangent'/, 'Sketch command router must dispatch Tangent');
assert.match(runtime, /case 'tangent':/, 'ASA PlaneGCS adapter must map persisted Tangent');
assert.match(runtime, /'TANGENT'/, 'ASA PlaneGCS adapter must use the existing vendor Tangent type');

undoApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD Tangent PASS (Line↔Circle scope + validation + PlaneGCS + persistence/history + focused ownership)');
