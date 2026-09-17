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
    return { ok: true, diagnostics: [], runtimeRevision: 'symmetry-test' };
  }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used by Symmetry'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Symmetry test' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};

const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Symmetry' } })).createdIds?.[0] as CadSketchId;
const lineA = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [-8, 1], to: [-4, 3] } })).createdIds?.[0] as CadSketchEntityId;
const lineB = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [5, 2], to: [8, 4] } })).createdIds?.[0] as CadSketchEntityId;
const axisId = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, -10], to: [0, 10] } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineA && lineB && axisId);

const axisFixed = await app.execute({
  id: 'constraint.fixed',
  payload: { sketchId, entityId: axisId, frozenGeometry: { type: 'line', from: [0, -10], to: [0, 10] } },
});
assert.equal(axisFixed.ok, true, axisFixed.error?.message);
const sourceGeometry = JSON.stringify(part().sketches[0].entities);

const created = await app.execute({
  id: 'constraint.symmetric',
  payload: {
    sketchId,
    a: { entityId: lineB, point: 'a' },
    b: { entityId: lineA, point: 'b' },
    axisEntityId: axisId,
  },
});
assert.equal(created.ok, true, created.error?.message);
const symmetryId = created.createdIds?.[0];
assert.ok(symmetryId);
const symmetry = part().constraints.find((item) => item.id === symmetryId);
const expectedRefs = [{ entityId: lineA, point: 'b' as const }, { entityId: lineB, point: 'a' as const }].sort((a, b) => `${a.entityId}:${a.point}`.localeCompare(`${b.entityId}:${b.point}`));
assert.deepEqual(symmetry, {
  id: symmetryId,
  type: 'symmetric',
  entityIds: [expectedRefs[0].entityId, expectedRefs[1].entityId, axisId],
  data: { refs: expectedRefs },
});
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Symmetry intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));

function solvedLine(id: CadSketchEntityId) {
  const entity = solved.entities.find((item) => item.id === id);
  if (!entity || entity.type !== 'line') throw new Error(`Expected solved Line ${id}`);
  return entity.data;
}
function endpoint(data: ReturnType<typeof solvedLine>, point: 'a' | 'b') {
  return point === 'a' ? data.from : data.to;
}
function symmetryResidual(p1: readonly number[], p2: readonly number[], axis: ReturnType<typeof solvedLine>) {
  const dx = axis.to[0] - axis.from[0], dy = axis.to[1] - axis.from[1];
  const axisLength = Math.hypot(dx, dy) || 1;
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
  const midpointDistance = Math.abs((mx - axis.from[0]) * dy - (my - axis.from[1]) * dx) / axisLength;
  const pointDeltaAlongAxis = Math.abs((p1[0] - p2[0]) * dx + (p1[1] - p2[1]) * dy) / axisLength;
  return { midpointDistance, pointDeltaAlongAxis };
}

const relation = symmetryResidual(endpoint(solvedLine(lineA), 'b'), endpoint(solvedLine(lineB), 'a'), solvedLine(axisId));
assert.ok(relation.midpointDistance < 1e-5, `Symmetry midpoint must lie on axis: ${relation.midpointDistance}`);
assert.ok(relation.pointDeltaAlongAxis < 1e-5, `Symmetric points must be perpendicular to axis: ${relation.pointDeltaAlongAxis}`);

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const reopenedSymmetry = reopened.kind === 'part' ? reopened.constraints.find((item) => item.id === symmetryId) : null;
assert.deepEqual(reopenedSymmetry, symmetry, 'Save/Open must preserve Symmetry ID, endpoint refs and axis');

const beforeInvalid = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'b' }, b: { entityId: lineB, point: 'a' }, axisEntityId: axisId },
});
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid, 'reversed duplicate must roll back');

const sameOwner = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: lineA, point: 'b' }, axisEntityId: axisId },
});
assert.equal(sameOwner.ok, false);
assert.match(sameOwner.error?.message ?? '', /distinct/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid);

const axisReuse = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: lineB, point: 'a' }, axisEntityId: lineA },
});
assert.equal(axisReuse.ok, false);
assert.match(axisReuse.error?.message ?? '', /distinct axis Line/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid);

const invalidPoint = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'c' }, b: { entityId: lineB, point: 'a' }, axisEntityId: axisId },
});
assert.equal(invalidPoint.ok, false);
assert.match(invalidPoint.error?.message ?? '', /endpoint a or b/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid);

const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [15, 0], diameter: 6 } })).createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = serializeCadDocument(app.getDocument());
const wrongPointType = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: circleId, point: 'a' }, b: { entityId: lineB, point: 'a' }, axisEntityId: axisId },
});
assert.equal(wrongPointType.ok, false);
assert.match(wrongPointType.error?.message ?? '', /must target a Line entity/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);
const wrongAxisType = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: lineB, point: 'a' }, axisEntityId: circleId },
});
assert.equal(wrongAxisType.ok, false);
assert.match(wrongAxisType.error?.message ?? '', /axis must target a Line/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);

const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other' } })).createdIds?.[0] as CadSketchId;
const otherLine = (await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 0], to: [2, 2] } })).createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({
  id: 'constraint.symmetric',
  payload: { sketchId, a: { entityId: lineA, point: 'a' }, b: { entityId: otherLine, point: 'a' }, axisEntityId: axisId },
});
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch Symmetry must roll back');

const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketch = (await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const undoA = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [-4, 1], to: [-2, 2] } })).createdIds?.[0] as CadSketchEntityId;
const undoB = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [3, 1], to: [5, 2] } })).createdIds?.[0] as CadSketchEntityId;
const undoAxis = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, -5], to: [0, 5] } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({
  id: 'constraint.symmetric',
  payload: { sketchId: undoSketch, a: { entityId: undoA, point: 'b' }, b: { entityId: undoB, point: 'a' }, axisEntityId: undoAxis },
});
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Symmetry ID');

const source = (path: string) => readFileSync(path, 'utf8');
const handler = source('src/application/commands/SketchConstraintCommandHandlers.ts');
const owner = source('src/application/commands/SketchSymmetryConstraintOwner.ts');
const runtime = source('src/runtime/PlaneGCSSketchSolverRuntime.ts');
assert.match(handler, /addSymmetryConstraint/);
assert.match(owner, /canonicalEndpointPair/);
assert.match(owner, /distinct axis Line/);
assert.doesNotMatch(owner, /PlaneGCS|OpenCascade|vendor\//);
assert.match(runtime, /'SYMMETRY'/);
const controller = source('src/web/useSketchConstraintControllers.ts');
const layer = source('src/web/viewport/SketchSymmetryInteractionLayer.tsx');
const bridge = source('src/web/CoincidentPartModelStage.tsx');
const appSource = source('src/web/App.tsx');
const actions = source('src/web/M2CadUiActions.ts');
const mobile = source('src/web/MobileToolsPanel.tsx');
const groups = source('src/web/CadShellCommandGroups.tsx');
assert.match(controller, /setActiveCommand\('constraint\.symmetric'\)/); assert.match(controller, /id: 'constraint\.symmetric'/);
assert.match(layer, /tool=\"constraint\.symmetric\"/); assert.match(layer, /data-symmetry-phase/); assert.doesNotMatch(layer, /CadApplication|app\.execute|PlaneGCS|OpenCascade/);
assert.match(bridge, /SketchSymmetryCommit/); assert.match(bridge, /useSketchSymmetryCommit/);
assert.match(appSource, /symmetricConstraint: workspace\.beginSymmetryConstraint/); assert.match(appSource, /symmetryCommit=\{workspace\.applySymmetryConstraint\}/);
assert.match(actions, /symmetricConstraint/); assert.match(mobile, /id: 'constraint\.symmetric'/); assert.match(groups, /getAction\('constraint\.symmetric'\)/);
const registry = JSON.parse(source('spec/ui/command-registry.v1.json')); const product = registry.commands.find((item: { id: string }) => item.id === 'constraint.symmetric');
assert.equal(product?.milestone, 'M3'); assert.equal(product?.status, 'implemented'); assert.equal(product?.backendCommand, 'constraint.symmetric');

undoApp.dispose();
solver.dispose();
app.dispose();
console.log('ASA-CAD Symmetry PASS (Line endpoints + distinct Line axis + PlaneGCS + persistence/history + focused ownership)');
