/* Run with node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs
 * prototypes/fusion/tests/sketch-matrix-proof-gate.mjs.
 * Synthetic report objects stay in memory; no browser evidence is created. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateBrowserReport,matrix} from '../live/generate-sketch-matrix.mjs';
import {evaluateActionReport,actionEvidenceProof} from '../live/sketchActionEvidence.mjs';

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
const sourceDescriptor={baseHead:'a'.repeat(40),delta:[{path:'src/in-memory-test.ts',sha256:'b'.repeat(64)}]};
const sourceSnapshotSha256=createHash('sha256').update(JSON.stringify(sourceDescriptor)).digest('hex');
const expectedActionSources={referenceCaptureSha256:capture,testSourceSha256:'1'.repeat(64),helperSourceSha256:'2'.repeat(64),bindingSourceSha256:'3'.repeat(64),sourceSnapshotSha256,sourceSnapshotDescriptor:sourceDescriptor};
const action={cadUiAction:'constraint.parallel',status:'PASS',inputRoute:'Public Constraints menu',solverVerified:true,persisted:true,undoRedo:true,saveReopen:true,pageErrors:[]};
const actionReport={...current,...expectedActionSources,actions:[action]};
assert.equal(evaluateActionReport(actionReport,expectedActionSources).accepted,true);
const invalidActionReports=[
 null,{...actionReport,schemaVersion:1},{...actionReport,parityRevision:'old'},
 {...actionReport,referenceCaptureSha256:'0'.repeat(64)},{...actionReport,status:'FAIL'},
 {...actionReport,pageErrors:['error']},{...actionReport,pageErrors:undefined},
 {...actionReport,testSourceSha256:'0'.repeat(64)},{...actionReport,helperSourceSha256:'0'.repeat(64)},
 {...actionReport,bindingSourceSha256:'0'.repeat(64)},{...actionReport,sourceSnapshotSha256:null},
 {...actionReport,actions:undefined},{...actionReport,actions:[action,action]},
 {...actionReport,sourceSnapshotSha256:'f'.repeat(64)},{...actionReport,sourceSnapshotDescriptor:null},
 {...actionReport,sourceSnapshotDescriptor:{...sourceDescriptor,baseHead:'c'.repeat(40)}},
 {...actionReport,sourceSnapshotDescriptor:{...sourceDescriptor,delta:[]}},
 {...actionReport,actions:[null]}, {...actionReport,actions:[{}]},
];
for(const candidate of invalidActionReports)assert.equal(evaluateActionReport(candidate,expectedActionSources).accepted,false);
const actionEvidence=report=>({report,summary:{acceptedForCoverage:true,file:'in-memory-test-only',sha256:'5'.repeat(64)}});
assert.equal(actionEvidenceProof(actionEvidence(actionReport),'constraint.parallel').status,'PASS');
assert.equal(actionEvidenceProof(actionEvidence(actionReport),'constraint.tangent'),null);
assert.equal(actionEvidenceProof({...actionEvidence(actionReport),summary:{acceptedForCoverage:false}},'constraint.parallel'),null);
const incompleteActions=[
 {...action,status:'FAIL'},{...action,inputRoute:''},{...action,solverVerified:false},
 {...action,persisted:false},{...action,undoRedo:false},{...action,saveReopen:false},
 {...action,pageErrors:['error']},{...action,pageErrors:undefined},
];
for(const incomplete of incompleteActions)assert.equal(actionEvidenceProof(actionEvidence({...actionReport,actions:[incomplete]}),'constraint.parallel'),null);
assert.equal(evaluateActionReport(actionReport,{...expectedActionSources,sourceSnapshotSha256:'e'.repeat(64)}).accepted,false,'A changed current build snapshot rejects old PASS');
assert.equal(evaluateActionReport({...actionReport,sourceSnapshotSha256:'f'.repeat(64)},{...expectedActionSources,sourceSnapshotSha256:'f'.repeat(64)}).accepted,false,'Descriptor checksum cannot be forged by matching metadata alone');
const actionGateCases=1+invalidActionReports.length+3+incompleteActions.length+2;
console.log(JSON.stringify({status:'PASS',gateCases:9,actionGateCases,notPresented:matrix.counts.notPresentedActiveSketch,physicalPromotions:[33,24,19],browserEvidenceAccepted:matrix.browserEvidence.acceptedForCoverage,actionEvidenceAccepted:matrix.actionBrowserEvidence.acceptedForCoverage,matrixWritten:false}));
