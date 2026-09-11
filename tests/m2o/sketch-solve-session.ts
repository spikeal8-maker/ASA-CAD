import assert from 'node:assert/strict';
import {
  SketchSolveSession,
  createCadId,
  createEmptyCadDocument,
  serializeCadDocument,
  type CadDocument,
  type CadSketchEntity,
  type CadSketchId,
  type CadSketchSolveResult,
  type CadSketchSolverAdapter,
} from '../../src';

class FakeSolver implements CadSketchSolverAdapter {
  initCount = 0;
  solveCount = 0;
  disposed = false;
  degreesOfFreedom: number | null = 2;

  async init(): Promise<void> {
    this.initCount += 1;
  }

  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
    this.solveCount += 1;
    if (document.kind !== 'part') throw new Error('expected Part');
    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) throw new Error('missing Sketch');
    const entities: CadSketchEntity[] = sketch.entities.map((entity) => {
      if (entity.type !== 'line') return structuredClone(entity);
      return {
        ...structuredClone(entity),
        data: { ...entity.data, to: [40, 0] },
      };
    });
    return {
      ok: true,
      converged: true,
      residual: 0,
      iterations: 4,
      degreesOfFreedom: this.degreesOfFreedom,
      entities,
      diagnostics: [],
    };
  }

  dispose(): void {
    this.disposed = true;
  }
}

class DeferredInitSolver extends FakeSolver {
  private releaseInit!: () => void;
  private readonly gate = new Promise<void>((resolve) => { this.releaseInit = resolve; });

  override async init(): Promise<void> {
    this.initCount += 1;
    await this.gate;
  }

  release(): void {
    this.releaseInit();
  }
}

const part = createEmptyCadDocument('part', { title: 'Solve cycle' });
const sketchId = createCadId<CadSketchId>('sketch');
part.sketches.push({
  id: sketchId,
  name: 'Sketch A',
  support: 'XY',
  entities: [{
    id: createCadId('entity'),
    type: 'line',
    data: { from: [0, 0], to: [30, 5] },
  }],
  constraintIds: [],
  dimensionIds: [],
});

const before = serializeCadDocument(part);
const solver = new FakeSolver();
const session = new SketchSolveSession(solver);
let notifications = 0;
const unsubscribe = session.subscribe(() => { notifications += 1; });

const solved = await session.solve(part, sketchId);
assert.equal(solved.status, 'solved');
assert.equal(solved.sketchId, sketchId);
assert.equal(solved.degreesOfFreedom, 2);
assert.equal(solved.constraintState, 'under-constrained');
assert.equal(solved.previewEntities[0]?.type, 'line');
if (solved.previewEntities[0]?.type !== 'line') throw new Error('expected solved line preview');
assert.deepEqual(solved.previewEntities[0].data.to, [40, 0]);
assert.equal(serializeCadDocument(part), before, 'solve preview must not mutate persisted CadDocument');
assert.equal(solver.initCount, 1);
assert.equal(solver.solveCount, 1);
assert.ok(notifications >= 2, 'session must publish solving + solved transitions');

solver.degreesOfFreedom = 0;
const fully = await session.solve(part, sketchId);
assert.equal(fully.constraintState, 'fully-constrained');
assert.equal(solver.initCount, 1, 'solver initialization must be reused across solve requests');

session.clear();
assert.equal(session.getSnapshot().status, 'idle');
assert.equal(session.getSnapshot().previewEntities.length, 0);
unsubscribe();
session.dispose();
assert.equal(solver.disposed, true);

const deferred = new DeferredInitSolver();
const staleSession = new SketchSolveSession(deferred);
const stalePromise = staleSession.solve(part, sketchId);
assert.equal(staleSession.getSnapshot().status, 'solving');
staleSession.clear();
deferred.release();
await stalePromise;
assert.equal(staleSession.getSnapshot().status, 'idle', 'late solver result must not overwrite a cleared/newer request');
assert.equal(deferred.solveCount, 0, 'stale request should be abandoned after async init');
staleSession.dispose();

console.log('M2O Sketch solve cycle PASS (transient preview + DoF state + stale-result protection + document immutability)');
