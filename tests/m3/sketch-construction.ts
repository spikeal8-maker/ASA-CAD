import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CadApplicationImpl, PlaneGCSSketchSolverRuntime, createEmptyCadDocument,
  parseCadDocument, serializeCadDocument,
  type CadPartDocument, type CadRuntimeAdapter, type CadRuntimeRecomputeResult,
  type CadSketchEntityId, type CadSketchId,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> { return { ok: true, diagnostics: [], runtimeRevision: 'construction-test' }; }
  async captureReference(): Promise<never> { throw new Error('unused'); }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Construction test' }), new NoopRuntime());
const part = () => app.getDocument() as Readonly<CadPartDocument>;
const sketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Construction' } })).createdIds?.[0] as CadSketchId;
const lineId = (await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 1], to: [5, 3] } })).createdIds?.[0] as CadSketchEntityId;
const circleId = (await app.execute({ id: 'sketch.circle', payload: { sketchId, center: [9, 0], diameter: 4 } })).createdIds?.[0] as CadSketchEntityId;
assert.ok(sketchId && lineId && circleId);

const enabled = await app.execute({ id: 'sketch.construction', payload: { sketchId, entityId: lineId } });
assert.equal(enabled.ok, true, enabled.error?.message);
let line = part().sketches[0].entities.find((entity) => entity.id === lineId);
assert.equal(line?.type, 'line');
if (!line || line.type !== 'line') throw new Error('Expected Line');
assert.equal(line.data.construction, true);
const horizontal = await app.execute({ id: 'constraint.horizontal', payload: { sketchId, entityId: lineId } });
assert.equal(horizontal.ok, true, horizontal.error?.message);
const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
const solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedLine = solved.entities.find((entity) => entity.id === lineId);
assert.ok(solvedLine && solvedLine.type === 'line');
if (!solvedLine || solvedLine.type !== 'line') throw new Error('Expected solved Line');
assert.equal(solvedLine.data.construction, true, 'solver preview must preserve construction metadata');
assert.ok(Math.abs(solvedLine.data.from[1] - solvedLine.data.to[1]) < 1e-5, 'construction Line must remain solver geometry');

const saved = serializeCadDocument(app.getDocument());
const reopened = parseCadDocument(saved) as CadPartDocument;
const reopenedLine = reopened.sketches[0].entities.find((entity) => entity.id === lineId);
assert.ok(reopenedLine && reopenedLine.type === 'line');
if (!reopenedLine || reopenedLine.type !== 'line') throw new Error('Expected reopened Line');
assert.equal(reopenedLine.data.construction, true);

const beforeInvalid = serializeCadDocument(app.getDocument());
const invalid = await app.execute({ id: 'sketch.construction', payload: { sketchId, entityId: circleId } });
assert.equal(invalid.ok, false);
assert.match(invalid.error?.message ?? '', /requires a Line/);
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid, 'invalid type must roll back');
const otherSketchId = (await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Other' } })).createdIds?.[0] as CadSketchId;
const otherLineId = (await app.execute({ id: 'sketch.line', payload: { sketchId: otherSketchId, from: [0, 0], to: [2, 0] } })).createdIds?.[0] as CadSketchEntityId;
const beforeCross = serializeCadDocument(app.getDocument());
const cross = await app.execute({ id: 'sketch.construction', payload: { sketchId, entityId: otherLineId } });
assert.equal(cross.ok, false);
assert.equal(serializeCadDocument(app.getDocument()), beforeCross, 'cross-Sketch toggle must roll back');

const historyApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const historySketch = (await historyApp.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'History' } })).createdIds?.[0] as CadSketchId;
const historyLine = (await historyApp.execute({ id: 'sketch.line', payload: { sketchId: historySketch, from: [0, 0], to: [4, 0] } })).createdIds?.[0] as CadSketchEntityId;
assert.equal((await historyApp.execute({ id: 'sketch.construction', payload: { sketchId: historySketch, entityId: historyLine } })).ok, true);
assert.equal(((historyApp.getDocument() as CadPartDocument).sketches[0].entities[0] as any).data.construction, true);
assert.equal((await historyApp.undo()).ok, true);
assert.equal(((historyApp.getDocument() as CadPartDocument).sketches[0].entities[0] as any).data.construction, undefined);
assert.equal((await historyApp.redo()).ok, true);
assert.equal(((historyApp.getDocument() as CadPartDocument).sketches[0].entities[0] as any).data.construction, true);

const runtimeSource = readFileSync('src/runtime/OpenCascadePartRuntime.ts', 'utf8');
const overlaySource = readFileSync('src/web/viewport/SketchOverlayLayer.tsx', 'utf8');
assert.match(runtimeSource, /!entity\.data\.construction[\s\S]*rectangle-edge-/, 'Part rectangle profile must exclude construction Lines');
assert.match(overlaySource, /data-sketch-construction/);
assert.match(overlaySource, /construction/);

historyApp.dispose(); solver.dispose(); app.dispose();
console.log('ASA-CAD Construction PASS (Line toggle + solver + profile exclusion + persistence/history)');
