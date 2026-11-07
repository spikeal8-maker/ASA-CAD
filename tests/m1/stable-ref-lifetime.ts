import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  captureEdge, captureFace, captureFaceAtPoint, captureVertex,
  resolveEdge, resolveFace, resolveVertex,
  type EdgeSig, type FaceSig, type VertexSig,
} from '../../vendor/toubkal/src/services/StableRef';

type Fault = 'none' | 'add' | 'cast' | 'face-properties' | 'edge-properties' | 'vertex-point' | 'distance';
type Observation = { created: Record<string, number>; live: Record<string, number>; totalCreated: number; totalLive: number };

// Every observed object is a real native object from the pinned OCC module.
// Faults inject an exception at one native call boundary; they never replace geometry.
function observe(oc: any, fault: Fault) {
  const handles = new Map<any, string>();
  const constructors = new Set([
    'TopTools_IndexedMapOfShape_1', 'TopExp_Explorer_2', 'gp_Pnt_3',
    'BRepBuilderAPI_MakeVertex', 'BRepExtrema_DistShapeShape_1', 'Message_ProgressRange_1',
    'GProp_GProps_1', 'GeomAdaptor_Surface_2', 'BRepAdaptor_Curve_2',
  ]);
  const cache = new Map<PropertyKey, any>();
  function track(value: any, label: string): any {
    if (!value || typeof value.delete !== 'function' || handles.has(value)) return value;
    handles.set(value, label);
    for (const method of ['CentreOfMass', 'Plane', 'Cylinder', 'Line', 'Circle', 'Axis', 'Direction']) {
      if (typeof value[method] !== 'function') continue;
      const native = value[method].bind(value);
      value[method] = (...args: any[]) => track(native(...args), method);
    }
    return value;
  }
  function construct(target: any, args: any[], name: string) {
    const value = track(Reflect.construct(target, args), name);
    if (name === 'TopTools_IndexedMapOfShape_1') {
      const add = value.Add.bind(value), findKey = value.FindKey.bind(value);
      value.Add = (current: any) => {
        if (fault === 'add') throw new Error('injected add failure');
        return add(current);
      };
      value.FindKey = (index: number) => track(findKey(index), 'FindKey');
    }
    if (name === 'TopExp_Explorer_2') {
      const current = value.Current.bind(value);
      value.Current = () => track(current(), 'Current');
    }
    if (name === 'BRepBuilderAPI_MakeVertex') {
      const vertex = value.Vertex.bind(value);
      value.Vertex = () => track(vertex(), 'Vertex');
    }
    if (name === 'BRepExtrema_DistShapeShape_1' && fault === 'distance') {
      value.Perform = () => { throw new Error('injected distance failure'); };
    }
    return value;
  }
  function namespace(target: any, name: string) {
    return new Proxy(target, {
      get(object, property) {
        const value = Reflect.get(object, property);
        if (typeof value !== 'function') return value;
        const key = String(property);
        if (name === 'TopoDS' && ['Face_1', 'Edge_1', 'Vertex_1'].includes(key)) {
          return (...args: any[]) => {
            if (fault === 'cast') throw new Error('injected cast failure');
            return track(Reflect.apply(value, object, args), 'cast.' + key);
          };
        }
        if (name === 'BRep_Tool' && ['Pnt', 'Surface_2'].includes(key)) {
          return (...args: any[]) => {
            if (fault === 'vertex-point' && key === 'Pnt') throw new Error('injected vertex-point failure');
            return track(Reflect.apply(value, object, args), key);
          };
        }
        if (name === 'BRepGProp' &&
          ((fault === 'face-properties' && key === 'SurfaceProperties_1') ||
           (fault === 'edge-properties' && key === 'LinearProperties'))) {
          return () => { throw new Error('injected ' + fault + ' failure'); };
        }
        return value;
      },
    });
  }
  const observed = new Proxy(oc, {
    get(target, property) {
      if (cache.has(property)) return cache.get(property);
      const value = Reflect.get(target, property);
      const key = String(property);
      if (constructors.has(key)) {
        const wrapped = new Proxy(value, { construct: (target, args) => construct(target, args, key) });
        cache.set(property, wrapped);
        return wrapped;
      }
      if (['TopoDS', 'BRep_Tool', 'BRepGProp'].includes(key)) {
        const wrapped = namespace(value, key);
        cache.set(property, wrapped);
        return wrapped;
      }
      return value;
    },
  });
  return {
    oc: observed,
    snapshot(): Observation {
      const created: Record<string, number> = {}, live: Record<string, number> = {};
      for (const [handle, label] of handles) {
        created[label] = (created[label] ?? 0) + 1;
        if (!handle.isDeleted()) live[label] = (live[label] ?? 0) + 1;
      }
      return { created, live, totalCreated: handles.size, totalLive: Object.values(live).reduce((a, b) => a + b, 0) };
    },
    cleanup() {
      // Preserve a failed run's observation, then release only its still-live native test handles.
      for (const handle of [...handles.keys()].reverse()) if (!handle.isDeleted()) handle.delete();
    },
  };
}

export async function runStableRefLifetimeRegression(oc: any): Promise<void> {
  const builder = new oc.BRepPrimAPI_MakeBox_2(20, 30, 10);
  const shape = builder.Shape();
  builder.delete();
  const results: { name: string; fault: Fault; passed: boolean; error: string | null; observation: Observation }[] = [];
  let face: FaceSig | null = null, edge: EdgeSig | null = null, vertex: VertexSig | null = null;
  function check(name: string, action: (observed: any) => void, fault: Fault = 'none', expectKey = true) {
    const probe = observe(oc, fault);
    const errors: string[] = [];
    try { action(probe.oc); }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    const observation = probe.snapshot();
    try {
      assert.ok(observation.created.Current > 0, 'must exercise real native Current handles');
      if (expectKey) assert.ok(observation.created.FindKey > 0, 'must exercise real native FindKey handles');
      assert.equal(observation.totalLive, 0, 'owned handles still alive: ' + JSON.stringify(observation.live));
      assert.equal(shape.isDeleted(), false, 'borrowed source shape was deleted');
      assert.equal(shape.IsNull(), false, 'borrowed source shape became null');
      assert.equal(shape.ShapeType().value, oc.TopAbs_ShapeEnum.TopAbs_SOLID.value);
    } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    finally { probe.cleanup(); }
    results.push({ name, fault, passed: errors.length === 0, error: errors.join('; ') || null, observation });
    console.log('  ' + (errors.length ? 'FAIL ' : 'PASS ') + name + ' ' + JSON.stringify(observation));
  }
  try {
    check('capture face releases raw keys and typed face', api => {
      face = captureFace(api, shape, 0);
      assert.ok(face && face.area > 0);
    });
    check('capture edge releases raw keys and typed edge', api => {
      edge = captureEdge(api, shape, 0);
      assert.ok(edge && edge.length > 0);
    });
    check('capture vertex releases raw keys and typed vertex', api => {
      vertex = captureVertex(api, shape, 0);
      assert.ok(vertex && vertex.pos.every(Number.isFinite));
    });
    check('resolve face preserves index and releases all candidates', api => {
      assert.ok(face);
      const result = resolveFace(api, shape, face);
      assert.equal(result.rejected, false);
      assert.equal(result.index, 0);
    });
    check('resolve edge preserves index and releases all candidates', api => {
      assert.ok(edge);
      const result = resolveEdge(api, shape, edge);
      assert.equal(result.rejected, false);
      assert.equal(result.index, 0);
    });
    check('resolve vertex releases cloud and candidate handles', api => {
      assert.ok(vertex);
      const result = resolveVertex(api, shape, vertex);
      assert.equal(result.rejected, false);
      assert.equal(result.index, 0);
    });
    check('nearest face releases probe vertex, faces and progress', api => {
      const result = captureFaceAtPoint(api, shape, [10, 15, 10]);
      assert.ok(result);
      assert.ok(Math.abs(result.centroid[2] - 10) < 1e-7);
    });
    check('out-of-range capture releases map and explorer', api => {
      assert.equal(captureEdge(api, shape, -1), null);
      assert.equal(captureFace(api, shape, 999), null);
    }, 'none', false);
    check('map Add exception releases Current, explorer and map',
      api => assert.throws(() => captureEdge(api, shape, 0), /injected add failure/), 'add', false);
    check('cast exception releases FindKey and map',
      api => assert.throws(() => captureEdge(api, shape, 0), /injected cast failure/), 'cast');
    check('face signature exception releases all temporaries',
      api => assert.throws(() => captureFace(api, shape, 0), /injected face-properties failure/), 'face-properties');
    check('unscoreable edge candidates still release all temporaries', api => {
      assert.ok(edge);
      const result = resolveEdge(api, shape, edge);
      assert.equal(result.rejected, true);
      assert.equal(result.index, -1);
      assert.equal(result.reason, 'no candidates');
    }, 'edge-properties');
    check('vertex cloud exception releases raw key, vertex and map', api => {
      assert.ok(vertex);
      const capturedVertex = vertex;
      assert.throws(() => resolveVertex(api, shape, capturedVertex), /injected vertex-point failure/);
    }, 'vertex-point');
    check('unmeasurable nearest faces release probe and per-face handles',
      api => assert.equal(captureFaceAtPoint(api, shape, [10, 15, 10]), null), 'distance');
  } finally { if (!shape.isDeleted()) shape.delete(); }
  const report = {
    schemaVersion: 1, scope: 'StableRef owned wrapper lifetimes; not a whole-vendor native-heap measurement',
    cases: results, passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length,
  };
  if (process.env.ASA_STABLEREF_LIFETIME_REPORT) {
    writeFileSync(process.env.ASA_STABLEREF_LIFETIME_REPORT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log('StableRef lifetime: ' + report.passed + ' PASS, ' + report.failed + ' FAIL');
  assert.equal(report.failed, 0, results.filter(result => !result.passed).map(result => result.name + ': ' + result.error).join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { default: initOpenCascade } = await import('../../vendor/toubkal/node_modules/opencascade.js/dist/node.js');
  await runStableRefLifetimeRegression(await initOpenCascade());
}
