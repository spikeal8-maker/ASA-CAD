import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCadId, type CadBodyId, type CadFeatureId } from '../../src';
import { createEmptyCadDocument } from '../../src/contracts/document';
import {
  partReferenceScene,
  REFERENCE_EMPTY_HALF_SIZE,
} from '../../src/web/viewport/PartReferenceGeometry';
import {
  resolveViewportPickCandidates,
  type ViewportPickCandidate,
} from '../../src/web/viewport/ViewportPicking';
import { ViewportSelectionController } from '../../src/web/viewport/ViewportSelectionController';

// C1: origin planes come from the CadDocument, not from a hard-coded picture.
const part = createEmptyCadDocument('part', { title: 'Деталь 1' });
assert.equal(part.kind, 'part');
const empty = partReferenceScene(part.kind === 'part' ? part.origin.planes : [], null);
assert.deepEqual(empty.planes.map((plane) => plane.id), ['XY', 'XZ', 'YZ']);
assert.equal(empty.halfSize, REFERENCE_EMPTY_HALF_SIZE);
const plane = (id: string) => empty.planes.find((item) => item.id === id)!;
assert.ok(plane('XY').corners.every((corner) => corner[2] === 0), 'XY must lie in z=0');
assert.ok(plane('XZ').corners.every((corner) => corner[1] === 0), 'XZ must lie in y=0');
assert.ok(plane('YZ').corners.every((corner) => corner[0] === 0), 'YZ must lie in x=0');
assert.deepEqual(plane('XY').normal, [0, 0, 1]);
assert.deepEqual(empty.axes.map((axis) => axis.id), ['X', 'Y', 'Z']);
assert.deepEqual(
  [empty.bounds.minX, empty.bounds.maxX, empty.bounds.minZ, empty.bounds.maxZ],
  [-REFERENCE_EMPTY_HALF_SIZE, REFERENCE_EMPTY_HALF_SIZE, -REFERENCE_EMPTY_HALF_SIZE, REFERENCE_EMPTY_HALF_SIZE],
);
const large = partReferenceScene(['XY'], { minX: -200, minY: -10, minZ: 0, maxX: 120, maxY: 10, maxZ: 10 });
assert.ok(large.halfSize >= 250, 'origin planes must frame a large body');
const small = partReferenceScene(['XY'], { minX: -30, minY: -20, minZ: 0, maxX: 30, maxY: 20, maxZ: 10 });
assert.ok(small.halfSize >= 30 && small.halfSize <= 40, 'origin planes must stay proportional to a small body');

// Picking: planes are ordinary/Sketch-support targets; model geometry wins under the cursor.
const body = createCadId<CadBodyId>('body');
const feature = createCadId<CadFeatureId>('feature');
const xz: ViewportPickCandidate = { kind: 'base-plane', planeId: 'XZ', distance: 5, point: [10, 0, 10] };
const xy: ViewportPickCandidate = { kind: 'base-plane', planeId: 'XY', distance: 7, point: [10, 4, 0] };
const bodyHit: ViewportPickCandidate = { kind: 'body', meshId: 'm', bodyId: body, sourceFeatureId: feature, distance: 9, point: [0, 0, 0] };
const faceHit: ViewportPickCandidate = { kind: 'face', meshId: 'm', bodyId: body, sourceFeatureId: feature, faceIndex: 1, distance: 5, point: [10, 0, 10] };

const ordinaryPlanes = resolveViewportPickCandidates([xy, xz], 'none');
assert.equal(ordinaryPlanes.primary?.kind === 'base-plane' ? ordinaryPlanes.primary.planeId : null, 'XZ', 'nearest plane wins over empty space');
assert.equal(ordinaryPlanes.ambiguous, false);
const throughPlane = resolveViewportPickCandidates([xz, bodyHit], 'none');
assert.equal(throughPlane.primary?.kind, 'body', 'a body behind a translucent plane must stay selectable');
assert.equal(throughPlane.ambiguous, false, 'a datum plane must not make a body pick ambiguous');
const coplanar = resolveViewportPickCandidates([xz, faceHit], 'face');
assert.equal(coplanar.primary?.kind, 'face', 'a face coplanar with a datum plane wins');
assert.equal(resolveViewportPickCandidates([xz], 'face').primary?.kind, 'base-plane', 'origin plane is a valid Sketch support pick');
assert.equal(resolveViewportPickCandidates([xz], 'edge').primary, null, 'edge commands must ignore origin planes');
assert.equal(resolveViewportPickCandidates([xz], 'sketch').primary, null, 'Sketch overlay picking must ignore origin planes');

// Selection: body and origin plane are mutually exclusive ordinary selections.
const selection = new ViewportSelectionController('none');
selection.select(xz);
assert.equal(selection.getSnapshot().selectedPlaneId, 'XZ');
assert.equal(selection.getSnapshot().selectedBodyId, null);
selection.select(bodyHit);
assert.equal(selection.getSnapshot().selectedPlaneId, null, 'body pick must clear plane selection');
assert.equal(selection.getSnapshot().selectedBodyId, body);
selection.setExternalPlaneSelection('YZ');
assert.equal(selection.getSnapshot().selectedPlaneId, 'YZ');
selection.setMode('face');
assert.equal(selection.getSnapshot().selectedPlaneId, 'YZ', 'command start keeps the selected plane as Sketch support');
selection.select(xz);
assert.equal(selection.getSnapshot().selectedCommandCandidate?.kind, 'base-plane');

// Boundaries: geometry stays pure; the Three adapter only consumes it.
const geometry = readFileSync('src/web/viewport/PartReferenceGeometry.ts', 'utf8');
assert.doesNotMatch(geometry, /from ['"]three/, 'reference geometry must remain Three-independent');
assert.doesNotMatch(geometry, /HTMLElement|PointerEvent|localStorage/, 'reference geometry must remain DOM/persistence-free');
const layer = readFileSync('src/web/viewport/ViewportReferenceLayer.ts', 'utf8');
assert.doesNotMatch(layer, /from ['"]three/, 'reference layer must receive Three lazily from CadViewport');
assert.match(layer, /planeId: record\.plane\.id/, 'plane picks must cross the seam as document plane names');
const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
assert.match(viewport, /createViewportReferenceLayer\(/, 'CadViewport must draw the origin through the reference layer');
assert.match(viewport, /createViewportMeshLayer\(/, 'B-Rep meshes must stay in the extracted mesh layer');
const stage = readFileSync('src/web/PartModelStage.tsx', 'utf8');
assert.doesNotMatch(stage, /Новая деталь|stage-message/, 'the empty Part splash must not return');
assert.match(stage, /referencePlanes=\{props\.document\.origin\.planes\}/, 'origin planes must come from the CadDocument');

console.log('C1 viewport reference PASS (document origin planes + plane picking/selection + pure geometry boundary)');
