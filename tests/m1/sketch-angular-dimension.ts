import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  createEmptyCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadDimensionId,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopGeometryRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [] };
  }
  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('not used');
  }
  dispose(): void {}
}

const app = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopGeometryRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Angular solver' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

async function line(from: readonly [number, number], to: readonly [number, number]) {
  const result = await app.execute({ id: 'sketch.line', payload: { sketchId, from, to } });
  assert.equal(result.ok, true);
  const id = result.createdIds?.[0] as CadSketchEntityId;
  assert.ok(id);
  return id;
}

const lineAId = await line([0, 0], [20, 0]);
const lineBId = await line([0, 0], [10, 10]);
assert.equal((await app.execute({
  id: 'constraint.horizontal',
  payload: { sketchId, entityId: lineAId },
})).ok, true);

const angularResult = await app.execute({
  id: 'dimension.angular',
  payload: { sketchId, aEntityId: lineAId, bEntityId: lineBId, value: 60, name: 'angle' },
});
assert.equal(angularResult.ok, true);
const angularId = angularResult.createdIds?.[0] as CadDimensionId;
assert.ok(angularId);

const circleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [40, 10], diameter: 8 },
});
const circleId = circleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleId);
const arcResult = await app.execute({
  id: 'sketch.arc',
  payload: { sketchId, center: [60, 10], start: [70, 10], end: [60, 20] },
});
const arcId = arcResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(arcId);

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();

function angleDegrees(entities: ReturnType<typeof solver.solve>['entities']): number {
  const a = entities.find((entity) => entity.id === lineAId);
  const b = entities.find((entity) => entity.id === lineBId);
  assert.ok(a && a.type === 'line');
  assert.ok(b && b.type === 'line');
  if (!a || a.type !== 'line' || !b || b.type !== 'line') throw new Error('Expected solved Angular lines');
  const ax = a.data.to[0] - a.data.from[0];
  const ay = a.data.to[1] - a.data.from[1];
  const bx = b.data.to[0] - b.data.from[0];
  const by = b.data.to[1] - b.data.from[1];
  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}

let solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.ok(Math.abs(angleDegrees(solved.entities) - 60) < 1e-4, 'Angular Dimension must solve to 60 degrees');

const beforeEditDocument = app.getDocument();
if (beforeEditDocument.kind !== 'part') throw new Error('Expected Part document');
const beforeEditId = beforeEditDocument.dimensions.find((dimension) => dimension.id === angularId)?.id;
const edit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: angularId, value: 45 },
});
assert.equal(edit.ok, true);
solved = solver.solve(app.getDocument(), sketchId);
assert.equal(solved.ok, true, solved.diagnostics.map((item) => item.message).join('; '));
assert.ok(Math.abs(angleDegrees(solved.entities) - 45) < 1e-4, 'Angular setValue must re-solve to 45 degrees');
const afterEditDocument = app.getDocument();
if (afterEditDocument.kind !== 'part') throw new Error('Expected Part document');
const edited = afterEditDocument.dimensions.find((dimension) => dimension.id === angularId);
assert.ok(edited && edited.type === 'angular');
assert.equal(edited.id, beforeEditId);
assert.equal(edited.value, 45);

function malformed(
  aEntityId: CadSketchEntityId,
  bEntityId: CadSketchEntityId,
  label: string,
  pattern: RegExp,
) {
  const document = structuredClone(app.getDocument());
  if (document.kind !== 'part') throw new Error('Expected Part document');
  const id = `dimension_angular_${label}` as CadDimensionId;
  document.dimensions.push({
    id,
    type: 'angular',
    entityIds: [aEntityId, bEntityId],
    value: 60,
    driving: true,
  });
  const sketch = document.sketches.find((item) => item.id === sketchId);
  assert.ok(sketch);
  sketch.dimensionIds.push(id);
  const result = solver.solve(document, sketchId);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0]?.message ?? '', pattern);
}

malformed(lineAId, lineAId, 'same', /two distinct Line entities/);
malformed(lineAId, circleId, 'circle', /requires two Line entities/);
malformed(lineAId, arcId, 'arc', /requires two Line entities/);
malformed(lineAId, 'entity_missing' as CadSketchEntityId, 'missing', /references unknown entity entity_missing/);

solver.dispose();
app.dispose();
console.log('ASA-CAD M1 Angular Dimension PASS (degrees 60->45 + same ID + fail-closed solver targets)');
