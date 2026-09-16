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
  async recompute(): Promise<CadRuntimeRecomputeResult> { return { ok: true, diagnostics: [], runtimeRevision: 'm3-concentric-test' }; }
  async captureReference(): Promise<never> { throw new Error('reference capture is not used by Concentric'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3 Concentric Circle-Circle' }), new NoopRuntime());
const part = (): Readonly<CadPartDocument> => {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
};
const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Concentric test' } })).createdIds?.[0] as CadSketchId;
const circleA = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [2, 3], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
const circleB = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [9, 7], diameter: 10 } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && circleA && circleB);

const sourceGeometry = JSON.stringify(part().sketches[0].entities);
const created = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: circleB, bEntityId: circleA } });
assert.equal(created.ok, true, created.error?.message);
const constraintId = created.createdIds?.[0];
assert.ok(constraintId);
const expectedIds = [circleA, circleB].sort();
assert.deepEqual(part().constraints[0], { id: constraintId, type: 'concentric', entityIds: expectedIds });
assert.equal(JSON.stringify(part().sketches[0].entities), sourceGeometry, 'Concentric intent must not overwrite persisted source geometry');

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const a = solved.entities.find((entity) => entity.id === circleA);
const b = solved.entities.find((entity) => entity.id === circleB);
assert.ok(a?.type === 'circle' && b?.type === 'circle');
if (a?.type !== 'circle' || b?.type !== 'circle') throw new Error('Expected two solved Circles');
assert.ok(Math.hypot(a.data.center[0] - b.data.center[0], a.data.center[1] - b.data.center[1]) < 1e-6, 'PlaneGCS must solve equal centers');
assert.ok(Math.abs(a.data.diameter - 4) < 1e-6, 'Concentric must preserve first radius');
assert.ok(Math.abs(b.data.diameter - 10) < 1e-6, 'Concentric must preserve second radius');

const serialized = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(serialized);
solved = solver.solve(reopened, sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.deepEqual(reopened.kind === 'part' ? reopened.constraints[0] : null, part().constraints[0], 'Save/Open must preserve Concentric ID and refs');

const beforeDuplicate = serializeCadDocument(app.getDocument());
const duplicate = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: circleA, bEntityId: circleB } });
assert.equal(duplicate.ok, false);
assert.match(duplicate.error?.message ?? '', /already exists/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const same = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: circleA, bEntityId: circleA } });
assert.equal(same.ok, false);
assert.match(same.error?.message ?? '', /two distinct Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeDuplicate);

const lineId = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [4, 2] } })).createdIds?.[0] as CadSketchEntityId;
const beforeLine = serializeCadDocument(app.getDocument());
const lineCircle = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: lineId, bEntityId: circleA } });
assert.equal(lineCircle.ok, false);
assert.match(lineCircle.error?.message ?? '', /two Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeLine);

const arcId = (await app.execute({ id: 'sketch.arc', payload: { sketchId, center: [20, 5], start: [24, 5], end: [20, 9] } })).createdIds?.[0] as CadSketchEntityId;
const beforeArc = serializeCadDocument(app.getDocument());
const circleArc = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: circleA, bEntityId: arcId } });
assert.equal(circleArc.ok, false);
assert.match(circleArc.error?.message ?? '', /two Circle/);
assert.equal(serializeCadDocument(app.getDocument()), beforeArc, 'Circle↔Arc is explicitly out of scope for first Concentric slice');

const otherSketch = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other sketch' } })).createdIds?.[0] as CadSketchId;
const crossCircle = (await app.execute({ id: 'sketch.circle', payload: { sketchId: otherSketch, center: [1, 1], diameter: 6 } })).createdIds?.[0] as CadSketchEntityId;
const beforeCross = serializeCadDocument(app.getDocument());
const cross = await app.execute({ id: 'constraint.concentric', payload: { sketchId, aEntityId: circleA, bEntityId: crossCircle } });
assert.equal(cross.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCross, 'cross-Sketch Concentric must roll back');

const history = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const hs = (await history.execute({ id: 'sketch.create', payload: { support: 'XY' } })).createdIds?.[0] as CadSketchId;
const ha = (await history.execute({ id: 'sketch.circle', payload: { sketchId: hs, center: [0, 0], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
const hb = (await history.execute({ id: 'sketch.circle', payload: { sketchId: hs, center: [7, 3], diameter: 8 } })).createdIds?.[0] as CadSketchEntityId;
const historyCreate = await history.execute({ id: 'constraint.concentric', payload: { sketchId: hs, aEntityId: ha, bEntityId: hb } });
const historyId = historyCreate.createdIds?.[0];
assert.ok(historyId);
assert.equal((await history.undo()).ok, true);
assert.equal((history.getDocument() as CadPartDocument).constraints.length, 0);
assert.equal((await history.redo()).ok, true);
assert.equal((history.getDocument() as CadPartDocument).constraints[0].id, historyId, 'Redo must restore same Concentric ID');

const handler = fs.readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const owner = fs.readFileSync('src/application/commands/SketchConcentricConstraintOwner.ts', 'utf8');
const router = fs.readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const runtime = fs.readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const controllers = fs.readFileSync('src/web/useSketchConstraintControllers.ts', 'utf8');
const layer = fs.readFileSync('src/web/viewport/SketchConcentricInteractionLayer.tsx', 'utf8');
const bridge = fs.readFileSync('src/web/CoincidentPartModelStage.tsx', 'utf8');
const appSource = fs.readFileSync('src/web/App.tsx', 'utf8');
const mobile = fs.readFileSync('src/web/MobileToolsPanel.tsx', 'utf8');
const commandGroups = fs.readFileSync('src/web/CadShellCommandGroups.tsx', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
assert.match(handler, /'constraint\.concentric'/);
assert.match(handler, /addCirclePairConcentricConstraint/);
assert.match(owner, /exactly two Circle entities/);
assert.match(owner, /constraint\.type === 'concentric'/);
assert.doesNotMatch(`${handler}\n${owner}`, /PlaneGCS|OpenCascade|vendor\//, 'application Concentric owner must remain runtime-neutral');
assert.match(router, /case 'constraint\.concentric'/);
assert.match(runtime, /case 'concentric':/);
assert.match(runtime, /'CONCENTRIC'/);

assert.match(controllers, /setActiveCommand\('constraint\.concentric'\)/);
assert.match(controllers, /id: 'constraint\.concentric'/);
assert.match(layer, /tool=\"constraint\.concentric\"/);
assert.match(layer, /nearestCircle/);
assert.doesNotMatch(layer, /CadApplication|app\.execute|OpenCascade|PlaneGCS/);
assert.match(bridge, /useSketchConcentricCommit/);
assert.match(appSource, /concentricConstraint: workspace\.beginConcentricConstraint/);
assert.match(appSource, /concentricCommit=\{workspace\.applyConcentricConstraint\}/);
assert.match(mobile, /id: 'constraint\.concentric'/);
assert.match(commandGroups, /getAction\('constraint\.concentric'\)/);
const command = registry.commands.find((item: { id: string }) => item.id === 'constraint.concentric');
assert.equal(command?.status, 'implemented');
assert.equal(command?.backendCommand, 'constraint.concentric');

history.dispose(); solver.dispose(); app.dispose();
console.log('ASA-CAD Concentric PASS (Circle↔Circle scope + validation + PlaneGCS + persistence/history)');
