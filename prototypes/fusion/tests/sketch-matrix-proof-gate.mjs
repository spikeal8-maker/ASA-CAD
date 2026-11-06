/* Run with node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs
 * prototypes/fusion/tests/sketch-matrix-proof-gate.mjs.
 * Synthetic report objects stay in memory; no browser evidence is created. */
import assert from 'node:assert/strict';
import {evaluateBrowserReport,matrix} from '../live/generate-sketch-matrix.mjs';

const capture=matrix.referenceCaptureSha256;
const current={schemaVersion:2,parityRevision:'fusion-sketch-parity-002',referenceCaptureSha256:capture,status:'PASS',pageErrors:[]};
assert.equal(evaluateBrowserReport(current,capture).accepted,true);
for(const invalid of [
 {status:'PASS',pageErrors:[]},
 {...current,schemaVersion:1},
 {...current,parityRevision:'fusion-sketch-parity-001'},
 {...current,referenceCaptureSha256:'0'.repeat(64)},
 {...current,status:'FAIL'},
 {...current,pageErrors:['rendering error']},
 {...current,pageErrors:undefined},
 null,
])assert.equal(evaluateBrowserReport(invalid,capture).accepted,false);

const byId=id=>matrix.nativeEntries.find(entry=>entry.nativeId===id);
for(const entry of matrix.nativeEntries.filter(entry=>!entry.menu.presentedInActiveSketch)){
 assert.equal(entry.testCoverage.status,'NOT_PRESENTED_ACTIVE_SKETCH',entry.nativeId);
 assert.equal(entry.testCoverage.menu.status,'NOT_PRESENTED_ACTIVE_SKETCH',entry.nativeId);
 assert.notEqual(entry.testCoverage.disabledState?.status,'PASS_DISABLED',entry.nativeId);
 assert.equal(entry.originalScreenshots.length,0,entry.nativeId+' must not claim a screenshot shows a hidden control');
}
assert.equal(byId('DrawCVMSpline3D').menu.presentedInActiveSketch,false);
assert.equal(byId('DrawCVMSpline5D').menu.presentedInActiveSketch,true);
assert.equal(byId('ConstraintSmooth').menu.presentedInActiveSketch,true);
assert.equal(byId('ConstraintSmooth').activeApiPromoted,true);
assert.equal(byId('ConstraintSmooth').observedPromoted2048,false);
assert.equal(byId('ArcCenterTwoPoint').observedPromoted2048,false);
assert.equal(byId('SketchDimension').interaction.popup.kind,'none');
assert.equal(matrix.counts.physicallyVisiblePromoted2048,33);
assert.deepEqual(matrix.responsive.map(layout=>layout.totalVisiblePromoted),[24,19]);
assert.equal(matrix.responsive[1].requestedWidth,1366);
assert.equal(matrix.responsive[1].screenshot.file.endsWith('layout-1366-dpi110.png'),true);
assert.equal(matrix.responsive[1].width,1375);
assert.equal(matrix.visualReference.status,'NOT_ACCEPTED');
assert.equal(matrix.nativeEntries.every(entry=>entry.testCoverage.visual.status==='NOT_ACCEPTED'),true);
console.log(JSON.stringify({status:'PASS',gateCases:9,notPresented:matrix.counts.notPresentedActiveSketch,physicalPromotions:[33,24,19],browserEvidenceAccepted:matrix.browserEvidence.acceptedForCoverage,matrixWritten:false}));
