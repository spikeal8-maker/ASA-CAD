import assert from 'node:assert/strict';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { SketchSolveSession } from '../../src/application/SketchSolveSession';
import {
  translateSketchEntity,
  translateSketchEntitiesCandidate,
} from '../../src/application/SketchEntityTransform';
import { createEmptyCadDocument, type CadPartDocument, type CadSketchEntity } from '../../src/contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import type { CadRuntimeAdapter } from '../../src/contracts/runtime';
import type { CadSketchSolverAdapter, CadSketchSolveResult } from '../../src/contracts/sketchSolver';

class NoopRuntime implements CadRuntimeAdapter {
  async recompute() {
    return { ok: true as const, diagnostics: [], runtimeRevision: 'translate-test' };
  }
  async captureReference() {
    throw new Error('captureReference not used');
  }
  dispose() {}
}

class RecordingSolver implements CadSketchSolverAdapter {
  initialized = false;
  lastEntities: CadSketchEntity[] = [];
  initCount = 0;

  async init() {
    this.initialized = true;
    this.initCount += 1;
  }

  solve(document: Readonly<ReturnType<typeof createEmptyCadDocument>>, sketchId: CadSketchId): CadSketchSolveResult {
    assert.equal(document.kind, 'part');
    if (document.kind !== 'part') throw new Error('Expected Part');
    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) throw new Error('Missing candidate Sketch');
    this.lastEntities = structuredClone(sketch.entities);
    return {
      ok: true,
      converged: true,
      residual: 0,
      iterations: 1,
      degreesOfFreedom: null,
      entities: structuredClone(sketch.entities),
      diagnostics: [],
    };
  }

  dispose() {}
}

function part(app: CadApplicationImpl): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

const line: CadSketchEntity = {
  id: 'entity_line' as CadSketchEntityId,
  type: 'line',
  data: { from: [1, 2], to: [4, 6], role: 'rectangle-edge-0' },
};
const movedLine = translateSketchEntity(line, [3, -2]);
assert.deepEqual(movedLine, {
  id: line.id,
  type: 'line',
  data: { from: [4, 0], to: [7, 4], role: 'rectangle-edge-0' },
});
assert.notEqual(movedLine, line, 'translation must return transient/new DTO data');
assert.deepEqual(line.data, { from: [1, 2], to: [4, 6], role: 'rectangle-edge-0' }, 'source DTO must remain untouched');

const circle: CadSketchEntity = {
  id: 'entity_circle' as CadSketchEntityId,
  type: 'circle',
  data: { center: [2, 3], diameter: 12 },
};
assert.deepEqual(translateSketchEntity(circle, [-2, 5]), {
  ...circle,
  data: { center: [0, 8], diameter: 12 },
});

const arc: CadSketchEntity = {
  id: 'entity_arc' as CadSketchEntityId,
  type: 'arc',
  data: { center: [0, 0], radius: 8, startAngle: 0.2, endAngle: 1.7 },
};
assert.deepEqual(translateSketchEntity(arc, [4, -3]), {
  ...arc,
  data: { center: [4, -3], radius: 8, startAngle: 0.2, endAngle: 1.7 },
});

const app = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopRuntime());
const created = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
const sketchId = created.createdIds?.[0] as CadSketchId;
const lineResult = await app.execute({ id: 'sketch.line', payload: { sketchId, from: [0, 0], to: [10, 0] } });
const lineId = lineResult.createdIds?.[0] as CadSketchEntityId;

const translate = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId: lineId, delta: [5, -4] },
});
assert.equal(translate.ok, true);
assert.equal(translate.changed, true);
let persistedLine = part(app).sketches[0].entities.find((item) => item.id === lineId);
assert.ok(persistedLine?.type === 'line');
if (persistedLine?.type !== 'line') throw new Error('Expected line');
assert.deepEqual(persistedLine.data.from, [5, -4]);
assert.deepEqual(persistedLine.data.to, [15, -4]);
assert.equal(persistedLine.id, lineId, 'rigid translation must preserve stable entity ID');

await app.undo();
persistedLine = part(app).sketches[0].entities.find((item) => item.id === lineId);
assert.ok(persistedLine?.type === 'line');
if (persistedLine?.type !== 'line') throw new Error('Expected line after undo');
assert.deepEqual(persistedLine.data.from, [0, 0]);
assert.deepEqual(persistedLine.data.to, [10, 0]);
await app.redo();
persistedLine = part(app).sketches[0].entities.find((item) => item.id === lineId);
assert.ok(persistedLine?.type === 'line');
if (persistedLine?.type !== 'line') throw new Error('Expected line after redo');
assert.deepEqual(persistedLine.data.from, [5, -4]);

const fixed = await app.execute({ id: 'constraint.fixed', payload: { sketchId, entityId: lineId } });
assert.equal(fixed.ok, true);
const beforeFixedAttempt = structuredClone(app.getDocument());
const blocked = await app.execute({
  id: 'sketch.entity.translate',
  payload: { sketchId, entityId: lineId, delta: [1, 1] },
});
assert.equal(blocked.ok, false, 'Fixed entity translation must be rejected');
assert.match(blocked.error?.message ?? '', /Fixed sketch entity/i);
assert.deepEqual(app.getDocument(), beforeFixedAttempt, 'rejected Fixed translation must roll back atomically');

const solverDocument = createEmptyCadDocument('part');
assert.equal(solverDocument.kind, 'part');
if (solverDocument.kind !== 'part') throw new Error('Expected Part candidate doc');
const candidateSketch = structuredClone(part(app).sketches[0]);
solverDocument.sketches.push(candidateSketch);
solverDocument.constraints = [];
solverDocument.dimensions = [];
candidateSketch.constraintIds = [];
candidateSketch.dimensionIds = [];
const originalEntities = structuredClone(candidateSketch.entities);
const candidateEntities = translateSketchEntitiesCandidate(candidateSketch.entities, lineId, [7, 2]);

const solver = new RecordingSolver();
const session = new SketchSolveSession(solver);
const snapshot = await session.solveCandidate(solverDocument, candidateSketch.id, candidateEntities);
assert.equal(snapshot.status, 'solved');
assert.equal(solver.initialized, true);
assert.equal(solver.initCount, 1);
const solvedLine = snapshot.previewEntities.find((item) => item.id === lineId);
assert.ok(solvedLine?.type === 'line');
if (solvedLine?.type !== 'line') throw new Error('Expected solved candidate line');
assert.deepEqual(solvedLine.data.from, [12, -2]);
assert.deepEqual(candidateSketch.entities, originalEntities, 'solveCandidate must not mutate persisted/source document geometry');
session.dispose();
app.dispose();

console.log('ASA-CAD M3.6B rigid entity translation PASS (stable ID + atomic history + Fixed guard + transient candidate solve)');
