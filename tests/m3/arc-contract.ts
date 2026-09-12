import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopGeometryRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [] };
  }

  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('not used by Arc contract test');
  }

  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'M3.4 Arc contract' }), new NoopGeometryRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Arc contract' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

const arcResult = await app.execute({
  id: 'sketch.arc',
  payload: {
    sketchId,
    center: [0, 0],
    start: [10, 0],
    end: [0, 10],
  },
});
assert.equal(arcResult.ok, true, arcResult.error?.message);
const arcId = arcResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(arcId);

const part = app.getDocument();
assert.equal(part.kind, 'part');
if (part.kind !== 'part') throw new Error('expected Part');
const arc = part.sketches[0]?.entities.find((entity) => entity.id === arcId);
assert.ok(arc);
assert.equal(arc.type, 'arc');
if (arc.type !== 'arc') throw new Error('expected Arc entity');
assert.deepEqual(arc.data.center, [0, 0]);
assert.ok(Math.abs(arc.data.radius - 10) < 1e-9);
assert.ok(Math.abs(arc.data.startAngle - 0) < 1e-9);
assert.ok(Math.abs(arc.data.endAngle - Math.PI / 2) < 1e-9);

const serialized = serializeCadDocument(part);
const reopened = parseCadDocument(serialized);
assert.deepEqual(reopened, part, 'Arc must round-trip through schema-v1 without alternate representation');
assert.equal(reopened.schemaVersion, 1);

function mutateAndReject(mutator: (value: any) => void, pattern: RegExp): void {
  const value = JSON.parse(serialized);
  mutator(value);
  assert.throws(() => parseCadDocument(JSON.stringify(value)), pattern);
}

mutateAndReject(
  (value) => { value.sketches[0].entities[0].data.radius = 0; },
  /radius must be positive/,
);
mutateAndReject(
  (value) => { value.sketches[0].entities[0].data.endAngle = value.sketches[0].entities[0].data.startAngle; },
  /sweep must be greater than 0 and less than 2π/,
);

const beforeInvalid = serializeCadDocument(app.getDocument());
const invalid = await app.execute({
  id: 'sketch.arc',
  payload: {
    sketchId,
    center: [0, 0],
    start: [5, 0],
    end: [10, 0],
  },
});
assert.equal(invalid.ok, false, 'zero-sweep Arc command must be rejected');
assert.equal(serializeCadDocument(app.getDocument()), beforeInvalid, 'failed Arc command must roll back atomically');

const fixed = await app.execute({
  id: 'constraint.fixed',
  payload: { sketchId, entityId: arcId },
});
assert.equal(fixed.ok, true, fixed.error?.message);

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();
const solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
const solvedArc = solved.entities.find((entity) => entity.id === arcId);
assert.ok(solvedArc);
assert.equal(solvedArc.type, 'arc');
if (solvedArc.type !== 'arc') throw new Error('expected solved Arc');
assert.ok(Math.abs(solvedArc.data.radius - 10) < 1e-5);
assert.ok(Math.abs(solvedArc.data.startAngle - 0) < 1e-5);
assert.ok(Math.abs(solvedArc.data.endAngle - Math.PI / 2) < 1e-5);

solver.dispose();
app.dispose();
console.log('ASA-CAD M3.4A Arc contract PASS (schema-v1 + typed command + atomic rollback + PlaneGCS readback)');
