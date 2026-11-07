import assert from 'node:assert/strict';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import type { CadCommand } from '../../src/contracts/commands';
import { createEmptyCadDocument, parseCadDocument, serializeCadDocument, type CadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadFeatureId, CadSketchId, CadStableReferenceId } from '../../src/contracts/ids';
import { OpenCascadePartRuntime } from '../../src/runtime/OpenCascadePartRuntime';
import { resolveFilletReferenceEdge } from '../../src/runtime/OpenCascadeReferenceResolver';
import { PlaneGCSSketchSolverRuntime } from '../../src/runtime/PlaneGCSSketchSolverRuntime';
import { SolvedSketchPartRuntimeAdapter } from '../../src/runtime/SolvedSketchPartRuntimeAdapter';
import { commitParametricRectangle } from '../../src/web/SketchParametricRectangleOwner';
import { captureEdge, captureFace, resolveEdge, type EdgeSig } from '../../vendor/toubkal/src/services/StableRef';

const EPS = 1e-4;
const near = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < EPS, label + ': ' + actual + ' != ' + expected);

function part(app: CadApplicationImpl): Readonly<CadPartDocument> {
  const document = app.getDocument();
  if (document.kind !== 'part') throw new Error('Expected Part');
  return document;
}

export async function runStableTopologyRegression(oc: any): Promise<void> {
  const failures: string[] = [];
  let passed = 0;
  async function check(name: string, test: () => Promise<void>) {
    try { await test(); passed++; console.log('  PASS ' + name); }
    catch (error) {
      failures.push(name + ': ' + (error instanceof Error ? error.message : String(error)));
      console.log('  FAIL ' + name);
    }
  }
  function application(document: CadDocument) {
    const core = new OpenCascadePartRuntime(oc);
    const app = new CadApplicationImpl(document, new SolvedSketchPartRuntimeAdapter(core, new PlaneGCSSketchSolverRuntime()));
    return { app, core };
  }
  // Read native geometry only as a test oracle. Product changes and history go through CadApplication.
  const shape = (core: OpenCascadePartRuntime) => (core as unknown as { finalShape: any }).finalShape;
  async function run(app: CadApplicationImpl, command: CadCommand) {
    const result = await app.execute(command);
    assert.equal(result.ok, true, command.id + ': ' + result.error?.message);
    return result;
  }
  const rebuild = (app: CadApplicationImpl) => run(app, { id: 'document.rebuild', payload: {} });
  function volume(core: OpenCascadePartRuntime, expected: number) {
    const analysis = core.getLastAnalysis();
    assert.ok(analysis, 'expected a real OCC result');
    near(analysis.volume, expected, 'OCC volume');
  }
  async function block(width = 60, height = 40, depth = 10) {
    const h = application(createEmptyCadDocument('part', { title: 'Stable topology regression' }));
    const sketch = await run(h.app, { id: 'sketch.create', payload: { support: 'XY' } });
    const sketchId = sketch.createdIds![0] as CadSketchId;
    const rectangle = await commitParametricRectangle(h.app, sketchId, width, height);
    assert.equal(rectangle.ok, true, rectangle.error);
    const feature = await run(h.app, { id: 'feature.extrude', payload: { sketchId, distance: depth } });
    await rebuild(h.app);
    volume(h.core, width * height * depth);
    const widthId = part(h.app).dimensions.find(dimension => dimension.name === 'width')!.id;
    return { ...h, featureId: feature.createdIds![0] as CadFeatureId, widthId };
  }
  function edgeMap(source: any) {
    const map = new oc.TopTools_IndexedMapOfShape_1();
    const explorer = new oc.TopExp_Explorer_2(source, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    try {
      while (explorer.More()) {
        const current = explorer.Current();
        try { map.Add(current); } finally { current.delete(); }
        explorer.Next();
      }
    } finally { explorer.delete(); }
    return map;
  }
  function edgeCount(core: OpenCascadePartRuntime) {
    const map = edgeMap(shape(core));
    try { return map.Extent() as number; } finally { map.delete(); }
  }
  function edgeSignature(app: CadApplicationImpl, id: CadStableReferenceId): EdgeSig {
    const ref = part(app).stableReferences.find(item => item.id === id);
    assert.ok(ref);
    assert.equal(ref.locator.kind, 'edge');
    return ref.locator as unknown as EdgeSig;
  }
  function expectedFilletVolume(core: OpenCascadePartRuntime, signature: EdgeSig): number {
    const source = shape(core);
    const resolved = resolveEdge(oc, source, signature);
    assert.equal(resolved.rejected, false, resolved.reason);
    const map = edgeMap(source);
    let edge: any;
    try {
      const key = map.FindKey(resolved.index + 1);
      try { edge = oc.TopoDS.Edge_1(key); } finally { key.delete(); }
    } finally { map.delete(); }
    const builder = new oc.BRepFilletAPI_MakeFillet(source, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    try {
      builder.Add_2(1, edge);
      const progress = new oc.Message_ProgressRange_1();
      try { builder.Build(progress); } finally { progress.delete(); }
      assert.equal(builder.IsDone(), true, 'independent OCC fillet oracle must build');
      const result = builder.Shape();
      const properties = new oc.GProp_GProps_1();
      try { oc.BRepGProp.VolumeProperties_1(result, properties, true, false, false); return properties.Mass(); }
      finally { properties.delete(); result.delete(); }
    } finally { builder.delete(); edge.delete(); }
  }
  async function selectedEdge(h: Awaited<ReturnType<typeof block>>, point: [number, number, number]) {
    return h.app.captureReference({ kind: 'edge', sourceFeatureId: h.featureId, point, semanticRole: 'selected-fillet-edge' });
  }
  async function fillet(app: CadApplicationImpl, reference: CadStableReferenceId) {
    await run(app, { id: 'feature.fillet', payload: { references: [reference], radius: 1 } });
    await rebuild(app);
  }

  await check('first edge agrees with the independent OCC oracle', async () => {
    const h = await block();
    try {
      const ref = await selectedEdge(h, [-30, -20, 5]);
      const signature = edgeSignature(h.app, ref);
      const expected = expectedFilletVolume(h.core, signature);
      await fillet(h.app, ref);
      volume(h.core, expected);
    } finally { h.app.dispose(); }
  });
  await check('nonfirst selected edge identity and save/open', async () => {
    const h = await block();
    try {
      const ref = await selectedEdge(h, [30, 0, 0]);
      const signature = edgeSignature(h.app, ref);
      signature.mid.forEach((value, index) => near(value, [30, 0, 0][index], 'captured midpoint'));
      near(signature.length, 40, 'selected edge length');
      const resolved = resolveEdge(oc, shape(h.core), signature);
      assert.ok(resolved.index > 0);
      assert.equal(resolved.rejected, false);
      const live = captureEdge(oc, shape(h.core), resolved.index)!;
      near(live.length, 40, 'resolved edge length');
      const expected = expectedFilletVolume(h.core, signature);
      near(expected, 24000 - 40 * (1 - Math.PI / 4), 'analytic selected-edge fillet');
      await fillet(h.app, ref);
      volume(h.core, expected);
      const saved = serializeCadDocument(h.app.getDocument());
      const reopened = application(parseCadDocument(saved));
      try {
        await rebuild(reopened.app);
        volume(reopened.core, expected);
        assert.equal(serializeCadDocument(reopened.app.getDocument()), saved, 'rebuild must preserve saved reference intent');
      } finally { reopened.app.dispose(); }
    } finally { h.app.dispose(); }
  });
  await check('public driving-width edit retains the selected edge', async () => {
    const h = await block();
    try {
      const ref = await selectedEdge(h, [30, 0, 0]);
      const signature = structuredClone(edgeSignature(h.app, ref));
      await run(h.app, { id: 'part.dimension.setValue', payload: { dimensionId: h.widthId, value: 64 } });
      await rebuild(h.app);
      volume(h.core, 64 * 40 * 10);
      const expected = expectedFilletVolume(h.core, signature);
      await fillet(h.app, ref);
      volume(h.core, expected);
      assert.deepEqual(edgeSignature(h.app, ref), signature, 'upstream edits must not rewrite the captured locator');
    } finally { h.app.dispose(); }
  });
  await check('edge-count change, valid reorder, suppress and restore', async () => {
    const h = await block();
    try {
      const ref = await selectedEdge(h, [30, 0, 0]);
      const countBefore = edgeCount(h.core);
      const circleSketch = await run(h.app, { id: 'sketch.create', payload: { support: 'XY' } });
      const sketchId = circleSketch.createdIds![0] as CadSketchId;
      await run(h.app, { id: 'sketch.circle', payload: { sketchId, center: [0, 0], diameter: 6 } });
      await run(h.app, { id: 'feature.cutExtrude', payload: { sketchId, end: 'through-all' } });
      await rebuild(h.app);
      assert.ok(edgeCount(h.core) > countBefore, 'the cut must change the edge set');
      const expected = expectedFilletVolume(h.core, edgeSignature(h.app, ref));
      await fillet(h.app, ref);
      volume(h.core, expected);
      // These are existing serialized history fields, replayed through the public replacement API.
      const reordered = structuredClone(part(h.app));
      [reordered.features[1], reordered.features[2]] = [reordered.features[2], reordered.features[1]];
      await h.app.replaceDocument(parseCadDocument(serializeCadDocument(reordered)));
      assert.equal(h.app.getState().recompute.status, 'clean');
      volume(h.core, expected);
      const suppressed = structuredClone(reordered);
      suppressed.features.find(feature => feature.type === 'fillet')!.suppressed = true;
      await h.app.replaceDocument(parseCadDocument(serializeCadDocument(suppressed)));
      assert.equal(h.app.getState().recompute.status, 'clean');
      volume(h.core, 24000 - Math.PI * 9 * 10);
      await h.app.replaceDocument(parseCadDocument(serializeCadDocument(reordered)));
      assert.equal(h.app.getState().recompute.status, 'clean');
      volume(h.core, expected);
    } finally { h.app.dispose(); }
  });

  async function pocketSeed(width: number, depth: number) {
    const h = await block(width, width, depth);
    try {
      const ref = await h.app.captureReference({
        kind: 'face', sourceFeatureId: h.featureId, point: [0, 0, depth], semanticRole: 'oriented-top',
      });
      const sketch = await run(h.app, { id: 'sketch.create', payload: { support: ref } });
      const sketchId = sketch.createdIds![0] as CadSketchId;
      await run(h.app, { id: 'sketch.circle', payload: { sketchId, center: [0, 0], diameter: 4 } });
      await run(h.app, { id: 'feature.cutExtrude', payload: { sketchId, end: 'blind', distance: Math.min(2, depth / 2) } });
      return { document: structuredClone(part(h.app)), ref };
    } finally { h.app.dispose(); }
  }
  async function replay(seed: Awaited<ReturnType<typeof pocketSeed>>, change: (document: CadPartDocument) => void,
    inspect: (h: ReturnType<typeof application>, result: Awaited<ReturnType<CadApplicationImpl['execute']>>) => Promise<void> | void) {
    const document = structuredClone(seed.document);
    change(document);
    const saved = serializeCadDocument(document);
    const h = application(parseCadDocument(saved));
    try {
      const result = await h.app.execute({ id: 'document.rebuild', payload: {} });
      assert.equal(serializeCadDocument(h.app.getDocument()), saved, 'runtime may not rewrite saved intent');
      await inspect(h, result);
    } finally { h.app.dispose(); }
  }
  function rejected(h: ReturnType<typeof application>, result: Awaited<ReturnType<CadApplicationImpl['execute']>>, pattern: RegExp) {
    assert.equal(result.ok, false, 'broken support must not quietly build geometry');
    assert.match(result.error?.message ?? '', pattern);
    assert.equal(h.app.getState().recompute.status, 'error');
    assert.equal(h.core.getLastAnalysis(), null, 'failed support must not publish a B-Rep');
  }
  function pocketCenterZ(core: OpenCascadePartRuntime): number {
    const cylinders = [];
    for (let i = 0; i < 128; i++) {
      const face = captureFace(oc, shape(core), i);
      if (!face) break;
      if (face.surf === 'cylinder') cylinders.push(face);
    }
    assert.equal(cylinders.length, 1, 'expected the one actual pocket wall');
    return cylinders[0].centroid[2];
  }

  const ownerSeed = await (async () => {
    const h = await block();
    try {
      const ref = await selectedEdge(h, [30, 0, 0]);
      const sketchId = part(h.app).sketches[0].id;
      await run(h.app, { id: 'feature.extrude', payload: { sketchId, distance: 10 } });
      await rebuild(h.app);
      const expected = expectedFilletVolume(h.core, edgeSignature(h.app, ref));
      await fillet(h.app, ref);
      volume(h.core, expected);
      return { document: structuredClone(part(h.app)), owner: h.featureId, ref, expected };
    } finally { h.app.dispose(); }
  })();
  for (const mode of ['active', 'legacy-absent', 'unknown', 'deleted', 'suppressed'] as const) {
    await check('edge source owner ' + mode + ' and restore', async () => {
      const document = structuredClone(ownerSeed.document);
      const reference = document.stableReferences.find(item => item.id === ownerSeed.ref)!;
      if (mode === 'legacy-absent') delete reference.ownerFeatureId;
      if (mode === 'unknown') reference.ownerFeatureId = 'feature_missing_edge_owner' as CadFeatureId;
      if (mode === 'deleted') document.features.splice(document.features.findIndex(feature => feature.id === ownerSeed.owner), 1);
      if (mode === 'suppressed') document.features.find(feature => feature.id === ownerSeed.owner)!.suppressed = true;
      const saved = serializeCadDocument(document);
      const h = application(parseCadDocument(saved));
      try {
        const result = await h.app.execute({ id: 'document.rebuild', payload: {} });
        assert.equal(serializeCadDocument(h.app.getDocument()), saved, 'owner compatibility must not rewrite the DTO');
        if (mode === 'active' || mode === 'legacy-absent') {
          assert.equal(result.ok, true, result.error?.message);
          volume(h.core, ownerSeed.expected);
        } else {
          rejected(h, result, /source feature .* is not built yet/);
          await h.app.replaceDocument(parseCadDocument(serializeCadDocument(ownerSeed.document)));
          assert.equal(h.app.getState().recompute.status, 'clean');
          volume(h.core, ownerSeed.expected);
        }
      } finally { h.app.dispose(); }
    });
  }

  const small = await pocketSeed(20, 10);
  for (const mode of ['missing', 'unknown'] as const) {
    await check('face source owner ' + mode + ' fails explicitly', () => replay(small, document => {
      const reference = document.stableReferences.find(item => item.id === small.ref)!;
      if (mode === 'missing') delete reference.ownerFeatureId;
      else reference.ownerFeatureId = 'feature_missing_support_owner' as CadFeatureId;
    }, (h, result) => rejected(h, result, /no source feature|not built yet/)));
  }
  await check('disappearing face beyond tolerance fails explicitly', () => replay(small, document => {
    document.features[0].parameters.distance = 100;
  }, (h, result) => rejected(h, result, /support face unresolved/)));
  const thin = await pocketSeed(100, 1);
  await check('ambiguous support fails explicitly', () => replay(thin, () => {}, (h, result) =>
    rejected(h, result, /ambiguous/)));
  const large = await pocketSeed(100, 10);
  await check('same oriented face survives a small depth edit and reopen', () => replay(large, document => {
    document.features[0].parameters.distance = 12;
  }, (h, result) => {
    assert.equal(result.ok, true, result.error?.message);
    near(pocketCenterZ(h.core), 11, 'pocket must remain on the top side');
    volume(h.core, 100 * 100 * 12 - Math.PI * 4 * 2);
  }));
  await check('large depth edit never rebinds top support to the bottom', () => replay(large, document => {
    document.features[0].parameters.distance = 100;
  }, (h, result) => {
    if (result.ok) near(pocketCenterZ(h.core), 99, 'selected top-side pocket');
    else rejected(h, result, /support face.*orientation|support face unresolved/);
  }));
  for (const mode of ['suppressed', 'after-dependent'] as const) {
    await check('unavailable source ' + mode + ' fails and restores', () => replay(small, document => {
      if (mode === 'suppressed') document.features[0].suppressed = true;
      else document.features.reverse();
    }, async (h, result) => {
      rejected(h, result, /no target body|not built yet/);
      await h.app.replaceDocument(parseCadDocument(serializeCadDocument(small.document)));
      assert.equal(h.app.getState().recompute.status, 'clean');
      near(pocketCenterZ(h.core), 9, 'restored top-side pocket');
      volume(h.core, 20 * 20 * 10 - Math.PI * 4 * 2);
    }));
  }
  await check('ASA edge retrieval deletes owned handles and returns a caller-owned edge', async () => {
    const h = await block();
    const maps: { native: any; currents: any[]; keys: any[] }[] = [];
    let edge: any;
    try {
      const refId = await selectedEdge(h, [30, 0, 0]);
      const reference = part(h.app).stableReferences.find(item => item.id === refId)!;
      // Observe real native handles without changing the OCC module or the resolver result.
      const TrackedMap = new Proxy(oc.TopTools_IndexedMapOfShape_1, {
        construct(target, args) {
          const native: any = Reflect.construct(target, args);
          const record = { native, currents: [] as any[], keys: [] as any[] };
          maps.push(record);
          const add = native.Add.bind(native);
          native.Add = (current: any) => { record.currents.push(current); return add(current); };
          const findKey = native.FindKey.bind(native);
          native.FindKey = (index: number) => {
            const key = findKey(index);
            record.keys.push(key);
            return key;
          };
          return native;
        },
      });
      const observedOc = new Proxy(oc, {
        get(target, property) {
          return property === 'TopTools_IndexedMapOfShape_1' ? TrackedMap : Reflect.get(target, property);
        },
      });
      edge = resolveFilletReferenceEdge(observedOc, shape(h.core), reference, 'Handle lifetime',
        new Map([[h.featureId, shape(h.core)]]));
      // StableRef's scoring maps precede the final ASA map used for native edge retrieval.
      const retrieval = maps.at(-1)!;
      assert.ok(retrieval.currents.length > 0, 'must observe actual Current handles added to the ASA map');
      assert.equal(retrieval.keys.length, 1, 'must observe the selected FindKey handle');
      const lifetime = {
        currentAlive: retrieval.currents.filter(handle => !handle.isDeleted()).length,
        keyAlive: retrieval.keys.filter(handle => !handle.isDeleted()).length,
        mapAlive: !retrieval.native.isDeleted(),
        edgeAlive: !edge.isDeleted(),
      };
      console.log('  Actual OCC retrieval: ' + JSON.stringify({ currentCount: retrieval.currents.length, ...lifetime }));
      assert.deepEqual(lifetime, { currentAlive: 0, keyAlive: 0, mapAlive: false, edgeAlive: true });
      assert.equal(edge.ShapeType().value, oc.TopAbs_ShapeEnum.TopAbs_EDGE.value);
      edge.delete();
      assert.equal(edge.isDeleted(), true, 'the caller must be able to release the returned edge');
    } finally {
      if (edge && !edge.isDeleted()) edge.delete();
      // Keep the test isolated even on RED; legacy vendor temporaries are outside this assertion.
      for (const record of maps) {
        for (const handle of [...record.currents, ...record.keys]) if (!handle.isDeleted()) handle.delete();
        if (!record.native.isDeleted()) record.native.delete();
      }
      h.app.dispose();
    }
  });
  console.log('Stable topology ownership: ' + passed + ' PASS, ' + failures.length + ' FAIL');
  assert.equal(failures.length, 0, failures.join('\n'));
}
