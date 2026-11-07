/* Reproduce with: node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs prototypes/fusion/live/generate-sketch-matrix.mjs
 * --check validates without replacing the matrix. The existing output filename
 * is retained for consumers; its content now uses schemaVersion 2. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sketchReference,activeSketchReference,sketchPanels,sketchLabels,sketchNativeActions,dimensionActionIds,flattenSketchItems,observedPromotedIds} from './sketchCommands.ts';
import {sketchIcons} from './SketchIcons.ts';
import {readActionEvidence,actionEvidenceProof,actionEvidencePaths} from './sketchActionEvidence.mjs';

const revision='fusion-sketch-parity-002';
const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const historicalPath='prototypes/fusion/reference_capture/sketch-native-reference.v1.json';
const referencePath='prototypes/fusion/reference_capture/sketch-active-ui-20261106.json';
const observationPath='prototypes/fusion/reference_capture/sketch-native-observations-20261106.json';
const sourcePath='prototypes/fusion/live/sketchCommands.ts';
const ribbonPath='prototypes/fusion/live/SketchRibbon.tsx';
const iconPath='prototypes/fusion/live/SketchIcons.ts';
const browserTest='prototypes/fusion/tests/live-sketch-workspace-browser.mjs';
const browserEvidencePath='prototypes/fusion/evidence/fusion-live-sketch-workspace-checks.json';
const bindingPath='src/web/M2CadUiActions.ts';
const behavior003Task='FUSION-SKETCH-TOOLS-BEHAVIOR-003';
const behavior003NativePath='prototypes/fusion/evidence/line-003-native-observed.json';
const behavior003TestPath='prototypes/fusion/tests/live-fusion-line-behavior-browser.mjs';
const behavior003ProposalPath='prototypes/fusion/evidence/line-003-product-contract.proposed.patch';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>readFileSync(resolve(repoRoot,file));
const digest=file=>sha256(read(file));
const observations=JSON.parse(read(observationPath));
const referenceCaptureSha256=digest(referencePath);
assert.equal(activeSketchReference.activeToolbarTabId,'SketchTab','The current native source must be active Sketch');
assert.deepEqual(activeSketchReference.errors,[],'The active native exporter must have no recorded errors');
const bindingBytes=read(bindingPath),bindingText=bindingBytes.toString('utf8');
const sourceHashes={activeCapture:referenceCaptureSha256,historicalInventory:digest(historicalPath),observations:digest(observationPath),presentation:digest(sourcePath),ribbon:digest(ribbonPath),icons:digest(iconPath),browserTest:digest(browserTest)};

/** A previous implementation's PASS must never become evidence for this revision. */
export function evaluateBrowserReport(candidate,expectedCaptureSha256){
 const rejected=[];
 if(!candidate||typeof candidate!=='object')rejected.push('MISSING_OR_INVALID_REPORT');
 if(candidate?.schemaVersion!==2)rejected.push('SCHEMA_VERSION_MISMATCH');
 if(candidate?.parityRevision!==revision)rejected.push('PARITY_REVISION_MISMATCH');
 if(candidate?.referenceCaptureSha256!==expectedCaptureSha256)rejected.push('REFERENCE_CAPTURE_SHA256_MISMATCH');
 if(candidate?.status!=='PASS')rejected.push('REPORT_NOT_PASS');
 if(!Array.isArray(candidate?.pageErrors)||candidate.pageErrors.length!==0)rejected.push('PAGE_ERRORS_NOT_EMPTY_OR_MISSING');
 return {accepted:rejected.length===0,rejected};
}
let reportBytes=null,report=null,reportParseError=null;
try{reportBytes=read(browserEvidencePath);report=JSON.parse(reportBytes);}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;if(error instanceof SyntaxError)reportParseError=error.message;}
const acceptance=evaluateBrowserReport(report,referenceCaptureSha256),reportPassed=acceptance.accepted;
const supplementalActionEvidence=readActionEvidence(repoRoot,referenceCaptureSha256);
const behavior003NativeBytes=read(behavior003NativePath),behavior003Native=JSON.parse(behavior003NativeBytes);
const behavior003NativeSha256=sha256(behavior003NativeBytes);
assert.equal(behavior003Native.task,behavior003Task);
assert.equal(behavior003Native.status,'OBSERVED_NATIVE_UI');
assert.equal(behavior003Native.version,'2706.1.17');
assert.ok(Array.isArray(behavior003Native.lifecycle)&&Array.isArray(behavior003Native.captures));
assert.ok(behavior003Native.captures.every(capture=>typeof capture.file==='string'&&/^[0-9a-f]{64}$/.test(capture.sha256)));

const behavior003ReportPath='prototypes/fusion/evidence/line-003/checks.json';
const behavior003HelperPath='prototypes/fusion/tests/live-sketch-actions-harness.mjs';
const behavior003OwnerPath='prototypes/fusion/live/LiveSketchLineTool.ts';
const behavior003Expected={
 sourceSnapshotSha256:supplementalActionEvidence.summary.expected.sourceSnapshotSha256,
 sourceSnapshotDescriptor:supplementalActionEvidence.summary.expected.sourceSnapshotDescriptor,
 testSourceSha256:digest(behavior003TestPath),helperSourceSha256:digest(behavior003HelperPath),lineToolSourceSha256:digest(behavior003OwnerPath),
 caseIds:[...read(behavior003TestPath).toString('utf8').matchAll(/\bawait runCase\('([^']+)'/g)].map(match=>match[1]),
};
assert.ok(behavior003Expected.caseIds.length>0,'Focused behavior cases must be explicit in the current test');
/** Functional checks can be admitted without accepting native semantic parity. */
export function evaluateBehavior003Report(candidate,expected){
 const rejected=[];
 if(!candidate||typeof candidate!=='object')rejected.push('MISSING_OR_INVALID_REPORT');
 if(candidate?.schemaVersion!==1||candidate?.behaviorRevision!==behavior003Task)rejected.push('BEHAVIOR_SCHEMA_OR_REVISION_MISMATCH');
 if(candidate?.status!=='BLOCKED'||candidate?.executableChecksStatus!=='PASS'||candidate?.acceptanceStatus!=='BLOCKED')rejected.push('FUNCTIONAL_CHECKS_NOT_PASS_OR_ACCEPTANCE_NOT_BLOCKED');
 if(candidate?.behaviorParityAccepted!==false||candidate?.visualParityAccepted!==false)rejected.push('UNSUPPORTED_PARITY_CLAIM');
 for(const [key,reason] of [['pageErrors','PAGE_ERRORS'],['requestFailures','REQUEST_FAILURES'],['cleanupErrors','CLEANUP_ERRORS']])if(!Array.isArray(candidate?.[key])||candidate[key].length)rejected.push(reason+'_NOT_EMPTY_OR_MISSING');
 if(candidate?.ownedServersClosed!==true)rejected.push('OWNED_SERVERS_NOT_CLOSED');
 if(candidate?.installedOriginsTouched!==false||candidate?.userProfileUsed!==false)rejected.push('ISOLATION_NOT_CONFIRMED');
 for(const [key,reason] of [['sourceSnapshotSha256','SOURCE_SNAPSHOT'],['testSourceSha256','TEST_SOURCE'],['helperSourceSha256','HELPER_SOURCE'],['lineToolSourceSha256','LINE_OWNER_SOURCE']])if(candidate?.[key]!==expected[key])rejected.push(reason+'_MISMATCH');
 const descriptor=candidate?.sourceSnapshotDescriptor;
 if(!descriptor||sha256(JSON.stringify(descriptor))!==expected.sourceSnapshotSha256||JSON.stringify(descriptor)!==JSON.stringify(expected.sourceSnapshotDescriptor))rejected.push('SOURCE_DESCRIPTOR_MISMATCH');
 const cases=Array.isArray(candidate?.cases)?candidate.cases:[],ids=cases.map(item=>item?.id);
 if(ids.length!==expected.caseIds.length||new Set(ids).size!==ids.length||expected.caseIds.some(id=>!ids.includes(id)))rejected.push('FOCUSED_CASE_SET_MISMATCH');
 if(!cases.length||cases.some(item=>item?.status!=='PASS'))rejected.push('FOCUSED_CASE_NOT_PASS');
 return {accepted:rejected.length===0,rejected};
}
let behavior003ReportBytes=null,behavior003Report=null,behavior003ReportParseError=null;
try{behavior003ReportBytes=read(behavior003ReportPath);behavior003Report=JSON.parse(behavior003ReportBytes);}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;if(error instanceof SyntaxError)behavior003ReportParseError=error.message;}
const behavior003ReportGate=evaluateBehavior003Report(behavior003Report,behavior003Expected);
const behavior003CandidateEvidence={
 status:behavior003ReportGate.accepted?'FUNCTIONAL_CHECKS_PASS_ACCEPTANCE_BLOCKED':behavior003ReportBytes?'NOT_VERIFIED_FOR_FINAL_SOURCE':'NOT_RUN_FOR_FINAL_SOURCE',
 report:behavior003ReportBytes?behavior003ReportPath:null,sha256:behavior003ReportBytes?sha256(behavior003ReportBytes):null,
 reportStatus:behavior003ReportParseError?'INVALID_JSON':behavior003Report?.status??'MISSING',
 acceptedForFunctionalChecks:behavior003ReportGate.accepted,acceptedForBehavior003:false,rejectionReasons:behavior003ReportGate.rejected,
 expected:behavior003Expected,
 test:{file:behavior003TestPath,sha256:behavior003Expected.testSourceSha256},
 checks:behavior003ReportGate.accepted?behavior003Report.cases.map((item,index)=>({id:item.id,label:item.label,status:item.status,jsonPointer:'/cases/'+index})):[],
 sourceSnapshotAtGeneration:{sha256:behavior003Expected.sourceSnapshotSha256,descriptorPointer:'/actionBrowserEvidence/expected/sourceSnapshotDescriptor'},
 ...(behavior003ReportParseError?{parseError:behavior003ReportParseError}:{}),
 policy:'Only the exact current build-input descriptor, test, helper and owner hashes with all explicit focused cases passing and no browser/cleanup errors admit these functional checks. Full native behavior and visual acceptance remain blocked. Historical single-Line and 24-action proof never establish continuous native Line parity.',
};
const behavior003ExcludedNativeCaptures=behavior003Native.captures.filter(capture=>/^(48|52|53)-/.test(capture.file)).map(({file,sha256})=>({
 file,sha256,reason:file.startsWith('48-')?'Native focus changed; this capture does not confirm entered numeric values.':'Native window partly off screen; excluded from behavior and visual proof.',
}));

const browserEvidence={
 file:browserEvidencePath,sha256:reportBytes?sha256(reportBytes):null,
 reportStatus:reportParseError?'INVALID_JSON':reportBytes?report?.status??'STATUS_MISSING':'MISSING',
 schemaVersion:report?.schemaVersion??null,parityRevision:report?.parityRevision??null,
 referenceCaptureSha256:report?.referenceCaptureSha256??null,expectedReferenceCaptureSha256:referenceCaptureSha256,
 sourceSnapshotSha256:report?.sourceSnapshotSha256??null,testSourceSha256:report?.testSourceSha256??null,
 currentTestSourceSha256:sourceHashes.browserTest,testSourceMatchesCurrent:typeof report?.testSourceSha256==='string'?report.testSourceSha256===sourceHashes.browserTest:null,
 acceptedForCoverage:reportPassed,rejectionReasons:acceptance.rejected,
 ...(reportParseError?{parseError:reportParseError}:{}),
 policy:'Only schemaVersion 2, this parityRevision, the exact active capture SHA-256, status PASS, and an empty pageErrors array admit browser evidence. Each individual claim also needs its scenario or exact menu-row assertion. Matching capture metadata is not a claim of exact candidate source SHA or visual parity.',
};
const evidencePointer=pointer=>({file:browserEvidencePath,sha256:browserEvidence.sha256,jsonPointer:pointer});
const samePath=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((part,index)=>part===b[index]);
const pathKey=(panel,path)=>[panel,...path].join('/');

function normalizeVisible(controls){
 const result=[];
 for(const control of controls){
  if(control.isVisible!==true)continue;
  if(control.type==='SeparatorControl'&&(!result.length||result.at(-1).type==='SeparatorControl'))continue;
  result.push({...control,children:normalizeVisible(control.children||[])});
 }
 while(result.at(-1)?.type==='SeparatorControl')result.pop();
 return result;
}
const activeByPath=new Map(),visibleByPath=new Map();
function indexCapture(controls,panel,path,pointer,parentVisible=true){
 controls.forEach((control,index)=>{
  const visible=parentVisible&&control.isVisible===true,next=[...path,control.id];
  activeByPath.set(pathKey(panel,next),{control,visible,pointer:`${pointer}/${index}`});
  indexCapture(control.children||[],panel,next,`${pointer}/${index}/children`,visible);
 });
}
function indexVisible(controls,panel,path=[]){
 controls.forEach(control=>{const next=[...path,control.id];visibleByPath.set(pathKey(panel,next),control);indexVisible(control.children||[],panel,next);});
}
activeSketchReference.tab.panels.forEach((panel,index)=>{
 indexCapture(panel.controls,panel.id,[],`/tab/panels/${index}/controls`,panel.isVisible===true);
 if(panel.isVisible)indexVisible(normalizeVisible(panel.controls),panel.id);
});
const rowToken=control=>control.type==='SeparatorControl'?'separator':`${control.type==='DropDownControl'?'dropdown':'command'}:${control.commandDefinition?.id||control.id}`;
const presentedToken=item=>item.separator?'separator':`${item.nativeType==='DropDownControl'?'dropdown':'command'}:${item.nativeId||item.id}`;
function verifyMenuPresentation(items,controls,panel,path=[]){
 assert.deepEqual(items.map(presentedToken),controls.map(rowToken),`Visible menu composition: ${pathKey(panel,path)}`);
 for(const control of controls)if(control.type==='DropDownControl')verifyMenuPresentation(items.find(item=>item.id===control.id)?.children||[],control.children||[],panel,[...path,control.id]);
}
for(const panel of sketchPanels){
 const active=activeSketchReference.tab.panels.find(candidate=>candidate.id===panel.id);
 assert.ok(active,`Active panel is missing: ${panel.id}`);
 verifyMenuPresentation(panel.menuItems,normalizeVisible(active.controls),panel.id);
 assert.deepEqual(panel.promoted.map(item=>item.nativeId),observations.promotedIds2048[panel.id],`Physical promotions: ${panel.id}`);
 assert.deepEqual(observedPromotedIds[panel.id],observations.promotedIds2048[panel.id]);
}
assert.equal(Object.values(observations.promotedIds2048).flat().length,33);

const captures={};
function capture(id,file,details={}){
 const relative=`${observations.captureDirectory}/${file}`;
 if(!existsSync(resolve(repoRoot,relative)))return null;
 const bytes=read(relative);
 assert.equal(bytes.subarray(1,4).toString('ascii'),'PNG',`Expected PNG: ${relative}`);
 const value={id,file:relative,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),nativeDpi:observations.nativeDpi,...details};
 captures[id]=value;return value;
}
capture('ribbon',observations.primaryCapture,{purpose:'Physical promoted commands and the native top layout'});
capture('create','fusion-parity-native-create-menu-2048-dpi110.png',{bounds:observations.observedBounds.createMenu,rowHeight:23});
const popupReferences={
 RectangleDropDown:['rectangle',245],CircleDropDown:['circle',245],ArcDropDown:['arc',161],PolygonDropDown:['polygon',199],SlotDropDown:['slot',189],SplineDropDown:['spline',182],ProjectIncludeDropDown:['project',189],
};
for(const [id,[name,width]] of Object.entries(popupReferences))capture(id,`fusion-parity-native-${name}-menu-2048-dpi110.png`,{menuWidth:width,rowHeight:23,overlapWithParent:6});
for(const [id,name,width] of [['SketchModifyPanel','modify',187],['SketchConstraintsPanel','constraints',224],['InspectPanel','inspect',270]])capture(id,`fusion-parity-native-${name}-menu-2048-dpi110.png`,{menuWidth:width,rowHeight:23});
for(const [id,name] of [['ConfigurePanel','configure'],['InsertPanel','insert'],['PartAssemblePanel','assemble'],['SelectPanel','select'],['StopSketchPanel','finish']])capture(id,`fusion-parity-native-${name}-menu-2048-dpi110.png`,{rowHeight:23});
capture('SketchChamferDropDown','fusion-parity-native-chamfer-menu-2048-dpi110.png',{rowHeight:23,purpose:'Three visible native chamfer variants; exact popup bounds are not independently measured'});
capture('finishedSolid','fusion-parity-native-finished-solid-2048-dpi110.png',{purpose:'Native Finish Sketch result; no extrusion'});
capture('cubeLookAt','fusion-parity-native-cube-look-at-2048-dpi110.png',{purpose:'Native normal-to-sketch ViewCube state'});
capture('lineHover',observations.observedInteractions.lineTooltip.short,{bounds:{x:144,y:137,width:64,height:28}});
capture('lineTooltip',observations.observedInteractions.lineTooltip.expanded,{bounds:{x:144,y:134,width:385,height:418}});
capture('lineActive',observations.observedInteractions.lineActive,{purpose:'Native Line active state; it is not proof of ASA gesture equivalence'});
capture('rectanglePreview',observations.observedInteractions.rectanglePreview,{purpose:'Native Rectangle command preview'});
capture('circleDiameter',observations.observedGeometry.source,{purpose:'Native circle diameter and sketch geometry reference'});
capture('linearDimensions','fusion-parity-native-linear-dimensions-2048-dpi110.png',{purpose:'Native persistent 60.00 and 40.00 dimensions created through D in the separate test document; manually placed annotations.'});
for(const [index,layout] of observations.responsiveCaptures.entries()){
 const evidence=capture(`responsive${index}`,layout.file,{requestedWidth:layout.requestedWidth,limitation:layout.limitation||null});
 assert.ok(evidence,`Missing responsive original ${layout.file}`);
 assert.equal(evidence.width,layout.width);assert.equal(evidence.height,layout.height);
}
const screenshotRef=(id,region)=>captures[id]?{id,file:captures[id].file,sha256:captures[id].sha256,...(region?{region}:{} )}:null;
const physicalGroups={SketchCreatePanel:{x:148,width:304},SketchModifyPanel:{x:452,width:210},SketchConstraintsPanel:{x:662,width:604},ConfigurePanel:{x:1266,width:160},InspectPanel:{x:1426,width:111},InsertPanel:{x:1537,width:161},PartAssemblePanel:{x:1698,width:113},SelectPanel:{x:1811,width:93},StopSketchPanel:{x:1904,width:144}};
function menuCaptureId(panel,path){return path.length?path.at(-1):panel==='SketchCreatePanel'?'create':panel;}
function screenshotsFor(control,panel,path,presented,promoted){
 const refs=[];
 if(promoted){const group=physicalGroups[panel];refs.push(screenshotRef('ribbon',{...group,y:64,height:70,scope:'Group containing the identified promoted command'}));}
 if(presented)refs.push(screenshotRef(menuCaptureId(panel,path)));
 if(control.type==='DropDownControl'&&presented)refs.push(screenshotRef(control.id));
 const id=control.commandDefinition?.id||control.id;
 if(id==='DrawPolyline'&&presented)refs.push(screenshotRef('lineHover'),screenshotRef('lineTooltip'),screenshotRef('lineActive'));
 if(id==='ShapeRectangleTwoPoint'&&presented)refs.push(screenshotRef('rectanglePreview'));
 if(['CircleCenterRadius','SketchDimension'].includes(id)&&presented)refs.push(screenshotRef('circleDiameter'));
 if(id==='SketchDimension'&&presented)refs.push(screenshotRef('linearDimensions'));
 if(id==='SketchStop'&&presented)refs.push(screenshotRef('finishedSolid'));
 return [...new Map(refs.filter(Boolean).map(ref=>[ref.id,ref])).values()];
}
function containerEvidence(panel,path=[]){
 if(!reportPassed)return null;
 if(!path.length){const index=Array.isArray(report.menus)?report.menus.indexOf(panel):-1;return index<0?null:evidencePointer(`/menus/${index}`);}
 const index=Array.isArray(report.nativeSubmenus)?report.nativeSubmenus.findIndex(menu=>menu.panel===panel&&samePath(menu.path,path)):-1;
 return index<0?null:evidencePointer(`/nativeSubmenus/${index}`);
}
function rowEvidence(control,panel,path){
 if(!reportPassed||!Array.isArray(report.menuRows))return null;
 const id=path.at(-1)||panel,token=rowToken(control);
 const container=report.menuRows.findIndex(menu=>menu.id===id&&menu.level===path.length&&Array.isArray(menu.rows)&&menu.rows.includes(token));
 if(container<0)return null;
 return evidencePointer(`/menuRows/${container}/rows/${report.menuRows[container].rows.indexOf(token)}`);
}
function measuredMenu(panel,path=[]){
 if(!reportPassed||!Array.isArray(report.menuRows))return null;
 const id=path.at(-1)||panel,index=report.menuRows.findIndex(menu=>menu.id===id&&menu.level===path.length);
 if(index<0||!report.menuRows[index].bounds)return null;
 return {boundsCssPx:report.menuRows[index].bounds,evidence:evidencePointer(`/menuRows/${index}/bounds`),status:'BROWSER_MEASURED_NOT_VISUALLY_ACCEPTED'};
}
function verifyBindings(actions){
 for(const id of actions)if(!bindingText.includes(`'${id}': binding(`))throw new Error(`Missing existing CadUiAction binding: ${id}`);
 return {status:actions.length?'VERIFIED_EXISTING_BINDING':'NO_ACTION_BINDING',actions,source:bindingPath,sourceSha256:sha256(bindingBytes),scope:'Static binding presence; no operation or native semantic parity is implied.'};
}
function actionBehavior(id){
 const supplemental=actionEvidenceProof(supplementalActionEvidence,id);
 if(supplemental)return supplemental;
 const proof={
  'sketch.line':{observed:report?.scenarioA?.constructionLine===true,pointers:['/scenarioA/constructionLine','/scenarioA/entities'],route:'Promoted Line; pointer creation and persisted construction line.'},
  'sketch.rectangle':{observed:typeof report?.scenarioA?.rectangle==='string'&&report.scenarioA.rectangle.includes('two pointer clicks'),pointers:['/scenarioA/rectangle'],route:'Promoted Rectangle; two pointer clicks, persisted 60 × 40 mm geometry and dimensions.'},
  'sketch.circle':{observed:typeof report?.scenarioA?.circle==='string'&&report.scenarioA.circle.includes('two pointer clicks'),pointers:['/scenarioA/circle'],route:'Promoted Circle; two pointer clicks, diameter dimension and annotation edit.'},
  'sketch.arc':{observed:report?.arc?.threeRealClicks===true,pointers:['/arc'],route:'Create → Arc → Center Point Arc; center, start and end pointer clicks, radius assertion.'},
  'sketch.finish':{observed:report?.saveReopen===true,pointers:['/saveReopen'],route:'Finish Sketch; return to Solid, save, reopen and edit again.'},
  'dimension.linear':{observed:typeof report?.scenarioA?.rectangle==='string'&&report.scenarioA.rectangle.includes('driving line dimensions'),pointers:['/scenarioA/rectangle'],route:'Existing linear dimension through the authored context command section; committed line dimensions.'},
  'dimension.diameter':{observed:typeof report?.scenarioA?.circle==='string'&&report.scenarioA.circle.includes('driving dimension'),pointers:['/scenarioA/circle'],route:'Existing diameter dimension through context commands; annotation edit. Native Dimension leaf dispatch is a separate assertion.'},
  'constraint.horizontal':{observed:report?.scenarioA?.horizontalConstraint===true,pointers:['/scenarioA/horizontalConstraint'],route:'Existing horizontal constraint through authored context commands; solved and persisted constraint.'},
  'constraint.vertical':{observed:report?.verticalConstraint===true,pointers:['/verticalConstraint'],route:'Horizontal/Vertical promoted tool → authored chooser → Vertical; resulting constraint assertion.'},
  'sketch.construction':{observed:report?.scenarioA?.constructionLine===true,pointers:['/scenarioA/constructionLine'],route:'Sketch Palette construction control; persisted construction flag.'},
 }[id];
 const passed=reportPassed&&proof?.observed===true;
 return {cadUiAction:id,status:passed?'PASS':'NOT_BROWSER_TESTED',...(passed?{inputRoute:proof.route,evidence:proof.pointers.map(evidencePointer)}:{reason:!reportPassed?'No accepted browser report for this parity revision and exact active capture.':'No successful action behavior assertion in the accepted report.'})};
}
function behaviorSummary(actions){
 const results=actions.map(actionBehavior),passed=results.filter(result=>result.status==='PASS').length;
 return {status:!actions.length?'NOT_APPLICABLE':passed===actions.length?'PASS':passed?'MIXED_BROWSER_RESULTS':'NOT_BROWSER_TESTED',actions:results};
}
function nativeCoverage(control,panel,path,actions,presented){
 const isCommand=control.type==='CommandControl',isDropdown=control.type==='DropDownControl';
 const row=presented?rowEvidence(control,panel,path):null;
 const opened=isDropdown&&presented?containerEvidence(panel,[...path,control.id]):null;
 const behavior=behaviorSummary(actions);
 const status=!presented?'NOT_PRESENTED_ACTIVE_SKETCH':isDropdown?(opened?'PASS_OPENED_ORDER':'NOT_BROWSER_TESTED'):isCommand&&!actions.length?(row?'PASS_DISABLED':'NOT_BROWSER_TESTED'):isCommand?behavior.status:'NOT_APPLICABLE';
 return {
  status,browserScenario:browserTest,behaviorBrowserScenarios:[browserTest,actionEvidencePaths.test],bindingVerification:verifyBindings(actions),
  menu:{status:!presented?'NOT_PRESENTED_ACTIVE_SKETCH':row?'PASS_EXACT_ROW':'NOT_BROWSER_TESTED',evidence:row?[row]:[],popupOpened:opened?[opened]:[],scope:'The exact native row must occur in the matching recorded v2 menuRows. Merely opening its parent menu never proves a hidden command or disabled state.'},
  ...(isCommand&&!actions.length?{disabledState:{status:!presented?'NOT_PRESENTED_ACTIVE_SKETCH':row?'PASS_DISABLED':'NOT_BROWSER_TESTED',evidence:row?[row]:[],scope:'The v2 browser check validates that each presented unmapped leaf is disabled. It does not execute unsupported operations.'}}:{}),
  behavior:presented?behavior:{status:'NOT_PRESENTED_ACTIVE_SKETCH',actions:[]},
  visual:{status:'NOT_ACCEPTED',scope:'Browser behavior and menu presence do not establish pixel parity or owner visual acceptance.'},
 };
}
const actionIds=id=>id==='SketchDimension'?[...dimensionActionIds]:id==='ConstraintHorizontalVertical'?['constraint.horizontal','constraint.vertical']:sketchNativeActions[id]?[sketchNativeActions[id]]:[];
/** Behavior-003 admission is independent of historical binding/menu/action proof. */
function behavior003For(type,actions){
 const line=actions.includes('sketch.line'),command=type==='CommandControl';
 const status=!command?'MENU_ONLY':line?'BLOCKED_PRODUCT_CONTRACT':actions.length?'DEFERRED_UNTIL_LINE_ACCEPTANCE':'UNSUPPORTED_COMMON_CONTRACT';
 return {
  status,nativeSemanticParity:'NOT_ACCEPTED',candidateValidation:line?behavior003CandidateEvidence.status:'NOT_RUN_FOR_FINAL_SOURCE',legacyProofAdmitted:false,
  reason:!command?'Presentation structure only; no geometry command behavior.':line?'Continuous Line is implemented, but missing product contracts prevent full native acceptance.':actions.length?'Existing action retained; behavior-003 implementation and acceptance wait for Line acceptance.':'No mapped existing CadUiAction is available for this native command.',
  ...(line?{
   implementation:'CONTINUOUS_FSM_IMPLEMENTED_NOT_ACCEPTED',
   nativeEvidence:[{file:behavior003NativePath,sha256:behavior003NativeSha256,jsonPointer:'/lifecycle'}],
   blockers:['ATOMIC_SEGMENT_UNDO','ABSOLUTE_DRIVING_ANGLE','INTERIOR_DRIVING_ANGLE','PERSISTED_ORIGIN_MIDPOINT_REFERENCES','TANGENT_ARC_CHAIN'],
  }:{}),
 };
}
const countBehavior003=entries=>entries.reduce((counts,entry)=>{const status=entry.behavior003.status;counts[status]=(counts[status]||0)+1;return counts;},{});
const semanticNotes={
 DrawPolyline:'Existing ASA line/chain tool. The tooltip describes supported segments; native drag-to-arc semantics are not implemented or claimed equivalent.',
 CircleCenterRadius:'Native command name is Center Diameter Circle. ASA uses the existing center and radius-point circle operation; the icon identity does not change its parameters.',
 ArcCenterTwoPoint:'Menu-only Create → Arc → Center Point Arc route uses the existing center → start → end operation. There is no extra promoted Arc button.',
 ConstraintHorizontalVertical:'A labelled authored chooser exposes two existing CadUiActions; this is not native automatic orientation inference.',
 ConstraintFix:'Partial support: fixes an eligible unfixed line. Unfix is not implemented or advertised.',
 SketchDimension:'Native toolbar/Create entry is a leaf. Primary/D chooses an enabled diameter, radius, linear, horizontal, vertical or angular action. The six distinct actions remain authored search/context extensions; no native dimension submenu is claimed.',
 ConstraintSmooth:'Present in active API and in the Constraints menu, but absent from the physical 2048-pixel toolbar capture. API promotion and physically visible promotion are distinct.',
 SelectCommand:'Canvas selection uses the existing product interaction path. No matching toolbar CadUiAction exists, so this toolbar entry remains disabled.',
 SelectionToolsDropDown:'Active API composition is known. The observed native floating submenu extends beyond the 2048-pixel client boundary; no complete client screenshot or full popup pixel measurement is claimed.',
 NewAssemblyFromPartCommand:'The active native command and observed menu row are Add To Assembly, translated as Добавить в сборку. The historical command ID is retained.',
};
function svgEvidence(item,type,nativeId){
 if(type==='SeparatorControl')return {key:null,source:null,status:'NOT_APPLICABLE'};
 if(type==='DropDownControl')return {key:item?.icon||null,source:null,status:'NOT_RENDERED_NATIVE_DROPDOWN',note:'The observed native dropdown row has no icon. Historical search inventory artwork is separate.'};
 const separate=`prototypes/fusion/live/sketch-icons/${nativeId}.svg`;
 if(existsSync(resolve(repoRoot,separate)))return {key:item?.icon||null,source:separate,sha256:digest(separate),status:'INDEPENDENT_EDITABLE_SVG',viewBox:[0,0,50,50],nativePixelParity:'NOT_ACCEPTED'};
 return {key:item?.icon||null,source:item?.icon?iconPath:null,status:item?.icon?'INLINE_VECTOR_ONLY':'MISSING',note:'No separate observed-reference SVG has been authored for this inventory-only glyph.',nativePixelParity:'UNVERIFIED'};
}
function interactionsFor(control,panel,path,actions,presented,promoted){
 const id=control.commandDefinition?.id||control.id,isDropdown=control.type==='DropDownControl';
 if(!presented)return {status:'NOT_PRESENTED_ACTIVE_SKETCH',hover:null,click:null,popup:null};
 const childCapture=isDropdown?screenshotRef(control.id):null;
 const tooltipProof=reportPassed&&id==='DrawPolyline'&&report.lineTooltip?.short===true&&report.lineTooltip?.expanded===true;
 return {
  status:'PRESENTED',
  hover:{...(id==='DrawPolyline'?{candidateIllustration:{file:'prototypes/fusion/live/sketch-icons/line-instructions.svg',sha256:digest('prototypes/fusion/live/sketch-icons/line-instructions.svg'),kind:'Independently authored instruction drawing, not copied native tooltip art'}}:{}),native:id==='DrawPolyline'?[screenshotRef('lineHover'),screenshotRef('lineTooltip')].filter(Boolean):[],candidate:isDropdown?'Opens the native submenu; no side split arrow.':promoted?(id==='DrawPolyline'?'Short label followed by expanded authored Line guidance.':'Short Russian label; unavailable reason where applicable.'):'Normal menu-row highlight.',test:tooltipProof?{status:'PASS',evidence:[evidencePointer('/lineTooltip')]}:{status:'NOT_BROWSER_TESTED'}},
  click:{route:promoted?'promoted toolbar or menu':isDropdown?'menu navigation':'menu leaf',cadUiActions:actions,enabledSource:actions.length?'existing CadUiAction.enabled':isDropdown?'menu navigation':'disabled',...(id==='SketchDimension'?{nativeLeaf:true,dispatchProof:reportPassed&&report.nativeDimensionLeaf===true?{status:'PASS',evidence:[evidencePointer('/nativeDimensionLeaf')]}:{status:'NOT_BROWSER_TESTED'}}:{})},
  popup:{kind:isDropdown?'native-dropdown':id==='ConstraintHorizontalVertical'?'authored-orientation-chooser':'none',nativeScreenshots:childCapture?[childCapture]:[],nativeObservation:isDropdown?(childCapture?'SCREENSHOT_AND_ACTIVE_API':'ACTIVE_API_ONLY'):id==='ConstraintHorizontalVertical'?'AUTHORED_EXTENSION':'LEAF',candidateRowHeightCssPx:23,candidateMeasured:isDropdown?measuredMenu(panel,[...path,control.id]):null},
 };
}
const nativeEntries=[];
function collect(controls,panel,path,pointer){
 controls.forEach((control,index)=>{
  const nativeId=control.commandDefinition?.id||control.id,next=[...path,control.id];
  const item=flattenSketchItems(panel.items).find(candidate=>candidate.id===control.id&&!candidate.authored);
  const active=activeByPath.get(pathKey(panel.id,next)),presented=visibleByPath.has(pathKey(panel.id,next));
  const physical=observations.promotedIds2048[panel.id].includes(nativeId),actions=actionIds(nativeId);
  const isCommand=control.type==='CommandControl',isDropdown=control.type==='DropDownControl';
  if(item?.icon.startsWith('sketch.native.')&&!sketchIcons[item.icon])throw new Error(`Missing authored SVG key: ${nativeId}`);
  if((isCommand||isDropdown)&&!sketchLabels[nativeId])throw new Error(`Missing Russian label: ${nativeId}`);
  const shown=flattenSketchItems(panel.menuItems).find(candidate=>candidate.id===control.id&&!candidate.authored);
  const artwork=svgEvidence(item,control.type,nativeId);
  nativeEntries.push({
   nativeId,controlId:control.id,type:control.type,nativeName:active?.control.commandDefinition?.name??control.commandDefinition?.name??control.name??null,
   labelRu:control.type==='SeparatorControl'?null:shown?.label||sketchLabels[nativeId],
   originalScreenshots:screenshotsFor(control,panel.id,path,presented,physical),
   svgKey:artwork.key,svgSource:artwork.source,svg:artwork,
   dimensions:{nativeDpi:observations.nativeDpi,nativeToolbarGroup:physical?{...physicalGroups[panel.id],y:64,height:70}:null,nativeMenuRowHeightPixels:presented&&control.type!=='SeparatorControl'?23:null,candidateMenuRowHeightCssPx:presented?(control.type==='SeparatorControl'?2:23):null,candidateMenuContainer:presented?measuredMenu(panel.id,path):null,candidateSvgViewportCssPx:physical?40:presented&&isCommand?18:null,candidateToolbarButtonCssPx:physical?{width:46,height:44}:null,policy:'Native screenshot pixels and browser CSS pixels are recorded separately. Exact individual glyph pixel bounds and full pixel parity are not asserted.'},
   menu:{panelId:panel.id,path:next,sourceOrder:control.order??index,presentedInActiveSketch:presented,activeApiVisible:active?.visible??null,absenceReason:presented?null:active?.visible?'NORMALIZED_SEPARATOR':active?'HIDDEN_IN_ACTIVE_CAPTURE':'NOT_IN_ACTIVE_CAPTURE'},
   nativePromoted:sketchReference.panels.find(source=>source.id===panel.id).promotedControlIds.includes(nativeId),
   activeApiPromoted:activeSketchReference.tab.panels.find(source=>source.id===panel.id).promotedControlIds.includes(nativeId),
   observedPromoted2048:physical,cadUiActions:actions,
   bindingMode:nativeId==='ConstraintHorizontalVertical'?'authored-chooser':nativeId==='SketchDimension'?'contextual-native-leaf-and-search-context-extensions':actions.length?'existing-cad-ui-action':isDropdown?'submenu':isCommand?'disabled':'separator',
   support:actions.length?(nativeId==='ConstraintFix'?'partial':'existing-core-operation'):isCommand?'unsupported':isDropdown?'menu-only':'not-applicable',
   runtimeEnabledSource:actions.length?'CadUiAction.enabled; native isEnabled is never an execution gate':isCommand?'false':'menu navigation',
   ...(semanticNotes[nativeId]?{semanticNote:semanticNotes[nativeId]}:{}),
   interaction:interactionsFor(control,panel.id,path,actions,presented,physical),
   evidence:{historicalComposition:{file:historicalPath,sha256:sourceHashes.historicalInventory,jsonPointer:`${pointer}/${index}`},activeComposition:active?{file:referencePath,sha256:referenceCaptureSha256,jsonPointer:active.pointer}:null,physicalPromotion:physical?{file:observationPath,sha256:sourceHashes.observations,jsonPointer:`/promotedIds2048/${panel.id}`} :null,localization:isCommand||isDropdown?{kind:'authored Russian translation',file:sourcePath}:null},
   testCoverage:nativeCoverage(control,panel.id,path,actions,presented),
   behavior003:behavior003For(control.type,actions),
  });
  if(control.controls?.length)collect(control.controls,panel,next,`${pointer}/${index}/controls`);
 });
}
sketchReference.panels.forEach((source,index)=>collect(source.controls,sketchPanels[index],[],`/panels/${index}/controls`));
function authoredCoverage(item){
 const orientation=item.nativeId==='ConstraintHorizontalVertical'&&reportPassed&&report.verticalConstraint===true;
 return {bindingVerification:verifyBindings([item.actionId]),browserScenario:browserTest,behavior:actionBehavior(item.actionId),presentation:{status:orientation?'PASS_CHOOSER_OPENED':'NOT_BROWSER_TESTED',evidence:orientation?[evidencePointer('/verticalConstraint')]:[],scope:item.nativeId==='SketchDimension'?'The six authored dimension actions are search/context extensions, not native submenu rows. Behavior proof from one route does not prove search or every action.':'Only an explicitly tested authored chooser or context route may be claimed.'}};
}
const authoredExtensions=sketchPanels.flatMap(panel=>flattenSketchItems(panel.items).filter(item=>item.authored&&!item.separator).map(item=>({
 id:item.id,nativeParentId:item.nativeId??null,labelRu:item.label,svgKey:item.icon,svgSource:iconPath,cadUiAction:item.actionId,
 surfaces:item.nativeId==='ConstraintHorizontalVertical'?['authored-orientation-chooser','search']:['search','context-command-section where exposed'],
 nativeMenuRow:false,nativeScreenshot:null,evidence:{kind:'authored presentation of existing CadUiAction',file:sourcePath,nativeMenuParity:false},testCoverage:authoredCoverage(item),
 behavior003:behavior003For('CommandControl',[item.actionId]),
})));
const responsive=observations.responsiveCaptures.map((layout,index)=>({
 ...layout,screenshot:screenshotRef(`responsive${index}`),nativeDpi:observations.nativeDpi,
 physicallyVisiblePromoted:sketchPanels.map((panel,panelIndex)=>({panelId:panel.id,nativeIds:observations.promotedIds2048[panel.id].slice(0,layout.visibleGroupCounts[panelIndex])})),
 totalVisiblePromoted:layout.visibleGroupCounts.reduce((a,b)=>a+b,0),
 candidatePolicy:'Hide observed tail promotions while keeping all commands in their dropdown menus. No horizontal toolbar scrollbar. Exact intermediate native breakpoints are not established.',
 browserParityStatus:'NOT_ACCEPTED',
}));
const allActions=[...new Set([...nativeEntries.flatMap(entry=>entry.cadUiActions),...authoredExtensions.map(entry=>entry.cadUiAction)])];
const matrix={
 schemaVersion:2,parityRevision:revision,referenceFile:referencePath,referenceCaptureSha256,
 historicalInventoryFile:historicalPath,observationFile:observationPath,sourceHashes,browserEvidence,
 actionBrowserEvidence:{...supplementalActionEvidence.summary,browserScenario:actionEvidencePaths.test},
 behavior003:{
  task:behavior003Task,status:'BLOCKED_PRODUCT_CONTRACT',lineAcceptance:'NOT_ACCEPTED',remainingActionWork:'DEFERRED_UNTIL_LINE_ACCEPTANCE',
  coverage:{nativeEntries:nativeEntries.length,authoredExtensions:authoredExtensions.length,nativeStatuses:countBehavior003(nativeEntries),authoredStatuses:countBehavior003(authoredExtensions)},
  candidateEvidence:behavior003CandidateEvidence,
  nativeEvidence:{
   status:behavior003Native.status,file:behavior003NativePath,sha256:behavior003NativeSha256,applicationVersion:behavior003Native.version,
   recordedCaptureCount:behavior003Native.captures.length,lifecycleObservationCount:behavior003Native.lifecycle.length,
   excludedFromBehaviorAndVisualProof:behavior003ExcludedNativeCaptures,
   boundary:behavior003Native.evidenceBoundary,captureDirectory:behavior003Native.captureDirectory,
   lifecycle:behavior003Native.lifecycle,caveats:behavior003Native.caveats,
   captures:behavior003Native.captures.map(({file,sha256})=>({file,sha256})),
   hashPolicy:'PNG hashes are recorded by the native observation manifest; this generator hashes that manifest and does not independently re-read the external screenshots.',
  },
  lineImplementation:{
   status:'CONTINUOUS_FSM_IMPLEMENTED_NOT_ACCEPTED',owner:behavior003OwnerPath,ownerSha256:digest(behavior003OwnerPath),
   bridge:'prototypes/fusion/live/LiveLineInteraction.ts',bridgeSha256:digest('prototypes/fusion/live/LiveLineInteraction.ts'),
   states:['IDLE','AWAITING_START','PREVIEW_SEGMENT','NUMERIC_INPUT','COMMITTING_SEGMENT','CONTINUING_CHAIN','CLOSING_CHAIN','CANCELLED'],
   commandPath:['sketch.line','constraint.coincident','constraint.horizontal','constraint.vertical','dimension.linear'],
   continuation:'Previous endpoint to new start through real Coincident; await the existing stage solver and use its solved endpoint before continuation.',
   numericLength:'Existing driving dimension.linear when explicitly entered or locked.',numericAbsoluteAngle:'Transient coordinate control only; no absolute driving angular dimension.',
   numericChainInteriorAngle:'Display and coordinate input use the interior angle to the reverse previous solved segment; the nearest raw-pointer branch is selected. Native interior 120 degrees produces global +60 or -60 after a rightward segment. No native interior driving dimension is persisted: the common forward-line angular contract would store and annotate the complement 60 degrees, with ref order controlling the signed branch. angleDriving remains false.',
   orientationInference:'A current accepted snap may persist real H/V together with endpoint or closure Coincident. Null snap context never infers H/V.',
   history:'Every changed execute is a separate Undo frame; no atomic segment transaction is claimed.',
   originAndMidpoint:'Coordinate snap only; no persisted origin/midpoint reference is claimed.',tangentArc:'Observed natively; not implemented through a fake or alternative document model.',
   blockers:['ATOMIC_SEGMENT_UNDO','ABSOLUTE_DRIVING_ANGLE','INTERIOR_DRIVING_ANGLE','PERSISTED_ORIGIN_MIDPOINT_REFERENCES','TANGENT_ARC_CHAIN'],
   productProposal:{file:behavior003ProposalPath,sha256:digest(behavior003ProposalPath),status:'PROPOSED_NOT_IMPLEMENTED'},
  },
  policy:'This additive behavior-003 section covers every catalogue row without replacing schemaVersion 2 binding/menu proof. Existing proof fields retain their original admission rules; their PASS is never inherited as behavior-003 acceptance. Other action-backed tools stay deferred until Line acceptance.',
 },
 source:{applicationVersion:activeSketchReference.applicationVersion,capturedUTC:activeSketchReference.capturedUTC,activeWorkspaceId:activeSketchReference.activeWorkspaceId,activeToolbarTabId:activeSketchReference.activeToolbarTabId},
 scope:'Observed active native Sketch presentation and existing CadUiAction bindings. Physical promotions, active API visibility, authored extensions, browser execution and visual acceptance are separate claims.',
 captureStatePolicy:'The full historical inventory is retained. Fresh active isVisible determines menu presentation with separator normalization; observed screenshots determine physical promotions. Native isEnabled never enables ASA operations.',
 nativeDpiPolicy:observations.nativeDpiPolicy,
 counts:{nativePanels:sketchReference.panels.length,nativeControls:nativeEntries.length,nativeCommands:nativeEntries.filter(e=>e.type==='CommandControl').length,nativeDropdowns:nativeEntries.filter(e=>e.type==='DropDownControl').length,nativeSeparators:nativeEntries.filter(e=>e.type==='SeparatorControl').length,activePresentedControls:nativeEntries.filter(e=>e.menu.presentedInActiveSketch).length,notPresentedActiveSketch:nativeEntries.filter(e=>!e.menu.presentedInActiveSketch).length,physicallyVisiblePromoted2048:33,separateSvgSources:new Set(nativeEntries.map(e=>e.svg.source).filter(path=>path?.endsWith('.svg'))).size,authoredActionRows:authoredExtensions.length,uniqueCadUiActions:allActions.length},
 panels:sketchPanels.map(panel=>({nativeId:panel.id,labelRu:panel.label,groupKey:panel.key,historicalApiPromotedIds:sketchReference.panels.find(source=>source.id===panel.id).promotedControlIds,activeApiPromotedIds:activeSketchReference.tab.panels.find(source=>source.id===panel.id).promotedControlIds,observedPromotedIds2048:observations.promotedIds2048[panel.id],presentedPromoted:panel.promoted.map(item=>({nativeId:item.nativeId,svgKey:item.icon,authoredPromotion:false})),presentedMenu:panel.menuItems.map(presentedToken),bounds2048:{...physicalGroups[panel.id],y:64,height:70},testCoverage:{status:containerEvidence(panel.id)?'PASS_OPENED_ORDER':'NOT_BROWSER_TESTED',evidence:containerEvidence(panel.id)?[containerEvidence(panel.id)]:[],scope:'Matching v2 report opens this panel and compares observed promotions and active-native menu order. This does not assert pixel parity.'}})),
 nativeEntries,authoredExtensions,screenshots:captures,responsive,
 authoredPresentationDecisions:[
  'The observed 2048 toolbar has 33 promoted commands. Create has six, Modify four and Constraints twelve in one large row. No extra promoted Arc is added.',
  'Center-point Arc is invoked through Create → Arc → Center Point Arc; supported semantics remain center → start → end.',
  'Sketch Dimension is a native leaf and contextual primary/D action. Six distinct existing dimension actions remain in authored search/context routes, not a fabricated native submenu.',
  'Horizontal/Vertical retains an explicitly authored two-action chooser. Native automatic orientation inference is not claimed.',
  'Delete, construction and point-on-curve remain authored search/context extensions and are excluded from native ribbon menus.',
  'Russian labels are complete; menu width may exceed the measured English reference to avoid truncation.',
  'At native 1600 and 1375 pixels, the observed 24 and 19 toolbar tools are shown without horizontal scrolling. The 1366-named reference is actually 1375 pixels wide.',
  'Separate SVGs are independent editable redraws; unobserved inventory glyphs may remain inline and are explicitly marked. No proprietary resource file is copied.',
  'Every unavailable operation remains disabled. A hidden API control is NOT_PRESENTED_ACTIVE_SKETCH, never PASS_DISABLED by inference from its parent menu.',
 ],
 visualReference:{status:'NOT_ACCEPTED',nativeOriginalsAvailable:true,primary:screenshotRef('ribbon'),observedBounds:observations.observedBounds,geometry:observations.observedGeometry,policy:observations.nativeDpiPolicy},
};
export {matrix};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check');
 if(!check)writeFileSync(new URL('./sketch-command-matrix.v1.json',import.meta.url),`${JSON.stringify(matrix,null,2)}\n`);
 console.log(JSON.stringify({counts:matrix.counts,browserEvidence,behaviorStatus:behaviorSummary(allActions).status,originalScreenshots:Object.keys(captures).length,matrixWritten:!check}));
}
