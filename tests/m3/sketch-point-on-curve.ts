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
    return { ok: true, diagnostics: [], runtimeRevision: 'point-on-curve-test' };
  }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Point-on-curve test' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};
const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'PointOnCurve' } })).createdIds?.[0] as CadSketchId;
const sourceLine = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [2, 4], to: [6, 7] } })).createdIds?.[0] as CadSketchEntityId;
const targetLine = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [10, 0] } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && sourceLine && targetLine);

const fixedTarget = await app.execute({
  id: 'constraint.fixed',
  payload: { sketchId, entityId: targetLine, frozenGeometry: { type: 'line', from: [0, 0], to: [10, 0] } },
});
assert.equal(fixedTarget.ok, true, fixedTarget.error?.message);
const sourceGeometry = JSON.stringify(part().sketches[0].entities);

const created = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: sourceLine, point: 'a' }, targetEntityId: targetLine },
});
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
const constraint = part().constraints.find((item) => item.id === constraintId);
assert.deepEqual(constraint, {
  id: constraintId,
  type: 'pointOnCurve',
  entityIds: [sourceLine, targetLine],
  data: { source: { entityId: sourceLine, point: 'a' } },
});
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Point-on-curve intent must not overwrite persisted source geometry');
const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));

function solvedLine(id: CadSketchEntityId) {
  const entity = solved.entities.find((item) => item.id === id);
  if (!entity || entity.type !== 'line') throw new Error(`Expected solved Line ${id}`);
  return entity.data;
}
function pointLineDistance(point: readonly number[], line: ReturnType<typeof solvedLine>): number {
  const dx = line.to[0] - line.from[0], dy = line.to[1] - line.from[1];
  return Math.abs((point[0] - line.from[0]) * dy - (point[1] - line.from[1]) * dx) / (Math.hypot(dx, dy) || 1);
}

const solvedSource = solvedLine(sourceLine);
const solvedTarget = solvedLine(targetLine);
assert.ok(pointLineDistance(solvedSource.from, solvedTarget) < 1e-5, 'source endpoint a must lie on the target Line');
assert.ok(Math.abs(solvedTarget.from[1]) < 1e-8 && Math.abs(solvedTarget.to[1]) < 1e-8, 'fixed target Line must stay fixed');

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const reopenedConstraint = reopened.kind === 'part' ? reopened.constraints.find((item) => item.id === constraintId) : null;
assert.deepEqual(reopenedConstraint, constraint, 'Save/Open must preserve Point-on-curve ID, endpoint ref and target Line');
const beforeInvalid = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: sourceLine, point: 'a' }, targetEntityId: targetLine },
});
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid, 'duplicate must roll back');

const selfTarget = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: sourceLine, point: 'b' }, targetEntityId: sourceLine },
});
assert.equal(selfTarget.ok, false);
assert.match(selfTarget.error?.message ?? '', /distinct Lines/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid);

for (const point of [undefined, 'c'] as const) {
  const invalidPoint = await app.execute({
    id: 'constraint.pointOnCurve',
    payload: { sketchId, source: { entityId: sourceLine, point }, targetEntityId: targetLine },
  });
  assert.equal(invalidPoint.ok, false);
  assert.match(invalidPoint.error?.message ?? '', /endpoint a or b/);
  assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid);
}
const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [15, 3], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
const beforeWrongType = serializeCadDocument(app.getDocument());
const wrongSource = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: circleId, point: 'a' }, targetEntityId: targetLine },
});
assert.equal(wrongSource.ok, false);
assert.match(wrongSource.error?.message ?? '', /source must target a Line/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);
const wrongTarget = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: sourceLine, point: 'b' }, targetEntityId: circleId },
});
assert.equal(wrongTarget.ok, false);
assert.match(wrongTarget.error?.message ?? '', /target must be a Line/);
assert.equal(serializeCadDocument(app.getDocument()), beforeWrongType);

const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other' } })).createdIds?.[0] as CadSketchId;
const otherLine = (await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 2], to: [4, 2] } })).createdIds?.[0] as CadSketchEntityId;
const beforeCrossSketch = serializeCadDocument(app.getDocument());
const crossSketch = await app.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId, source: { entityId: sourceLine, point: 'b' }, targetEntityId: otherLine },
});
assert.equal(crossSketch.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCrossSketch, 'cross-Sketch target must roll back');
const undoApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const undoSketch = (await undoApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const undoSource = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [1, 3], to: [4, 4] } })).createdIds?.[0] as CadSketchEntityId;
const undoTarget = (await undoApp.execute({ id: 'sketch.line', payload: { sketchId: undoSketch, from: [0, 0], to: [8, 0] } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await undoApp.execute({
  id: 'constraint.pointOnCurve',
  payload: { sketchId: undoSketch, source: { entityId: undoSource, point: 'a' }, targetEntityId: undoTarget },
});
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 1);
assert.equal((await undoApp.undo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await undoApp.redo()).ok, true);
assert.equal((undoApp.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore the same Point-on-curve ID');

const source = (path: string) => readFileSync(path, 'utf8');
const handler = source('src/application/commands/SketchConstraintCommandHandlers.ts');
const owner = source('src/application/commands/SketchPointOnCurveConstraintOwner.ts');
const runtime = source('src/runtime/PlaneGCSSketchSolverRuntime.ts');
const vendor = source('vendor/toubkal/src/services/solver/PlaneGCSSolverAdapter.ts');
assert.match(handler, /addPointOnCurveConstraint/);
assert.match(owner, /distinct Lines/);
assert.doesNotMatch(owner, /PlaneGCS|OpenCascade|vendor\//);
assert.match(runtime, /'POINT_ON_CURVE'/);
assert.match(vendor, /case 'POINT_ON_CURVE'/);
assert.match(vendor, /point_on_line_pl/);

undoApp.dispose();
solver.dispose();
app.dispose();

const controller = source('src/web/useSketchConstraintControllers.ts');
const layer = source('src/web/viewport/SketchPointOnCurveInteractionLayer.tsx');
const bridge = source('src/web/CoincidentPartModelStage.tsx');
const appSource = source('src/web/App.tsx');
const actions = source('src/web/M2CadUiActions.ts');
const mobile = source('src/web/MobileToolsPanel.tsx');
const groups = source('src/web/CadShellCommandGroups.tsx');
assert.match(controller, /setActiveCommand\('constraint\.pointOnCurve'\)/);
assert.match(controller, /id: 'constraint\.pointOnCurve'/);
assert.match(layer, /tool="constraint\.pointOnCurve"/);
assert.match(layer, /data-point-on-curve-phase/);
assert.doesNotMatch(layer, /CadApplication|app\.execute|PlaneGCS|OpenCascade/);
assert.match(bridge, /SketchPointOnCurveCommit/);
assert.match(bridge, /useSketchPointOnCurveCommit/);
assert.match(appSource, /pointOnCurveConstraint: workspace\.beginPointOnCurveConstraint/);
assert.match(appSource, /pointOnCurveCommit=\{workspace\.applyPointOnCurveConstraint\}/);
assert.match(actions, /pointOnCurveConstraint/);
assert.match(mobile, /id: 'constraint\.pointOnCurve'/);
assert.match(groups, /getAction\('constraint\.pointOnCurve'\)/);
const registry = JSON.parse(source('spec/ui/command-registry.v1.json'));
const product = registry.commands.find((item: { id: string }) => item.id === 'constraint.pointOnCurve');
assert.equal(product?.milestone, 'M3');
assert.equal(product?.status, 'implemented');
assert.equal(product?.backendCommand, 'constraint.pointOnCurve');

console.log('ASA-CAD Point-on-curve PASS (Line endpoint -> distinct Line + PlaneGCS + persistence/history + focused ownership/UI)');
