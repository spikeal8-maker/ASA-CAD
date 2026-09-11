import assert from 'node:assert/strict';
import { createCadId, type CadBodyId, type CadFeatureId } from '../../src';
import {
  resolveViewportPickCandidates,
  type ViewportPickCandidate,
} from '../../src/web/viewport/ViewportPicking';
import { ViewportSelectionController } from '../../src/web/viewport/ViewportSelectionController';

const bodyA = createCadId<CadBodyId>('body');
const bodyB = createCadId<CadBodyId>('body');
const feature = createCadId<CadFeatureId>('feature');

const candidates: ViewportPickCandidate[] = [
  { kind: 'body', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, distance: 10, point: [0, 0, 0] },
  // duplicate triangle hit on the same semantic body; nearer one must win
  { kind: 'body', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, distance: 9, point: [0, 0, 0] },
  { kind: 'body', meshId: 'mesh-b', bodyId: bodyB, sourceFeatureId: feature, distance: 9.05, point: [0, 0, 0] },
  { kind: 'face', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, faceIndex: 2, distance: 4, point: [1, 2, 3] },
  { kind: 'face', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, faceIndex: 2, distance: 3.5, point: [1, 2, 3] },
  { kind: 'face', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, faceIndex: 3, distance: 12, point: [1, 2, 4] },
  { kind: 'edge', meshId: 'mesh-a', bodyId: bodyA, sourceFeatureId: feature, segmentIndex: 6, distance: 2, point: [2, 2, 2] },
];

const bodyResolution = resolveViewportPickCandidates(candidates, 'none');
assert.equal(bodyResolution.ordered.length, 2, 'duplicate body triangle hits must collapse');
assert.equal(bodyResolution.primary?.kind, 'body');
assert.equal(bodyResolution.primary?.kind === 'body' ? bodyResolution.primary.bodyId : null, bodyA);
assert.equal(bodyResolution.primary?.distance, 9);
assert.equal(bodyResolution.ambiguous, true, 'nearby distinct bodies should expose ambiguity instead of being silently lost');

const faceResolution = resolveViewportPickCandidates(candidates, 'face');
assert.equal(faceResolution.ordered.length, 2, 'duplicate triangles from one face must collapse');
assert.equal(faceResolution.primary?.kind, 'face');
assert.equal(faceResolution.primary?.kind === 'face' ? faceResolution.primary.faceIndex : null, 2);
assert.equal(faceResolution.primary?.distance, 3.5);
assert.equal(faceResolution.ambiguous, false, 'farther face behind primary should not be treated as cursor ambiguity');

const edgeResolution = resolveViewportPickCandidates(candidates, 'edge');
assert.equal(edgeResolution.primary?.kind, 'edge');
assert.equal(edgeResolution.ordered.length, 1);

const noSketchCandidate = resolveViewportPickCandidates(candidates, 'sketch');
assert.equal(noSketchCandidate.primary, null, 'Sketch mode must not accidentally consume B-Rep body/face/edge hits');

const selection = new ViewportSelectionController('none');
selection.setHover(bodyResolution.primary);
assert.equal(selection.getSnapshot().hoverCandidate?.kind, 'body');
selection.select(bodyResolution.primary);
assert.equal(selection.getSnapshot().selectedBodyId, bodyA);
assert.equal(selection.getSnapshot().hoverCandidate, null);

selection.setMode('face');
selection.setHover(faceResolution.primary);
selection.select(faceResolution.primary);
assert.equal(selection.getSnapshot().selectedCommandCandidate?.kind, 'face');
assert.equal(selection.getSnapshot().selectedBodyId, bodyA, 'command selection must not destroy ordinary body selection');

selection.setMode('edge');
selection.select(edgeResolution.primary);
assert.equal(selection.getSnapshot().selectedCommandCandidate?.kind, 'edge');
selection.resetCommandSelection();
assert.equal(selection.getSnapshot().selectedCommandCandidate, null);

console.log('M2O O8 viewport picking PASS (candidate dedupe/rank/ambiguity + pure selection controller)');
