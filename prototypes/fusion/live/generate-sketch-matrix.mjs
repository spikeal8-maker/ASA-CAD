/* Reproduce with: node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs prototypes/fusion/live/generate-sketch-matrix.mjs
 * Add --check to validate and summarize without replacing the current matrix. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sketchReference,sketchPanels,sketchLabels,sketchNativeActions,dimensionActionIds,flattenSketchItems} from './sketchCommands.ts';
import {sketchIcons} from './SketchIcons.ts';

const referencePath='prototypes/fusion/reference_capture/sketch-native-reference.v1.json';
const sourcePath='prototypes/fusion/live/sketchCommands.ts';
const browserTest='prototypes/fusion/tests/live-sketch-workspace-browser.mjs';
const browserEvidencePath='prototypes/fusion/evidence/fusion-live-sketch-workspace-checks.json';
const bindingPath='src/web/M2CadUiActions.ts';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const bindingBytes=readFileSync(new URL('../../../src/web/M2CadUiActions.ts',import.meta.url));
const bindingText=bindingBytes.toString('utf8');
let reportBytes=null,report=null,reportParseError=null;
try{reportBytes=readFileSync(new URL('../evidence/fusion-live-sketch-workspace-checks.json',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
if(reportBytes){try{report=JSON.parse(reportBytes.toString('utf8'));}catch(error){reportParseError=error.message;}}
const reportPassed=report?.status==='PASS'&&Array.isArray(report.pageErrors)&&report.pageErrors.length===0;
const browserEvidence={
 file:browserEvidencePath,sha256:reportBytes?sha256(reportBytes):null,
 reportStatus:reportParseError?'INVALID_JSON':reportBytes?report?.status??'STATUS_MISSING':'MISSING',
 acceptedForCoverage:reportPassed,
 ...(reportParseError?{parseError:reportParseError}:{}),
 policy:'A PASS report with an empty pageErrors array and the relevant scenario fields is required for every browser claim. Menu presence, disabled-state checks, and actual operations are reported separately. The SHA-256 identifies the exact report bytes; it is not an assertion of source-revision equivalence.',
};
const evidencePointer=pointer=>({file:browserEvidencePath,sha256:browserEvidence.sha256,jsonPointer:pointer});
const samePath=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((part,index)=>part===b[index]);
function containerEvidence(panelId,path=[]){
 if(!reportPassed)return null;
 if(!path.length){const index=Array.isArray(report.menus)?report.menus.indexOf(panelId):-1;return index<0?null:evidencePointer(`/menus/${index}`);}
 const index=Array.isArray(report.nativeSubmenus)?report.nativeSubmenus.findIndex(menu=>menu.panel===panelId&&samePath(menu.path,path)):-1;
 return index<0?null:evidencePointer(`/nativeSubmenus/${index}`);
}
function verifyBindings(actions){
 for(const id of actions){if(!bindingText.includes(`'${id}': binding(`))throw new Error(`Missing existing CadUiAction binding: ${id}`);}
 return {status:actions.length?'VERIFIED_EXISTING_BINDING':'NO_ACTION_BINDING',actions,source:bindingPath,sourceSha256:sha256(bindingBytes),scope:'Static binding presence only; does not prove browser execution or native semantic parity.'};
}
function actionBehavior(id){
 const proof={
  'sketch.line':{observed:report?.scenarioA?.constructionLine===true,pointers:['/scenarioA/constructionLine','/scenarioA/entities'],route:'Promoted line tool; pointer input; resulting line is constrained, converted to construction geometry, and saved.'},
  'sketch.rectangle':{observed:typeof report?.scenarioA?.rectangle==='string'&&report.scenarioA.rectangle.includes('two pointer clicks'),pointers:['/scenarioA/rectangle'],route:'Promoted rectangle tool; two pointer clicks; persisted 60×40 rectangle.'},
  'sketch.circle':{observed:typeof report?.scenarioA?.circle==='string'&&report.scenarioA.circle.includes('two pointer clicks'),pointers:['/scenarioA/circle'],route:'Promoted circle tool; two pointer clicks; persisted circle and diameter.'},
  'sketch.arc':{observed:report?.arc?.threeRealClicks===true,pointers:['/arc'],route:'Promoted center-point arc tool; three pointer clicks and radius assertion.'},
  'sketch.finish':{observed:report?.saveReopen===true,pointers:['/saveReopen'],route:'Promoted Finish Sketch; return to Solid; save, reopen, and edit the sketch again.'},
  'dimension.linear':{observed:typeof report?.scenarioA?.rectangle==='string'&&report.scenarioA.rectangle.includes('driving line dimensions'),pointers:['/scenarioA/rectangle'],route:'Existing linear-dimension action through the context menu; committed 60 and 40 mm dimensions. This does not claim the ribbon leaf was used.'},
  'dimension.diameter':{observed:typeof report?.scenarioA?.circle==='string'&&report.scenarioA.circle.includes('driving dimension'),pointers:['/scenarioA/circle'],route:'Existing diameter action through the context menu; committed Ø12 and annotation edit to Ø14. This does not claim the ribbon leaf was used.'},
  'constraint.horizontal':{observed:report?.scenarioA?.horizontalConstraint===true,pointers:['/scenarioA/horizontalConstraint'],route:'Existing horizontal action through the context menu; solved preview and persisted constraint assertions.'},
  'constraint.vertical':{observed:report?.verticalConstraint===true,pointers:['/verticalConstraint'],route:'Native horizontal/vertical primary opens its chooser; vertical leaf is selected and the resulting constraint is checked.'},
  'sketch.construction':{observed:report?.scenarioA?.constructionLine===true,pointers:['/scenarioA/constructionLine'],route:'Sketch Palette construction checkbox; persisted line construction flag. This does not claim the authored ribbon row was used.'},
 }[id];
 const passed=reportPassed&&proof?.observed===true;
 return {cadUiAction:id,status:passed?'PASS':'NOT_BROWSER_TESTED',...(passed?{inputRoute:proof.route,evidence:proof.pointers.map(evidencePointer)}:{reason:!reportPassed?'No accepted PASS browser report is available.':'No successful behavior assertion for this action is recorded in the accepted report.'})};
}
function behaviorSummary(actions){
 const results=actions.map(actionBehavior),passed=results.filter(result=>result.status==='PASS').length;
 return {status:!actions.length?'NOT_APPLICABLE':passed===actions.length?'PASS':passed?'MIXED_BROWSER_RESULTS':'NOT_BROWSER_TESTED',actions:results};
}
function nativeCoverage(control,panel,path,actions){
 const isCommand=control.type==='CommandControl',isDropdown=control.type==='DropDownControl';
 const parent=containerEvidence(panel.id,path),opened=isDropdown?containerEvidence(panel.id,[...path,control.id]):null;
 const behavior=behaviorSummary(actions);
 const status=isDropdown?(opened?'PASS_OPENED_ORDER':'NOT_BROWSER_TESTED'):isCommand&&!actions.length?(parent?'PASS_DISABLED':'NOT_BROWSER_TESTED'):isCommand?behavior.status:'NOT_APPLICABLE';
 return {
  status,inventory:{status:control.type==='SeparatorControl'?'NOT_APPLICABLE':'VERIFIED_LABEL_AND_SVG',source:sourcePath},bindingVerification:verifyBindings(actions),browserScenario:browserTest,
  menu:{status:isDropdown?(opened?'PASS_OPENED_ORDER':'NOT_BROWSER_TESTED'):parent?'PASS_ORDER_CHECKED':'NOT_BROWSER_TESTED',evidence:opened?[opened]:parent?[parent]:[],scope:'The browser scenario opens recorded menus, compares native command order, and checks each row. This is not operation execution.'},
  ...(isCommand&&!actions.length?{disabledState:{status:parent?'PASS_DISABLED':'NOT_BROWSER_TESTED',evidence:parent?[parent]:[],scope:'checkMenu asserts that every unmapped leaf row is disabled; it does not attempt the unavailable operation.'}}:{}),
  behavior,
 };
}
function authoredCoverage(item){
 const behavior=actionBehavior(item.actionId);
 const dimensionMenu=item.nativeId==='SketchDimension'&&reportPassed&&report?.authoredDimensionMenu===true;
 const orientationMenu=item.nativeId==='ConstraintHorizontalVertical'&&reportPassed&&report?.verticalConstraint===true;
 return {status:behavior.status,bindingVerification:verifyBindings([item.actionId]),browserScenario:browserTest,menu:{status:dimensionMenu?'PASS_SIX_DIMENSION_LEAVES':orientationMenu?'PASS_CHOOSER_OPENED':'NOT_BROWSER_TESTED',evidence:dimensionMenu?[evidencePointer('/authoredDimensionMenu')]:orientationMenu?[evidencePointer('/verticalConstraint')]:[],scope:'Opening a chooser and finding its leaves does not prove execution of every leaf.'},behavior};
}
const nativeEntries=[];
const actionIds=(id)=>id==='SketchDimension'?[...dimensionActionIds]:id==='ConstraintHorizontalVertical'?['constraint.horizontal','constraint.vertical']:sketchNativeActions[id]?[sketchNativeActions[id]]:[];
const semanticNotes={
 DrawPolyline:'ASA-CAD exposes its existing line tool. Fusion gesture and chain behavior have not been claimed equivalent.',
 CircleCenterRadius:'The native ID is CircleCenterRadius; the source command name is Center Diameter Circle. The existing ASA-CAD circle tool uses center and a radius point.',
 ArcCenterTwoPoint:'Mapped only to the existing center → start → end arc tool. Three-point and tangent arcs remain disabled.',
 ConstraintHorizontalVertical:'An authored chooser exposes the separate horizontal and vertical CadUiActions; the combined command does not guess the orientation.',
 ConstraintFix:'Partial support: fixes an eligible unfixed line. UnFix is not implemented and is not advertised by the Russian label.',
 SketchDimension:'An authored submenu exposes six existing dimensions. Primary/D chooses an enabled action in diameter, radius, linear, horizontal, vertical, angular order; this is not Fusion inference parity.',
 SelectCommand:'Selection works on the existing canvas, but there is no matching CadUiAction for this native toolbar command, so the toolbar entry remains disabled.',
};
function collect(controls,panel,path,pointer){
 controls.forEach((control,index)=>{
  const nativeId=control.commandDefinition?.id||control.id;
  const item=flattenSketchItems(panel.items).find(candidate=>candidate.id===control.id&&!candidate.authored);
  const actions=actionIds(nativeId);
  const isCommand=control.type==='CommandControl',isDropdown=control.type==='DropDownControl';
  if(item?.icon.startsWith('sketch.native.')&&!sketchIcons[item.icon])throw new Error(`Missing authored SVG for ${nativeId}`);
  nativeEntries.push({
   nativeId,controlId:control.id,type:control.type,nativeName:control.commandDefinition?.name??control.name??null,
   labelRu:control.type==='SeparatorControl'?null:sketchLabels[nativeId],
   svgKey:item?.icon||null,svgSource:item?.icon&&(['sketch.line','sketch.rectangle','sketch.circle','sketch.arc','sketch.finish'].includes(item.icon))?'prototypes/fusion/live/LiveIcon.tsx':item?.icon?'prototypes/fusion/live/SketchIcons.ts':null,
   menu:{panelId:panel.id,path:[...path,control.id],sourceOrder:control.order},
   nativePromoted:sketchReference.panels.find(p=>p.id===panel.id).promotedControlIds.includes(nativeId),
   cadUiActions:actions,
   bindingMode:nativeId==='ConstraintHorizontalVertical'?'authored-chooser':nativeId==='SketchDimension'?'contextual-primary-and-authored-chooser':actions.length?'existing-cad-ui-action':isDropdown?'submenu':isCommand?'disabled':'separator',
   support:actions.length?(nativeId==='ConstraintFix'?'partial':'existing-core-operation'):isCommand?'unsupported':isDropdown?'menu-only':'not-applicable',
   runtimeEnabledSource:actions.length?'CadUiAction.enabled; never the inactive native capture flags':isCommand?'false':'menu navigation',
   ...(semanticNotes[nativeId]?{semanticNote:semanticNotes[nativeId]}:{}),
   evidence:{composition:{file:referencePath,jsonPointer:`${pointer}/${index}`,sourceSha256:sketchReference.source.sha256},localization:isCommand||isDropdown?{kind:'authored Russian translation',file:sourcePath}:null,icon:item?.icon?{kind:'independently drawn SVG',nativePixelParity:'unverified'}:null,actionBinding:actions.length?{file:'src/web/M2CadUiActions.ts',presentation:'prototypes/fusion/live/SketchRibbon.tsx'}:null},
   testCoverage:nativeCoverage(control,panel,path,actions),
  });
  if((isCommand||isDropdown)&&!sketchLabels[nativeId])throw new Error(`Missing Russian label: ${nativeId}`);
  if(control.controls?.length)collect(control.controls,panel,[...path,control.id],`${pointer}/${index}/controls`);
 });
}
sketchReference.panels.forEach((source,index)=>collect(source.controls,sketchPanels[index],[],`/panels/${index}/controls`));
const authoredExtensions=sketchPanels.flatMap(panel=>flattenSketchItems(panel.items).filter(item=>item.authored&&!item.separator).map(item=>({id:item.id,nativeParentId:item.nativeId??null,labelRu:item.label,svgKey:item.icon,menuPanelId:panel.id,cadUiAction:item.actionId,evidence:{kind:'authored presentation of existing CadUiAction',file:sourcePath,nativeMenuParity:false},testCoverage:authoredCoverage(item)})));
const matrix={
 schemaVersion:1,source:sketchReference.source,referenceFile:referencePath,
 browserEvidence,
 scope:'Contextual Sketch ribbon presentation. API composition verified; active native Sketch screenshot and pixel parity are unverified.',
 captureState:sketchReference.captureState,captureStatePolicy:'The source was captured with SolidTab active. Its visibility and enabled flags are evidence only, never runtime gates.',
 counts:{nativePanels:sketchReference.panels.length,nativeControls:nativeEntries.length,nativeCommands:nativeEntries.filter(e=>e.type==='CommandControl').length,nativeDropdowns:nativeEntries.filter(e=>e.type==='DropDownControl').length,nativeSeparators:nativeEntries.filter(e=>e.type==='SeparatorControl').length,authoredActionRows:authoredExtensions.length,uniqueCadUiActions:new Set([...nativeEntries.flatMap(e=>e.cadUiActions),...authoredExtensions.map(e=>e.cadUiAction)]).size},
 panels:sketchPanels.map(panel=>({nativeId:panel.id,labelRu:panel.label,groupKey:panel.key,nativePromotedIds:sketchReference.panels.find(p=>p.id===panel.id).promotedControlIds,presentedPromoted:panel.promoted.map(item=>({nativeId:item.nativeId,svgKey:item.icon,authoredPromotion:!!item.authored})),testCoverage:{status:containerEvidence(panel.id)?'PASS_OPENED_ORDER':'NOT_BROWSER_TESTED',evidence:containerEvidence(panel.id)?[containerEvidence(panel.id)]:[],scope:'Native group opened; promoted order and menu command order checked by the browser scenario.'}})),
 nativeEntries,authoredExtensions,
 authoredPresentationDecisions:[
  'Center-point arc has an extra promoted button for the existing supported operation; it is not present in native promotedControlIds.',
  'Horizontal/vertical and dimension submenus expose distinct core actions; these submenu rows are not in the native export.',
  'Delete, construction, and point-on-curve are authored extension rows; they have no asserted native command ID.',
  'Native dropdown names were null. Russian dropdown labels are authored from their IDs.',
  'Constraint icons use two compact rows; the first eight groups can scroll horizontally and the finish panel stays visible.',
  'All unavailable native operations remain disabled. Native capture isEnabled/isVisible never grants a core operation.',
 ],
 visualReference:sketchReference.visualReference,
};
if(!process.argv.includes('--check'))writeFileSync(new URL('./sketch-command-matrix.v1.json',import.meta.url),`${JSON.stringify(matrix,null,2)}\n`);
console.log(JSON.stringify({counts:matrix.counts,browserEvidence,behavior:behaviorSummary([...new Set([...nativeEntries.flatMap(entry=>entry.cadUiActions),...authoredExtensions.map(entry=>entry.cadUiAction)])]),matrixWritten:!process.argv.includes('--check')}));
