import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const revision='fusion-sketch-parity-002';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const digestPattern=/^[0-9a-f]{64}$/;
export const actionEvidencePaths={
 report:'prototypes/fusion/evidence/fusion-live-sketch-actions-checks.json',
 test:'prototypes/fusion/tests/live-sketch-actions-browser.mjs',
 helper:'prototypes/fusion/tests/live-sketch-actions-harness.mjs',
 binding:'src/web/M2CadUiActions.ts',
};

export function buildActionSourceSnapshot(repoRoot){
 const baseHead='cb7006efe7a108bc85bcf99d3a3e4a9c2f73568b';
 const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{cwd:repoRoot,encoding:'utf8',maxBuffer:4*1024*1024}).trim().split(/\r?\n/).filter(Boolean);
 const inputs=file=>/^(src|build|vendor)\//.test(file)
  || /^prototypes\/fusion\/live\/.*\.(tsx?|css|svg|html|js|cjs)$/.test(file)
  || /^prototypes\/fusion\/native-(reference\.v5\.json|labels\.ru\.v5\.js)$/.test(file)
  || /^prototypes\/fusion\/reference_capture\/(sketch-active-ui-20261106|sketch-native-reference\.v1|sketch-native-observations-20261106)\.json$/.test(file);
 const paths=[...new Set([...git('diff','--no-ext-diff','--name-only',baseHead,'--','src','build','vendor','prototypes/fusion'),...git('ls-files','--others','--exclude-standard')])].filter(inputs).sort();
 const descriptor={baseHead,delta:paths.map(file=>({path:file,sha256:existsSync(resolve(repoRoot,file))?hash(readFileSync(resolve(repoRoot,file))):null}))};
 return {descriptor,sha256:hash(JSON.stringify(descriptor))};
}

/** These are evidence-admission rules, never execution or solver substitutes. */
export function evaluateActionReport(candidate,expected){
 const rejected=[];
 if(!candidate||typeof candidate!=='object')rejected.push('MISSING_OR_INVALID_REPORT');
 if(candidate?.schemaVersion!==2)rejected.push('SCHEMA_VERSION_MISMATCH');
 if(candidate?.parityRevision!==revision)rejected.push('PARITY_REVISION_MISMATCH');
 if(candidate?.referenceCaptureSha256!==expected.referenceCaptureSha256)rejected.push('REFERENCE_CAPTURE_SHA256_MISMATCH');
 if(candidate?.status!=='PASS')rejected.push('REPORT_NOT_PASS');
 if(!Array.isArray(candidate?.pageErrors)||candidate.pageErrors.length!==0)rejected.push('PAGE_ERRORS_NOT_EMPTY_OR_MISSING');
 for(const field of ['testSourceSha256','helperSourceSha256','bindingSourceSha256']){
  if(!digestPattern.test(expected[field]||'')||candidate?.[field]!==expected[field])rejected.push(field.toUpperCase()+'_MISMATCH');
 }
 if(!digestPattern.test(expected.sourceSnapshotSha256||'')||candidate?.sourceSnapshotSha256!==expected.sourceSnapshotSha256)rejected.push('SOURCE_SNAPSHOT_MISMATCH');
 if(!candidate?.sourceSnapshotDescriptor||JSON.stringify(candidate.sourceSnapshotDescriptor)!==JSON.stringify(expected.sourceSnapshotDescriptor))rejected.push('SOURCE_DESCRIPTOR_MISMATCH');
 else if(hash(JSON.stringify(candidate.sourceSnapshotDescriptor))!==candidate.sourceSnapshotSha256)rejected.push('SOURCE_DESCRIPTOR_CHECKSUM_MISMATCH');
 if(!Array.isArray(candidate?.actions))rejected.push('ACTIONS_MISSING');
 else if(candidate.actions.some(action=>!action||typeof action.cadUiAction!=='string'))rejected.push('ACTIONS_INVALID');
 else if(new Set(candidate.actions.map(action=>action.cadUiAction)).size!==candidate.actions.length)rejected.push('DUPLICATE_ACTION');
 return {accepted:rejected.length===0,rejected};
}

export function readActionEvidence(repoRoot,referenceCaptureSha256){
 const digest=file=>existsSync(resolve(repoRoot,file))?hash(readFileSync(resolve(repoRoot,file))):null;
 const snapshot=buildActionSourceSnapshot(repoRoot);
 const expected={referenceCaptureSha256,testSourceSha256:digest(actionEvidencePaths.test),helperSourceSha256:digest(actionEvidencePaths.helper),bindingSourceSha256:digest(actionEvidencePaths.binding),sourceSnapshotSha256:snapshot.sha256,sourceSnapshotDescriptor:snapshot.descriptor};
 let bytes=null,report=null,parseError=null;
 try{bytes=readFileSync(resolve(repoRoot,actionEvidencePaths.report));report=JSON.parse(bytes);}
 catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;if(error instanceof SyntaxError)parseError=error.message;}
 const admission=evaluateActionReport(report,expected);
 return {report,summary:{file:actionEvidencePaths.report,sha256:bytes?hash(bytes):null,reportStatus:parseError?'INVALID_JSON':report?.status||'MISSING',acceptedForCoverage:admission.accepted,rejectionReasons:admission.rejected,expected,sourceSnapshotSha256:report?.sourceSnapshotSha256||null,sourceSnapshotDescriptor:report?.sourceSnapshotDescriptor||null,...(parseError?{parseError}:{}),policy:'Admission requires current test, helper and CadUiAction binding hashes, the canonical descriptor and exact current build-input delta from the reviewed baseline, this native capture/revision, PASS and no page errors. Each action also needs solver, persistence, Undo/Redo and Save/Open assertions. The recorded source snapshot is provenance, not visual acceptance.'}};
}

export function actionEvidenceProof(evidence,id){
 if(!evidence.summary.acceptedForCoverage)return null;
 const index=evidence.report.actions.findIndex(action=>action.cadUiAction===id);
 if(index<0)return null;
 const action=evidence.report.actions[index];
 if(action.status!=='PASS'||typeof action.inputRoute!=='string'||!action.inputRoute.trim())return null;
 if(!['solverVerified','persisted','undoRedo','saveReopen'].every(key=>action[key]===true))return null;
 if(!Array.isArray(action.pageErrors)||action.pageErrors.length!==0)return null;
 return {cadUiAction:id,status:'PASS',inputRoute:action.inputRoute,evidence:[{file:evidence.summary.file,sha256:evidence.summary.sha256,jsonPointer:'/actions/'+index}],scope:'The named public route and persisted solver/history scenario passed; full native semantic or visual equivalence is not asserted.'};
}
