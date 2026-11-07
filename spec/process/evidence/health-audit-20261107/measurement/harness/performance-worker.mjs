import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { errorData, git, hash, summarize, writeJson } from './performance-common.mjs';
import { command, corpus, counts, ids, near, newSketchApp, partChecks, protectedPart, sketchFixture, solvedChecks } from './performance-fixtures.mjs';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.ok(['solve', 'history', 'serialization', 'cold-planegcs', 'cold-occ', 'protected-part'].includes(config.family));
assert.equal(git(config.repo, ['rev-parse', 'HEAD']).trim(), config.expectedHead);
const report = {
  schemaVersion: 1, family: config.family, mode: config.mode, acceptedBaseline: false,
  sourceHead: config.expectedHead, sourceFingerprint: config.sourceFingerprint, pid: process.pid,
  startedAt: new Date().toISOString(), status: 'RUNNING', cases: [], bootstrap: {},
  resources: { ownedAppsOrSolvers: 0, disposed: 0, remaining: 0, disposalErrors: [], browserCreated: false, serverCreated: false },
};
const owned = new Set();
const own = (value) => { owned.add(value); report.resources.ownedAppsOrSolvers++; return value; };
const dispose = (value) => { if (owned.has(value)) { value.dispose(); owned.delete(value); report.resources.disposed++; } };
const flush = () => { report.resources.remaining = owned.size; writeJson(config.reportPath, report); };
const apiStart = performance.now();
const importedApi = await import(pathToFileURL(path.join(config.repo, 'src/index.ts')).href);
const api = importedApi.CadApplicationImpl ? importedApi : importedApi.default;
assert.equal(typeof api?.CadApplicationImpl, 'function', 'Public API module was not loaded');
report.bootstrap.publicApiImportMs = performance.now() - apiStart;
const serialized = (app) => api.serializeCadDocument(app.getDocument());

async function timed(record, name, action) {
  const start = performance.now();
  try { return await action(); } finally { record.metrics[name] = performance.now() - start; }
}
function syncTimed(record, name, action) {
  const start = performance.now();
  try { return action(); } finally { record.metrics[name] = performance.now() - start; }
}
async function loadOcc() {
  const start = performance.now();
  const mod = await import(pathToFileURL(path.join(config.repo, 'vendor/toubkal/node_modules/opencascade.js/dist/node.js')).href);
  const oc = await mod.default();
  report.bootstrap.occModuleAndInitMs = performance.now() - start;
  return oc;
}

async function runCase(name, metadata, action) {
  const value = {
    name, metadata, requestedSamples: config.samples, requestedWarmups: config.warmups,
    warmups: [], samples: [], status: 'RUNNING',
  };
  report.cases.push(value);
  for (const [kind, count] of [['warmups', config.warmups], ['samples', config.samples]]) {
    for (let index = 0; index < count; index++) {
      const record = { index, status: 'RUNNING', metrics: {}, checks: {}, startedAt: new Date().toISOString() };
      value[kind].push(record);
      const start = performance.now();
      try {
        await action(record, kind, index);
        assert.ok(Object.values(record.metrics).every((v) => Number.isFinite(v) && v >= 0), 'Invalid measurement');
        record.status = 'PASS';
      } catch (error) {
        record.status = 'FAIL';
        record.error = errorData(error);
        value.status = 'FAIL';
      }
      record.elapsedIncludingChecksMs = performance.now() - start;
      record.endedAt = new Date().toISOString();
      flush();
      console.log(config.family + '/' + name + ' ' + kind + '[' + index + '] ' + record.status);
      if (record.status === 'FAIL') break;
    }
    if (value.status === 'FAIL') break;
  }
  value.unattemptedSamples = config.samples - value.samples.length;
  value.summary = summarize(value.samples);
  if (value.status !== 'FAIL') value.status = 'PASS';
  flush();
  return value;
}

async function solveFamily() {
  const solver = own(new api.PlaneGCSSketchSolverRuntime());
  const start = performance.now();
  await solver.init();
  report.bootstrap.planeGcsInitMs = performance.now() - start;
  try {
    for (const size of config.sizes) {
      const { document, sketchId } = await sketchFixture(api, size);
      const before = api.serializeCadDocument(document);
      const fixture = corpus(api, config.directory, 'solve-' + size, document);
      await runCase('lines-' + size, {
        fixture, backend: 'actual PlaneGCSSketchSolverRuntime',
        kernelState: 'initialized/warm', resultCache: 'none; BrowserSketchSolverAdapter LRU bypassed',
        cacheHitMeasurement: 'not performed by this Node harness',
      }, async (record) => {
        const result = syncTimed(record, 'solveMs', () => solver.solve(document, sketchId));
        record.checks = solvedChecks(document, result, size);
        assert.equal(api.serializeCadDocument(document), before, 'Solve mutated persisted input');
        record.checks.inputSha256 = hash(before);
        record.checks.inputUnchanged = true;
      });
    }
  } finally { dispose(solver); }
}

async function historyFamily() {
  const oc = await loadOcc();
  for (const size of config.sizes) {
    await runCase('line-frames-' + size, {
      entities: size, commandsPerEntity: 3, historyFrames: size * 3,
      application: 'actual CadApplicationImpl', runtime: 'actual OpenCascadePartRuntime with zero features',
      includes: 'public execute/undo/redo and their no-feature recompute; startup excluded',
      validation: 'every intermediate serialized snapshot including IDs/constraint refs',
    }, async (record, kind, index) => {
      const core = new api.OpenCascadePartRuntime(oc);
      const app = own(newSketchApp(api, core));
      try {
        const sketchId = (await command(app, { id: 'sketch.create', payload: { support: 'XY', name: 'History corpus' } })).createdIds[0];
        const snapshots = [serialized(app)];
        const timings = { executeMs: [], undoMs: [], redoMs: [] };
        async function execute(value) {
          const start = performance.now();
          const result = await app.execute(value);
          timings.executeMs.push(performance.now() - start);
          assert.equal(result.ok, true, JSON.stringify(result.error));
          assert.equal(result.changed, true);
          snapshots.push(serialized(app));
          return result;
        }
        for (let i = 0; i < size; i++) {
          const entityId = (await execute({ id: 'sketch.line', payload: { sketchId, from: [0, i * 10], to: [30, i * 10 + 5] } })).createdIds[0];
          await execute({ id: 'constraint.horizontal', payload: { sketchId, entityId } });
          await execute({ id: 'dimension.linear', payload: { sketchId, entityIds: [entityId], value: 40 } });
        }
        const final = snapshots.at(-1);
        const finalIds = ids(app.getDocument());
        assert.equal(snapshots.length, size * 3 + 1);
        for (let i = snapshots.length - 2; i >= 0; i--) {
          const start = performance.now();
          const result = await app.undo();
          timings.undoMs.push(performance.now() - start);
          assert.equal(result.ok, true); assert.equal(result.changed, true);
          assert.equal(serialized(app), snapshots[i], 'Undo snapshot mismatch at ' + i);
        }
        assert.equal(counts(app.getDocument()).entities, 0);
        assert.equal(counts(app.getDocument()).constraints, 0);
        assert.equal(counts(app.getDocument()).dimensions, 0);
        for (let i = 1; i < snapshots.length; i++) {
          const start = performance.now();
          const result = await app.redo();
          timings.redoMs.push(performance.now() - start);
          assert.equal(result.ok, true); assert.equal(result.changed, true);
          assert.equal(serialized(app), snapshots[i], 'Redo snapshot mismatch at ' + i);
        }
        assert.equal(serialized(app), final);
        assert.deepEqual(ids(app.getDocument()), finalIds);
        assert.equal(app.getState().canRedo, false);
        assert.equal(core.getLastAnalysis(), null, 'Sketch-only history unexpectedly built B-Rep');
        for (const [key, values] of Object.entries(timings)) {
          record.metrics[key.replace('Ms', 'BatchMs')] = values.reduce((a, b) => a + b, 0);
          record.metrics[key.replace('Ms', 'PerCommandMs')] = values.reduce((a, b) => a + b, 0) / values.length;
        }
        record.rawOperationMs = timings;
        record.checks = {
          fullIntermediateSnapshotsChecked: size * 6, frames: size * 3,
          emptyAfterUndo: true, finalSnapshotAndIdsRestored: true,
          finalSnapshotSha256: hash(final), finalIds, sourceInputWasSketchOnly: true,
        };
        if (kind === 'samples' && index === 0) record.corpus = corpus(api, config.directory, 'history-' + size, app.getDocument());
      } finally { dispose(app); }
    });
  }
}

async function serializationFamily() {
  for (const size of config.sizes) {
    const { document } = await sketchFixture(api, size);
    const before = api.serializeCadDocument(document);
    const fixture = corpus(api, config.directory, 'serialization-' + size, document);
    const host = new api.MemoryCadProjectHost(document);
    let revision = 0;
    await runCase('lines-' + size, {
      fixture, host: 'actual MemoryCadProjectHost', storageMedium: 'in-memory serialized string; no disk/network/browser durability claim',
      serialization: 'public validate+serialize / parse+validate; host save/load measured separately',
    }, async (record, kind, index) => {
      const encoded = syncTimed(record, 'serializeMs', () => api.serializeCadDocument(document));
      const parsed = syncTimed(record, 'parseMs', () => api.parseCadDocument(encoded));
      assert.deepEqual(parsed, document); assert.notEqual(parsed, document);
      let saved, loaded;
      await timed(record, 'hostRoundtripMs', async () => {
        saved = await timed(record, 'hostSaveMs', () => host.save({ document, baseRevision: revision, mutationId: kind + '-' + index }));
        loaded = await timed(record, 'hostLoadMs', () => host.load());
      });
      revision++;
      assert.equal(saved.revision, revision); assert.equal(loaded.revision, revision);
      assert.deepEqual(loaded.document, document); assert.notEqual(loaded.document, document);
      assert.equal(api.serializeCadDocument(loaded.document), before);
      assert.deepEqual(ids(loaded.document), ids(document));
      assert.equal(api.serializeCadDocument(document), before);
      record.checks = { fullRoundtripAndIdsEqual: true, callerInputUnchanged: true, revision, serializedBytes: Buffer.byteLength(encoded), snapshotSha256: hash(encoded) };
    });
  }
}

async function coldPlane() {
  const { document, sketchId } = await sketchFixture(api, 1);
  const fixture = corpus(api, config.directory, 'cold-plane-input', document);
  await runCase('first-init', { fixture, cacheState: 'fresh Node process; first PlaneGCS init', osDiskCacheCold: false, browserStartup: false }, async (record) => {
    const solver = own(new api.PlaneGCSSketchSolverRuntime());
    try {
      await timed(record, 'initMs', () => solver.init());
      const result = syncTimed(record, 'firstSolveMs', () => solver.solve(document, sketchId));
      record.checks = solvedChecks(document, result, 1);
    } finally { dispose(solver); }
  });
}

async function coldOcc() {
  const start = performance.now();
  const mod = await import(pathToFileURL(path.join(config.repo, 'vendor/toubkal/node_modules/opencascade.js/dist/node.js')).href);
  report.bootstrap.occModuleImportMs = performance.now() - start;
  await runCase('first-init', { cacheState: 'fresh Node process; first OpenCascade init', osDiskCacheCold: false, browserStartup: false }, async (record) => {
    const oc = await timed(record, 'initMs', () => mod.default());
    assert.ok(oc && typeof oc === 'object', 'Missing actual OCC module');
    const core = new api.OpenCascadePartRuntime(oc);
    const app = own(newSketchApp(api, core));
    try {
      const sketchId = (await command(app, { id: 'sketch.create', payload: { support: 'XY' } })).createdIds[0];
      await command(app, { id: 'sketch.rectangle', payload: { sketchId, origin: [-30, -20], width: 60, height: 40 } });
      await command(app, { id: 'feature.extrude', payload: { sketchId, distance: 10 } });
      await timed(record, 'firstRecomputeMs', () => command(app, { id: 'document.rebuild', payload: {} }));
      const analysis = core.getLastAnalysis();
      assert.ok(analysis); near(analysis.volume, 24000, 1e-3); assert.equal(analysis.featureCount, 1);
      for (const [key, expected] of Object.entries({ minX: -30, maxX: 30, minY: -20, maxY: 20, minZ: 0, maxZ: 10 })) near(analysis.bounds[key], expected, 1e-4, key);
      record.checks = { actualOccVolumeAndBounds: structuredClone(analysis) };
      record.corpus = corpus(api, config.directory, 'cold-occ-input', app.getDocument());
    } finally { dispose(app); }
  });
}

async function protectedFamily() {
  const oc = await loadOcc();
  const rectangleModule = await import(pathToFileURL(path.join(config.repo, 'src/web/SketchParametricRectangleOwner.ts')).href);
  const rectangleOwner = rectangleModule.commitParametricRectangle ? rectangleModule : rectangleModule.default;
  const fixture = await protectedPart(api, rectangleOwner, oc);
  const { app, core, widthId, initial } = fixture;
  own(app);
  const initialIds = ids(app.getDocument());
  const descriptor = corpus(api, config.directory, 'protected-input-60', app.getDocument());
  try {
    await runCase('protected-60-to-80-save-open', {
      fixture: descriptor, widthEdit: [60, 80], features: 'extrude10 + through cut diameter12 + filletR1',
      backend: 'actual PlaneGCS -> SolvedSketchPartRuntimeAdapter -> OpenCascadePartRuntime',
      cache: 'no browser LRU; OCC module initialized; reopened adapter includes its own PlaneGCS initialization',
      initialAnalysis: initial,
    }, async (record, kind, index) => {
      await command(app, { id: 'part.dimension.setValue', payload: { dimensionId: widthId, value: 60 } });
      await timed(record, 'rebuild60Ms', () => command(app, { id: 'document.rebuild', payload: {} }));
      const base = partChecks(core, 60); near(base.volume, initial.volume, 1e-5, 'repeat initial volume');
      await timed(record, 'editWidthMs', () => command(app, { id: 'part.dimension.setValue', payload: { dimensionId: widthId, value: 80 } }));
      await timed(record, 'rebuild80Ms', () => command(app, { id: 'document.rebuild', payload: {} }));
      const edited = partChecks(core, 80, base.volume);
      assert.deepEqual(ids(app.getDocument()), initialIds);
      const beforeSave = serialized(app);
      assert.equal(/TopoDS|window\.oc/.test(beforeSave), false, 'Kernel internals leaked into persisted DTO');
      const host = new api.MemoryCadProjectHost(api.createEmptyCadDocument('part'));
      let loaded;
      await timed(record, 'saveOpenHostMs', async () => {
        const saved = await host.save({ document: app.getDocument(), baseRevision: 0, mutationId: kind + '-' + index });
        assert.equal(saved.revision, 1);
        loaded = await host.load();
      });
      assert.equal(loaded.revision, 1);
      assert.equal(api.serializeCadDocument(loaded.document), beforeSave);
      const reopenedCore = new api.OpenCascadePartRuntime(oc);
      const reopened = own(new api.CadApplicationImpl(loaded.document, new api.SolvedSketchPartRuntimeAdapter(reopenedCore, new api.PlaneGCSSketchSolverRuntime())));
      try {
        await timed(record, 'reopenedRecomputeMs', () => command(reopened, { id: 'document.rebuild', payload: {} }));
        const reopenedAnalysis = partChecks(reopenedCore, 80, base.volume);
        near(reopenedAnalysis.volume, edited.volume, 1e-5, 'reopened volume');
        assert.equal(serialized(reopened), beforeSave);
        assert.deepEqual(ids(reopened.getDocument()), initialIds);
        assert.equal(serialized(app), beforeSave);
        record.checks = { base, edited, reopened: reopenedAnalysis, fullDocumentAndIdsPreserved: true, stableReferenceIds: initialIds.stableReferences, savedSha256: hash(beforeSave) };
      } finally { dispose(reopened); }
    });
  } finally { dispose(app); }
}

try {
  flush();
  await ({ solve: solveFamily, history: historyFamily, serialization: serializationFamily, 'cold-planegcs': coldPlane, 'cold-occ': coldOcc, 'protected-part': protectedFamily })[config.family]();
  report.status = report.cases.length > 0 && report.cases.every((value) => value.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  report.status = 'FAIL';
  report.fatalError = errorData(error);
} finally {
  for (const value of [...owned]) {
    try { dispose(value); } catch (error) { report.resources.disposalErrors.push(errorData(error)); }
  }
  if (owned.size || report.resources.disposalErrors.length) report.status = 'FAIL';
  report.endedAt = new Date().toISOString();
  flush();
}
console.log(JSON.stringify({ family: report.family, status: report.status, pid: process.pid, reportPath: config.reportPath, resources: report.resources }));
process.exitCode = report.status === 'PASS' ? 0 : 1;
