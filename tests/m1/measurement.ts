import assert from 'node:assert/strict';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';
import {
  CadApplicationImpl,
  OpenCascadeMeasurementAdapter,
  OpenCascadePartRuntime,
  createEmptyCadDocument,
  type CadSketchId,
} from '../../src';

const oc = await initOpenCascade();
const runtime = new OpenCascadePartRuntime(oc);
const app = new CadApplicationImpl(createEmptyCadDocument('part'), runtime);

const sketch = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
const sketchId = sketch.createdIds?.[0] as CadSketchId;
await app.execute({
  id: 'sketch.rectangle',
  payload: { sketchId, origin: [-5, -10], width: 10, height: 20 },
});
await app.execute({
  id: 'feature.extrude',
  payload: { sketchId, distance: 5 },
});

const measurement = new OpenCascadeMeasurementAdapter(runtime);
const result = await measurement.measure(app.getDocument(), { kind: 'model-summary' });
assert.equal(result.kind, 'model-summary');
assert.deepEqual(result.bounds.min.map((value) => Math.round(value * 1e6) / 1e6), [-5, -10, 0]);
assert.deepEqual(result.bounds.max.map((value) => Math.round(value * 1e6) / 1e6), [5, 10, 5]);
assert.ok(Math.abs(result.volume - 1000) < 1e-5, `expected volume 1000, got ${result.volume}`);
assert.equal(result.featureCount, 1);

app.dispose();
console.log('ASA-CAD M1 measurement adapter PASS');
