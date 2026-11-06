/* Isolated real-UI capture. This launches a fresh temporary headless browser,
 * never CDP or a user profile. All geometry/camera changes use public input;
 * DOM and the UI-saved JSON are read only for assertions and measurements. */
import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../evidence');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const referenceBytes=await readFile(resolve(here,'../reference_capture/sketch-active-ui-20261106.json'));
const observationBytes=await readFile(resolve(here,'../reference_capture/sketch-native-observations-20261106.json'));
const observations=JSON.parse(observationBytes);
const tolerance=observations.toleranceCssPx;
const nativeScale=observations.observedGeometry.pixelsPerMm2048;
const expectedGeometry={line:{from:[-50,-25],to:[-20,-20]},rectangle:{from:[0,0],to:[60,40]},circle:{center:[30,20],diameter:12},origin:[1024,606]};
const report={schemaVersion:2,parityRevision:'fusion-sketch-parity-002',referenceCaptureSha256:sha256(referenceBytes),observationSha256:sha256(observationBytes),testSourceSha256:sha256(await readFile(fileURLToPath(import.meta.url))),sourceSnapshotSha256:process.env.ASA_FUSION_SOURCE_SNAPSHOT||null,status:'RUNNING',functionalStatus:'RUNNING',visualParityAccepted:false,
 input:'Fresh temporary Playwright browser; real pointer/keyboard and public wheel. No injected application state or document.',
 nativeDpi:observations.nativeDpi,nativeDpiPolicy:observations.nativeDpiPolicy,expectedGeometry,comparisons:[],responsive:[],pageErrors:[],
 comparisonPolicy:'MATCHES_REFERENCE_CLIENT_PX means only measured client-pixel bounds fit the stated tolerance. DIFF records a measurable difference. Neither result accepts raster/icon parity, semantic equivalence or owner visual acceptance.'};
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const context=await browser.newContext({viewport:{width:2048,height:1137},deviceScaleFactor:1});
const page=await context.newPage();page.setDefaultTimeout(20000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const stage=()=>page.locator('[data-testid="part-model-stage"]');
const tool=id=>page.locator('.live-tool[data-command-id="'+id+'"]');
const quick=id=>page.locator('.live-quickbar [data-command-id="'+id+'"]');
const palette=()=>page.locator('[data-testid="sketch-palette"]');
const near=(actual,expected,tol,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tol,`${label}: ${actual} != ${expected} (+/- ${tol})`);
const pointNear=(actual,expected,label)=>actual.forEach((value,index)=>near(value,expected[index],.025,label+' '+index));
const count=async expected=>page.waitForFunction(expected=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')===String(expected),expected);
async function settledFrame(){
 await page.waitForFunction(()=>{
  const host=document.querySelector('[data-testid="part-model-stage"]'),svg=host?.querySelector('[data-sketch-layer="grid"]');
  if(!host||!svg)return false;
  const r=host.getBoundingClientRect(),v=svg.viewBox.baseVal;
  // SVGRect exposes float32 values: at the native scale its aspect error is
  // 1.62e-7 but only 0.000153 CSS px. Check the rendered residual in pixels.
  return r.width>0&&r.height>0&&v.width>0&&v.height>0&&Math.abs(r.width-r.height*v.width/v.height)<.01;
 });
}
async function pixel(world){
 return page.locator('[data-sketch-layer="grid"]').evaluate((element,point)=>{
  const matrix=element.getScreenCTM();if(!matrix)throw Error('Missing sketch screen frame');
  const pixel=new DOMPoint(point[0],-point[1]).matrixTransform(matrix);return {x:pixel.x,y:pixel.y};
 },world);
}
async function move(world){const point=await pixel(world);await page.mouse.move(point.x,point.y);return point;}
async function click(world,options={}){const point=await pixel(world);await page.mouse.click(point.x,point.y,options);return point;}
async function paintedPreview(testId,expectedAttributes){
 // A painted horizontal/vertical SVG line has a zero-height/width DOM box.
 // Require attached geometry, its expected coordinates and a real screen frame.
 await page.getByTestId(testId).first().waitFor({state:'attached'});
 await page.waitForFunction(({testId,expectedAttributes})=>{
  const nodes=[...document.querySelectorAll('[data-testid="'+testId+'"]')];
  return nodes.length===expectedAttributes.length&&nodes.every((node,index)=>{
   if(!(node instanceof SVGGraphicsElement))return false;
   const matrix=node.getScreenCTM(),rect=node.getBoundingClientRect(),style=getComputedStyle(node);
   return matrix&&[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite)
    &&Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)>0&&(rect.width>0||rect.height>0)
    &&style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>0
    &&style.stroke!=='none'&&parseFloat(style.strokeWidth)>0&&Number(style.strokeOpacity)>0
    &&Object.entries(expectedAttributes[index]).every(([name,value])=>node.hasAttribute(name)&&Math.abs(Number(node.getAttribute(name))-value)<.025);
  });
 },{testId,expectedAttributes});
 return page.getByTestId(testId).evaluateAll((nodes,expectedAttributes)=>nodes.map((node,index)=>{
  const matrix=node.getScreenCTM(),rect=node.getBoundingClientRect(),style=getComputedStyle(node);
  return {attributes:Object.fromEntries(Object.keys(expectedAttributes[index]).map(name=>[name,Number(node.getAttribute(name))])),screenTransform:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],clientBounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},stroke:style.stroke,strokeWidth:style.strokeWidth};
 }),expectedAttributes);
}
async function idle(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');}
async function camera(){return stage().evaluate(element=>{
 const rect=element.getBoundingClientRect(),span=Number(element.getAttribute('data-sketch-view-span'));
 return {span,center:element.getAttribute('data-sketch-view-center').split(',').map(Number),stage:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},pxPerMm:Math.min(rect.width,rect.height)/span};
});}
async function alignNativeScale(){
 await settledFrame();const before=await camera(),origin=await pixel([0,0]);
 const desiredSpan=Math.min(before.stage.width,before.stage.height)/nativeScale;
 const deltaY=Math.log(desiredSpan/before.span)/.0015;
 assert.ok(Math.abs(deltaY)<600,'One public wheel event must stay below the existing clamp');
 if(Math.abs(deltaY)>.001){
  await page.mouse.move(origin.x,origin.y);await page.mouse.wheel(0,deltaY);
  await page.waitForFunction(span=>Math.abs(Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span'))-span)<.0001,desiredSpan);
 }
 await settledFrame();const after=await camera(),afterOrigin=await pixel([0,0]);
 near(after.pxPerMm,nativeScale,.0001,'Actual DOM camera scale');
 near(afterOrigin.x,origin.x,.1,'Wheel preserves origin anchor X');near(afterOrigin.y,origin.y,.1,'Wheel preserves origin anchor Y');
 return {method:'public mouse wheel at rendered world origin',deltaY,desiredSpan,before,after,origin:afterOrigin};
}
async function save(){
 const canonicalKey='asa-cad-m2-shell-document:state',mirrorKey='asa-cad-m2-shell-document';
 const before=await page.evaluate(key=>localStorage.getItem(key),canonicalKey);
 await quick('system.save').click();
 await page.waitForFunction(({key,before})=>localStorage.getItem(key)!==before,{key:canonicalKey,before});
 await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
 const saved=await page.evaluate(({canonicalKey,mirrorKey})=>({canonical:localStorage.getItem(canonicalKey),mirror:localStorage.getItem(mirrorKey)}),{canonicalKey,mirrorKey});
 assert.ok(saved.canonical&&saved.mirror,'UI Save must populate canonical and mirror document keys');
 const envelope=JSON.parse(saved.canonical);
 assert.ok(Number.isSafeInteger(envelope.revision)&&envelope.revision>0,'UI Save must persist a revision');
 assert.equal(envelope.serializedDocument,saved.mirror,'UI Save canonical and mirror bytes must agree');
 return JSON.parse(saved.mirror);
}
async function bounds(){
 return page.evaluate(()=>{
  const box=selector=>{const element=document.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const origin=document.querySelector('[data-sketch-origin-ring]'),matrix=origin?.getScreenCTM();
  const point=matrix?new DOMPoint(0,0).matrixTransform(matrix):null;
  const host=document.querySelector('[data-testid="part-model-stage"]');
  return {quickbar:box('.live-quickbar'),workspace:box('.live-workspace'),tabs:box('.live-tabs'),scene:box('[data-testid="part-model-stage"]'),palette:box('[data-testid="sketch-palette"]'),cube:box('[data-sketch-cube-face]'),navigation:box('.live-navigation'),finish:box('.live-tool[data-command-id="sketch.finish"]'),menu:box('.live-sketch-menu[data-menu-level="0"]'),tooltip:box('[data-native-tooltip="DrawPolyline"]'),context:box('.live-context'),origin:point?{x:point.x,y:point.y}:null,
   camera:host?{span:Number(host.getAttribute('data-sketch-view-span')),center:host.getAttribute('data-sketch-view-center')?.split(',').map(Number)}:null,
   cubeLabel:document.querySelector('.live-sketch-plane-face text')?.textContent??null,activeCommand:document.querySelector('.live-workarea')?.getAttribute('data-active-command')??null};
 });
}
function compare(actual,expected){
 const results=[];
 for(const [region,wanted] of Object.entries(expected)){
  if(!wanted)continue;const current=actual[region];
  const deltas=current?Object.fromEntries(Object.entries(wanted).filter(([,value])=>typeof value==='number').map(([key,value])=>[key,(current[key]??NaN)-value])):null;
  const matches=!!deltas&&Object.values(deltas).every(value=>Number.isFinite(value)&&Math.abs(value)<=tolerance);
  results.push({region,expected:wanted,actual:current??null,deltaCssPx:deltas,toleranceCssPx:tolerance,status:matches?'MATCHES_REFERENCE_CLIENT_PX':'DIFF'});
 }
 return results;
}
async function nativeEvidence(file){
 const path=resolve(out,file);
 try{const bytes=await readFile(path);return {file,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytesPresentInTestWorkspace:true};}
 catch(error){if(error.code!=='ENOENT')throw error;return {file,sha256:null,bytesPresentInTestWorkspace:false,note:'Original capture remains referenced by the independent fixture; pair these candidate bytes with the original in the evidence workspace.'};}
}
const baseExpected=()=>({quickbar:observations.observedBounds.quickbar,workspace:observations.observedBounds.workspace,scene:{y:observations.observedBounds.scene.y},cube:observations.observedBounds.cube,origin:{x:expectedGeometry.origin[0],y:expectedGeometry.origin[1]}});
async function capture(name,nativeFile,expected=baseExpected(),detail={}){
 const file='fusion-live-sketch-parity-'+name+'-2048.png';
 const actual=await bounds();await page.screenshot({path:resolve(out,file)});
 const measurements=compare(actual,expected),candidateBytes=await readFile(resolve(out,file));
 report.comparisons.push({state:name,candidate:{file,sha256:sha256(candidateBytes),viewport:page.viewportSize(),dpr:await page.evaluate(()=>devicePixelRatio)},native:await nativeEvidence(nativeFile),actualBounds:actual,measurements,
  measuredStatus:measurements.length?measurements.every(item=>item.status==='MATCHES_REFERENCE_CLIENT_PX')?'MATCHES_REFERENCE_CLIENT_PX':'DIFF':'NOT_MEASURED',visualStatus:'AWAITING_VISUAL_REVIEW',...detail});
}
function assertGeometry(document){
 assert.equal(document.kind,'part');assert.equal(document.sketches.length,1);
 const entities=document.sketches[0].entities;assert.equal(entities.length,6);
 const lines=entities.filter(entity=>entity.type==='line'),circle=entities.find(entity=>entity.type==='circle');
 assert.equal(lines.length,5);assert.ok(circle);
 const looseLine=lines.find(entity=>entity.data.from[0]<-10&&entity.data.to[0]<-10);assert.ok(looseLine);
 pointNear(looseLine.data.from,expectedGeometry.line.from,'Native line start');pointNear(looseLine.data.to,expectedGeometry.line.to,'Native line end');
 const edges=lines.filter(entity=>entity!==looseLine);
 const expectedEdges=[[[0,0],[60,0]],[[60,0],[60,40]],[[60,40],[0,40]],[[0,40],[0,0]]];
 const pointMatches=(a,b)=>a.every((value,index)=>Math.abs(value-b[index])<.025);
 for(const [from,to] of expectedEdges)assert.ok(edges.some(edge=>(pointMatches(edge.data.from,from)&&pointMatches(edge.data.to,to))||(pointMatches(edge.data.from,to)&&pointMatches(edge.data.to,from))),'Expected native rectangle edge '+JSON.stringify([from,to]));
 pointNear(circle.data.center,expectedGeometry.circle.center,'Native circle center');near(circle.data.diameter,12,.025,'Native circle diameter');
 const diameter=document.dimensions.find(dimension=>dimension.type==='diameter'&&dimension.value===12);assert.ok(diameter,'A real persisted driving diameter dimension is required');
 return {line:{id:looseLine.id,...looseLine.data},rectangle:{edges:edges.map(edge=>({id:edge.id,...edge.data})),width:60,height:40},circle:{id:circle.id,...circle.data},diameter:{id:diameter.id,type:diameter.type,value:diameter.value},entityCount:entities.length};
}
async function responsiveCapture(layout){
 const width=layout.requestedWidth,height=layout.height;
 await page.setViewportSize({width,height});await settledFrame();
 const panels=await page.locator('section.live-sketch-group').evaluateAll(elements=>elements.map(group=>({id:group.getAttribute('data-native-panel'),visible:[...group.querySelectorAll('.live-tool')].filter(button=>button.getBoundingClientRect().width>0).map(button=>button.getAttribute('data-native-command'))})));
 const expected=Object.entries(observations.promotedIds2048).map(([id,ids],index)=>({id,visible:ids.slice(0,layout.visibleGroupCounts[index])}));
 assert.deepEqual(panels,expected,'Physical narrow promotions must match the independent native fixture');
 const actual=await bounds();
 for(const name of ['finish','palette','navigation']){
  const rect=actual[name];assert.ok(rect&&rect.width>0&&rect.height>0,name+' remains visible');
  assert.ok(rect.x>=-.5&&rect.y>=-.5&&rect.x+rect.width<=width+.5&&rect.y+rect.height<=height+.5,name+' must not clip at '+width);
 }
 assert.equal(await page.locator('.live-sketch-scroll').evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'No horizontal ribbon scroll');
 const file='fusion-live-sketch-parity-layout-'+width+'.png';await page.mouse.move(width/2,150);await page.screenshot({path:resolve(out,file)});
 report.responsive.push({candidateViewport:{width,height,dpr:1},nativeViewport:{width:layout.width,height:layout.height,requestedWidth:layout.requestedWidth},native:await nativeEvidence(layout.file),candidate:file,visiblePromotions:panels,totalVisible:panels.reduce((sum,panel)=>sum+panel.visible.length,0),actualBounds:actual,camera:await camera(),noClipping:['finish','palette','navigation'],noHorizontalScroll:true,limitation:layout.limitation??null,visualStatus:layout.width===width?'AWAITING_VISUAL_REVIEW':'DIFFERENT_NATIVE_CLIENT_WIDTH'});
}

let phase='new-sketch';
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8099/');
 await tool('part.sketch.create').click();await page.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await page.locator('.live-commit').click();
 await page.waitForSelector('.live-workarea[data-workspace="sketch"]');await page.waitForSelector('[data-testid="live-viewcube"][data-camera-ready="true"]');await count(0);await settledFrame();
 assert.equal(await page.locator('.live-tabs [role="tab"]').count(),8,'Seven Solid tabs plus Sketch');assert.equal(await page.evaluate(()=>devicePixelRatio),1);
 phase='native-scale';report.cameraCalibration=await alignNativeScale();await move([-70,-35]);
 await capture('empty',observations.primaryCapture,{...baseExpected(),palette:observations.observedBounds.paletteEmpty});
 await page.locator('[data-sketch-group="SketchCreatePanel"]').click();
 await capture('create-menu','fusion-parity-native-create-menu-2048-dpi110.png',{...baseExpected(),menu:observations.observedBounds.createMenu});await page.keyboard.press('Escape');
 phase='line-hover';await tool('sketch.line').hover();await page.locator('[data-native-tooltip="DrawPolyline"]:not(.is-expanded)').waitFor();
 await capture('line-hover',observations.observedInteractions.lineTooltip.short,baseExpected());
 await page.locator('[data-native-tooltip="DrawPolyline"].is-expanded').waitFor();
 await capture('line-tooltip',observations.observedInteractions.lineTooltip.expanded,{...baseExpected(),tooltip:{width:observations.observedInteractions.lineTooltip.expandedWidth,height:observations.observedInteractions.lineTooltip.expandedHeight}});
 phase='line';await tool('sketch.line').click();await move([-70,-35]);
 await capture('line-active',observations.observedInteractions.lineActive);
 await click(expectedGeometry.line.from);await move(expectedGeometry.line.to);
 const linePreview=await paintedPreview('sketch-line-ghost',[{x1:-50,y1:25,x2:-20,y2:20}]);
 await capture('line-preview','fusion-parity-native-line-preview-2048-dpi110.png',baseExpected(),{pendingGeometry:expectedGeometry.line,previewGeometry:linePreview});
 await click(expectedGeometry.line.to);await count(1);await idle();
 phase='rectangle';await tool('sketch.rectangle').click();await click(expectedGeometry.rectangle.from);await move(expectedGeometry.rectangle.to);
 const rectanglePreview=await paintedPreview('sketch-rectangle-ghost-edge',[{x1:0,y1:0,x2:60,y2:0},{x1:60,y1:0,x2:60,y2:-40},{x1:60,y1:-40,x2:0,y2:-40},{x1:0,y1:-40,x2:0,y2:0}]);
 await capture('rectangle-preview',observations.observedInteractions.rectanglePreview,baseExpected(),{pendingGeometry:expectedGeometry.rectangle,previewGeometry:rectanglePreview});
 await click(expectedGeometry.rectangle.to);await count(5);await idle();
 phase='circle';await tool('sketch.circle').click();await click(expectedGeometry.circle.center);await move([35,20]);
 const circlePreview=await paintedPreview('sketch-circle-ghost',[{cx:30,cy:-20,r:5}]);
 await capture('circle-preview','fusion-parity-native-circle-preview-2048-dpi110.png',baseExpected(),{pendingGeometry:{center:[30,20],diameter:10},previewGeometry:circlePreview,note:'The native preview shows diameter 10. The next real radius click is 6 with snap disabled, followed by the driving diameter 12 command.'});
 const snap=page.locator('[data-sketch-option="snap"]');await snap.uncheck();await click([36,20]);await count(6);await idle();await snap.check();
 phase='driving-diameter';const circleId=await page.locator('[data-testid="cad-sketch-overlay"] circle[data-sketch-entity-id]').first().getAttribute('data-sketch-entity-id');
 await click([36,20]);await page.waitForFunction(id=>document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-selected-sketch-entity-id')===id,circleId);
 await page.keyboard.press('d');await page.getByLabel('Размер',{exact:true}).waitFor();
 assert.equal(await page.locator('.live-workarea').getAttribute('data-active-command'),'dimension.diameter');
 await page.getByLabel('Размер',{exact:true}).fill('12');await page.getByLabel('Размер',{exact:true}).press('Enter');
 await page.waitForSelector('[data-sketch-dimension-id][data-dimension-value="12"]');await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');
 await page.keyboard.press('Escape');await move([50,-35]);
 await capture('circle-diameter',observations.observedGeometry.source);
 const saved=await save();report.savedGeometry=assertGeometry(saved);const savedGeometry=JSON.stringify(saved);
 phase='palette';await move([50,-35]);await capture('palette',observations.observedGeometry.source,{...baseExpected(),palette:{x:observations.observedBounds.paletteEmpty.x,y:observations.observedBounds.paletteEmpty.y,width:observations.observedBounds.paletteEmpty.width}},{paletteState:'nonempty under-constrained sketch; empty-palette height is intentionally not used'});
 phase='context-circle';await click([36,20],{button:'right'});await page.locator('.live-marking[data-marking-level="root"]').waitFor();
 assert.equal(await stage().getAttribute('data-selected-sketch-entity-id'),circleId);
 await capture('context-circle','fusion-parity-native-context-circle-2048-dpi110.png');
 await page.locator('.live-marking[data-marking-level="root"] [data-marking-slot="4"]').hover();await page.locator('.live-marking[data-marking-level="sketch"]').waitFor();
 await capture('context-sketch',observations.observedInteractions.context.sketchSubmenu);await page.keyboard.press('Escape');
 phase='constraints-menu';await page.locator('[data-sketch-group="SketchConstraintsPanel"]').click();await page.locator('.live-sketch-menu[data-menu-level="0"]').waitFor();
 await capture('constraints-menu','fusion-parity-native-constraints-menu-2048-dpi110.png');await page.keyboard.press('Escape');
 phase='viewcube';const beforeLookAt=await camera();await page.getByRole('button',{name:'Вид по нормали к эскизу',exact:true}).click();
 await page.waitForFunction(previous=>{const element=document.querySelector('[data-testid="part-model-stage"]');return Math.abs(Number(element?.getAttribute('data-sketch-view-span'))-previous.span)>1e-7||element?.getAttribute('data-sketch-view-center')!==previous.center.join(',');},beforeLookAt);
 await settledFrame();await move([50,-35]);
 report.viewCube={before:beforeLookAt,after:await camera(),plane:await page.getByTestId('live-viewcube').getAttribute('data-sketch-plane'),projection:await page.getByTestId('live-viewcube').getAttribute('data-projection'),mode:await page.getByTestId('live-viewcube').getAttribute('data-sketch-mode'),orbitUnavailable:await page.getByRole('button',{name:'Орбита',exact:true}).isDisabled()};
 assert.equal(report.viewCube.projection,'orthographic');assert.equal(report.viewCube.orbitUnavailable,true);
 await capture('viewcube','fusion-parity-native-cube-look-at-2048-dpi110.png',baseExpected(),{cameraBehavior:'The real normal-view action was invoked. Its fit/center differences remain in measurements; no state or camera was injected to conceal them.'});
 phase='responsive';await page.getByRole('button',{name:'Главный вид модели',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span'))===100);await alignNativeScale();
 for(const layout of observations.responsiveCaptures)await responsiveCapture(layout);
 assert.equal(JSON.stringify(await save()),savedGeometry,'View, context and resize interactions must not mutate the saved document');
 phase='finish';await page.setViewportSize({width:2048,height:1137});await settledFrame();await tool('sketch.finish').click();await page.waitForSelector('.live-workarea[data-workspace="solid"]');
 assert.equal(await palette().count(),0);assert.equal(await page.locator('.live-sketch-ribbon').count(),0);
 await page.mouse.move(1024,600);await capture('finished-solid','fusion-parity-native-finished-solid-2048-dpi110.png',{}, {expectedWorkspace:'solid',extrusion:'Not run in the visual capture scenario; covered by the functional workspace E2E.'});
 assertGeometry(await save());assert.deepEqual(errors,[]);
 Object.assign(report,{status:'CAPTURED',functionalStatus:'PASS',viewChangesPreserveDocument:true,finishReturnsSolid:true,pageErrors:errors,visualParityAccepted:false});
} catch(error){
 Object.assign(report,{status:'FAIL',functionalStatus:'FAIL',phase,error:error.message,pageErrors:errors,failureBounds:await bounds().catch(cause=>({unavailable:cause.message}))});
 console.error('PHASE',phase,error.stack);await page.screenshot({path:resolve(out,'fusion-live-sketch-parity-debug.png')}).catch(()=>{});process.exitCode=1;
} finally {
 await writeFile(resolve(out,'fusion-live-sketch-parity-checks.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));await browser.close();
}
