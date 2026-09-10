import assert from 'node:assert/strict';
import {
  CadRuntimeUnsupportedError,
  LazyCadRuntimeLoader,
  cadEditorPath,
  cadViewerPath,
  evaluateCadCapabilities,
  parseCadClientRoute,
} from '../../src';

const full = evaluateCadCapabilities({
  webAssembly: true,
  sharedArrayBuffer: true,
  crossOriginIsolated: true,
  webgl: true,
  webgl2: true,
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  touchPoints: 0,
});
assert.equal(full.tier, 'full');
assert.equal(full.supported, true);

const constrained = evaluateCadCapabilities({
  webAssembly: true,
  sharedArrayBuffer: true,
  crossOriginIsolated: true,
  webgl: true,
  webgl2: false,
  hardwareConcurrency: 2,
  deviceMemoryGb: 2,
  touchPoints: 5,
});
assert.equal(constrained.tier, 'constrained');
assert.equal(constrained.supported, true);
assert.ok(constrained.warnings.length >= 2);

const unsupported = evaluateCadCapabilities({
  webAssembly: true,
  sharedArrayBuffer: false,
  crossOriginIsolated: false,
  webgl: true,
  webgl2: true,
});
assert.equal(unsupported.tier, 'unsupported');
assert.equal(unsupported.supported, false);
assert.ok(unsupported.reasons.some((reason) => reason.includes('SharedArrayBuffer')));

let factoryCalls = 0;
const runtimeObject = { id: 'runtime-1' };
const loader = new LazyCadRuntimeLoader(() => full, async () => {
  factoryCalls++;
  await Promise.resolve();
  return runtimeObject;
});
assert.equal(factoryCalls, 0, 'runtime factory must not run at loader construction');
assert.equal(loader.getState().status, 'idle');

const [first, second] = await Promise.all([loader.load(), loader.load()]);
assert.equal(first, runtimeObject);
assert.equal(second, runtimeObject);
assert.equal(factoryCalls, 1, 'concurrent lazy load must instantiate runtime once');
assert.equal(loader.getState().status, 'ready');
assert.equal(await loader.load(), runtimeObject);
assert.equal(factoryCalls, 1);

let unsupportedFactoryCalls = 0;
const unsupportedLoader = new LazyCadRuntimeLoader(() => unsupported, async () => {
  unsupportedFactoryCalls++;
  return {};
});
await assert.rejects(() => unsupportedLoader.load(), CadRuntimeUnsupportedError);
assert.equal(unsupportedFactoryCalls, 0, 'unsupported device must not start heavy runtime factory');
assert.equal(unsupportedLoader.getState().status, 'unsupported');

assert.equal(cadEditorPath('p 1'), '/cad/projects/p%201');
assert.equal(cadViewerPath('v/2'), '/cad/view/v%2F2');
assert.deepEqual(parseCadClientRoute('/'), { kind: 'standalone' });
assert.deepEqual(parseCadClientRoute('/cad/'), { kind: 'standalone' });
assert.deepEqual(parseCadClientRoute('/cad/projects/p%201'), { kind: 'editor', projectId: 'p 1' });
assert.deepEqual(parseCadClientRoute('/cad/view/v%2F2'), { kind: 'viewer', versionId: 'v/2' });

console.log('ASA-CAD M1B capability/lazy-loader/routes PASS');
