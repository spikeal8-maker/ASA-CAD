import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import {
  CadApplicationImpl,
  OpenCascadePartRuntime,
  PlaneGCSSketchSolverRuntime,
  SolvedSketchPartRuntimeAdapter,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadDimensionId,
  type CadPartDocument,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';
import { buildClosedLinearProfile } from '../../src/application/SketchLinearProfile';

const EPS = 1e-4;
const oc = await initOpenCascade();

function near(actual: number, expected: number, label: string, tolerance = EPS) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}
function solidContains(core: OpenCascadePartRuntime, point: readonly [number, number, number]): boolean {
  const shape = (core as unknown as { finalShape: any | null }).finalShape;
  assert.ok(shape, 'runtime finalShape missing');
  const p = new oc.gp_Pnt_3(point[0], point[1], point[2]);
  const classifier = new oc.BRepClass3d_SolidClassifier_3(shape, p, 1e-7);
  const state = classifier.State();
  const inside = state === oc.TopAbs_State.TopAbs_IN || state === oc.TopAbs_State.TopAbs_ON;
  classifier.delete?.();
  p.delete?.();
  return inside;
}
function part(app: CadApplicationImpl): Readonly<CadPartDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'part');
  if (document.kind !== 'part') throw new Error('Expected Part document');
  return document;
}
function harness(title: string, document = createEmptyCadDocument('part', { title })) {
  const core = new OpenCascadePartRuntime(oc);
  const solver = new PlaneGCSSketchSolverRuntime();
  const runtime = new SolvedSketchPartRuntimeAdapter(core, solver);
  const app = new CadApplicationImpl(document, runtime);
  return { app, core, solver };
}
async function createSketch(app: CadApplicationImpl, support: 'XY' | 'XZ' = 'XY') {
  const result = await app.execute({ id: 'sketch.create', payload: { support } });
  assert.equal(result.ok, true);
  const id = result.createdIds?.[0] as CadSketchId;
  assert.ok(id);
  return id;
}
async function line(app: CadApplicationImpl, sketchId: CadSketchId, from: [number,number], to: [number,number]) {
  const result = await app.execute({ id: 'sketch.line', payload: { sketchId, from, to } });
  assert.equal(result.ok, true);
  const id = result.createdIds?.[0] as CadSketchEntityId;
  assert.ok(id);
  return id;
}
async function closeLinearLoop(app: CadApplicationImpl, sketchId: CadSketchId, ids: CadSketchEntityId[]) {
  for (let index = 0; index < ids.length; index += 1) {
    const next = ids[(index + 1) % ids.length];
    const orientation = index % 2 === 0 ? 'constraint.horizontal' : 'constraint.vertical';
    assert.equal((await app.execute({ id: orientation, payload: { sketchId, entityId: ids[index] } })).ok, true);
    assert.equal((await app.execute({
      id: 'constraint.coincident',
      payload: { sketchId, a: { entityId: ids[index], point: 'b' }, b: { entityId: next, point: 'a' } },
    })).ok, true);
  }
}
async function extrude10(app: CadApplicationImpl, sketchId: CadSketchId) {
  const feature = await app.execute({ id: 'feature.extrude', payload: { sketchId, distance: 10 } });
  assert.equal(feature.ok, true);
  return app.execute({ id: 'document.rebuild', payload: {} });
}

{
  const { app,core,solver } = harness('parametric rectangle');
  const sketchId = await createSketch(app);
  const rectangle = await app.execute({
    id: 'sketch.rectangle',
    payload: { sketchId, origin: [-30,-20], width: 60, height: 40 },
  });
  assert.equal(rectangle.ok, true);
  const edges = rectangle.createdIds as CadSketchEntityId[];
  assert.equal(edges.length, 4);
  assert.equal(part(app).constraints.length, 8, 'Rectangle tool must create four orientation + four corner relations');
  const width = await app.execute({
    id: 'dimension.horizontal',
    payload: { sketchId, entityId: edges[0], value: 60, name: 'width' },
  });
  const widthId = width.createdIds?.[0] as CadDimensionId;
  assert.ok(widthId);
  const height = await app.execute({
    id: 'dimension.vertical',
    payload: { sketchId, entityId: edges[1], value: 40, name: 'height' },
  });
  const heightId = height.createdIds?.[0] as CadDimensionId;
  assert.ok(heightId);
  assert.equal((await extrude10(app, sketchId)).ok, true);
  let analysis = core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume, 24_000, '60x40x10 volume');
  near(analysis.bounds.maxX-analysis.bounds.minX,60,'60x40 width');
  near(analysis.bounds.maxY-analysis.bounds.minY,40,'60x40 height');

  assert.equal((await app.execute({
    id: 'part.dimension.setValue', payload: { dimensionId: widthId, value: 80 },
  })).ok, true);
  assert.equal((await app.execute({ id: 'document.rebuild', payload: {} })).ok, true);
  analysis = core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume, 32_000, '80x40x10 volume');
  const solved80 = solver.solve(app.getDocument(), sketchId);
  assert.equal(solved80.ok, true);
  const horizontal = solved80.entities.filter((entity) => entity.type === 'line')
    .filter((entity) => Math.abs(entity.data.to[1]-entity.data.from[1]) <= EPS)
    .map((entity) => Math.abs(entity.data.to[0]-entity.data.from[0]));
  assert.deepEqual(horizontal.length,2);
  horizontal.forEach((value) => near(value,80,'linked horizontal edge'));

  assert.equal((await app.execute({
    id: 'part.dimension.setValue', payload: { dimensionId: heightId, value: 55 },
  })).ok, true);
  assert.equal((await app.execute({ id: 'document.rebuild', payload: {} })).ok, true);
  analysis = core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume, 44_000, '80x55x10 volume');
  assert.equal((await app.undo()).ok, true);
  analysis = core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume, 32_000, 'Undo volume');
  assert.equal((await app.redo()).ok, true);
  analysis = core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume, 44_000, 'Redo volume');

  const serialized = serializeCadDocument(app.getDocument());
  const beforeIds = part(app).sketches[0].dimensionIds.slice();
  app.dispose();
  const parsed = parseCadDocument(serialized);
  assert.equal(parsed.kind, 'part');
  if (parsed.kind !== 'part') throw new Error('Reopened document must remain Part');
  const reopened = harness('reopened rectangle', parsed);
  assert.equal((await reopened.app.execute({ id: 'document.rebuild', payload: {} })).ok, true);
  const reopenedAnalysis = reopened.core.getLastAnalysis(); assert.ok(reopenedAnalysis);
  near(reopenedAnalysis.volume,44_000,'reopened volume');
  assert.deepEqual(part(reopened.app).sketches[0].dimensionIds,beforeIds);
  reopened.app.dispose();
}

{
  const { app,core } = harness('independent lines rectangle');
  const sketchId = await createSketch(app);
  const ids = [
    await line(app,sketchId,[0,0],[60,0]),
    await line(app,sketchId,[60,0],[60,40]),
    await line(app,sketchId,[60,40],[0,40]),
    await line(app,sketchId,[0,40],[0,0]),
  ];
  await closeLinearLoop(app,sketchId,ids);
  assert.ok(part(app).sketches[0].entities.every((entity) => entity.type !== 'line' || !entity.data.role));
  assert.equal((await extrude10(app,sketchId)).ok,true);
  const analysis=core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume,24_000,'independent-lines rectangle volume');
  app.dispose();
}
{
  const { app,core,solver } = harness('concave L');
  const sketchId=await createSketch(app);
  const points: [number,number][]= [[0,0],[60,0],[60,20],[20,20],[20,40],[0,40],[0,0]];
  const ids: CadSketchEntityId[]=[];
  for(let i=0;i<points.length-1;i+=1) ids.push(await line(app,sketchId,points[i],points[i+1]));
  await closeLinearLoop(app,sketchId,ids);
  assert.equal((await extrude10(app,sketchId)).ok,true);
  const analysis=core.getLastAnalysis(); assert.ok(analysis);
  near(analysis.volume,16_000,'L-shape volume');
  near(analysis.bounds.maxX-analysis.bounds.minX,60,'L-shape bbox width');
  near(analysis.bounds.maxY-analysis.bounds.minY,40,'L-shape bbox height');
  assert.equal(solidContains(core,[10,30,5]),true,'L-shape left arm must be solid');
  assert.equal(solidContains(core,[40,10,5]),true,'L-shape bottom arm must be solid');
  assert.equal(solidContains(core,[40,30,5]),false,'L-shape notch must remain empty');
  const solved=solver.solve(app.getDocument(),sketchId);
  assert.equal(solved.ok,true);
  const sketch=part(app).sketches.find((item)=>item.id===sketchId); assert.ok(sketch);
  const profile=buildClosedLinearProfile({ ...sketch, entities: solved.entities });
  near(profile.area,1600,'L-shape solved profile area');
  assert.equal(profile.points.length,6,'L-shape boundary must keep six corners');
  app.dispose();
}

for (const invalid of [
  { name:'open', points:[[0,0],[40,0],[40,20],[0,20]] as [number,number][] },
  { name:'self-intersection', points:[[0,0],[40,40],[0,40],[40,0],[0,0]] as [number,number][] },
]) {
  const { app,core }=harness(invalid.name);
  const sketchId=await createSketch(app);
  for(let i=0;i<invalid.points.length-1;i+=1) await line(app,sketchId,invalid.points[i],invalid.points[i+1]);
  const rebuild=await extrude10(app,sketchId);
  assert.equal(rebuild.ok,false,`${invalid.name} profile must fail`);
  assert.equal(core.getLastAnalysis(),null,`${invalid.name} profile must not retain a B-Rep`);
  app.dispose();
}

{
  const { app,core }=harness('unsupported plane');
  const sketchId=await createSketch(app,'XZ');
  const rectangle=await app.execute({
    id:'sketch.rectangle',payload:{sketchId,origin:[0,0],width:60,height:40},
  });
  assert.equal(rectangle.ok,true);
  const rebuild=await extrude10(app,sketchId);
  assert.equal(rebuild.ok,false);
  assert.match(rebuild.error?.message ?? '',/does not yet evaluate XZ|XY-parallel/i);
  assert.equal(core.getLastAnalysis(),null);
  app.dispose();
}

console.log('PART-CORE-RECOVERY kernel regression PASS');
