import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const referenceBytes=await readFile(resolve(out,'../reference_capture/sketch-active-ui-20261106.json'));
const reference=JSON.parse(referenceBytes.toString('utf8'));
const referenceCaptureSha256=createHash('sha256').update(referenceBytes).digest('hex');
const observations=JSON.parse(await readFile(resolve(out,'../reference_capture/sketch-native-observations-20261106.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:2048,height:1137},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
const tool=id=>page.locator('.live-tool[data-command-id="'+id+'"]');
const stage=()=>page.locator('[data-testid="part-model-stage"]');
const quick=id=>page.locator('.live-quickbar [data-command-id="'+id+'"]');
const view=async()=>({span:Number(await stage().getAttribute('data-sketch-view-span')),center:(await stage().getAttribute('data-sketch-view-center')).split(',').map(Number)});
const count=async n=>page.waitForFunction(n=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')===String(n),n);
async function pixel(world,surface=page){
 const svg=surface.locator('[data-testid="cad-sketch-interaction"], [data-testid="cad-sketch-selection-layer"]').first();
 const r=await svg.boundingBox(),v=(await svg.getAttribute('viewBox')).split(' ').map(Number),scale=Math.min(r.width/v[2],r.height/v[3]);
 return {x:r.x+(r.width-v[2]*scale)/2+(world[0]-v[0])*scale,y:r.y+(r.height-v[3]*scale)/2+(-world[1]-v[1])*scale};
}
async function click(world,options={}){const p=await pixel(world);await page.mouse.click(p.x,p.y,options);}
async function contextCommand(id,point){
 await click(point,{button:'right'});
 await page.locator('.live-marking[data-marking-level="root"] [data-marking-slot="4"]').hover();
 await page.locator('[data-context-section="sketch-commands"]').click();
 await page.locator('[data-context-command="'+id+'"]').click();
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
async function dimensionAt(point,id,value){
 await click(point);await contextCommand(id,point);await page.getByLabel('Размер',{exact:true}).fill(String(value));
 await page.getByLabel('Размер',{exact:true}).press('Enter');
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');
}
async function screenshot(name){await page.screenshot({path:resolve(out,'fusion-live-sketch-workspace-'+name+'.png')});}
const report={schemaVersion:2,parityRevision:'fusion-sketch-parity-002',referenceCaptureSha256,sourceSnapshotSha256:process.env.ASA_FUSION_SOURCE_SNAPSHOT||null,testSourceSha256:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),status:'RUNNING',input:'Playwright pointer/keyboard actions on the public UI; persisted document is read only for assertions',screenshots:[],visualParityAccepted:false};
let phase='new-sketch';
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8099/');
 await tool('part.sketch.create').click();await page.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await page.locator('.live-commit').click();
 await page.waitForSelector('.live-workarea[data-workspace="sketch"]');await page.waitForSelector('[data-testid="live-viewcube"][data-camera-ready="true"]');
 assert.equal(await page.locator('[data-testid="sketch-palette"]').count(),1);
 assert.equal(await page.locator('[data-testid="part-model-stage"]').count(),1);
 phase='undo-empty-sketch';await tool('sketch.line').click();await quick('system.undo').click();await page.waitForSelector('.live-workarea[data-workspace="solid"]');
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');assert.equal(await page.locator('.live-parameters').count(),0);
 assert.equal(await tool('part.sketch.create').isEnabled(),true);await quick('system.redo').click();await page.locator('[data-timeline-sketch]').first().click();
 await page.waitForSelector('.live-workarea[data-workspace="sketch"]');await count(0);report.emptySketchUndoRedo=true;
 // Isolate target deletion with one unconstrained Line. Automatic H/V adds its
 // own real Undo frame; Line 003 separately verifies that non-atomic history.
 phase='undo-dimension-target';await tool('sketch.line').click();await click([-10,10]);await click([10,15]);await count(1);await page.keyboard.press('Escape');
 await click([0,12.5]);await contextCommand('dimension.linear',[0,12.5]);await page.getByLabel('Размер',{exact:true}).waitFor();await quick('system.undo').click();await count(0);
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');
 assert.equal(await page.locator('.live-workarea').getAttribute('data-workspace'),'sketch');assert.equal(await page.getByLabel('Размер',{exact:true}).count(),0);report.removedDimensionTargetCancels=true;
 await screenshot('new-2048');
 await tool('sketch.line').hover();await page.locator('[data-native-tooltip="DrawPolyline"]:not(.is-expanded)').waitFor();await screenshot('line-hover-2048');
 await page.locator('[data-native-tooltip="DrawPolyline"].is-expanded').waitFor();await screenshot('line-tooltip-2048');
 report.lineTooltip={short:true,expanded:true,authoredIllustration:true};

 phase='two-corner-rectangle';await tool('sketch.rectangle').click();await screenshot('rectangle-2048');
 await click([-30,-20]);await click([30,20]);await count(4);await page.keyboard.press('Escape');
 await dimensionAt([0,-20],'dimension.linear',60);await dimensionAt([30,0],'dimension.linear',40);
 await click([30,0]);await page.locator('.live-tool[data-native-command="ConstraintHorizontalVertical"]').click();
 await page.locator('.live-sketch-menu[data-menu-level="0"] [data-command-id="constraint.vertical"]').click();await page.waitForSelector('[data-constraint-type="vertical"]');report.verticalConstraint=true;
 phase='diameter';await tool('sketch.circle').click();await click([0,0]);await click([5,0]);await count(5);await page.keyboard.press('Escape');
 await dimensionAt([5,0],'dimension.diameter',12);
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="cad-sketch-overlay"] circle')].some(e=>Math.abs(Number(e.getAttribute('r'))-6)<.001));
 phase='undo-edited-dimension';await page.locator('[data-sketch-dimension-id][data-dimension-value="12"] text').dblclick();await page.getByLabel('Значение',{exact:true}).fill('14');await quick('system.undo').click();
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.getAttribute('data-active-command')==='');assert.equal(await page.getByLabel('Значение',{exact:true}).count(),0);
 await quick('system.redo').click();await page.waitForSelector('[data-sketch-dimension-id][data-dimension-value="12"]');report.removedEditedDimensionCancels=true;
 await click([6,0]);await page.keyboard.press('d');await page.getByLabel('Размер',{exact:true}).waitFor();assert.equal(await page.locator('.live-workarea').getAttribute('data-active-command'),'dimension.diameter');await page.getByLabel('Размер',{exact:true}).press('Escape');report.dimensionShortcutD=true;
 await click([6,0]);await screenshot('circle-selected-2048');

 phase='line-constraint';await tool('sketch.line').click();await screenshot('line-2048');
 await click([-20,-30]);await click([-2,-29]);await count(6);await page.keyboard.press('Escape');
 await click([-11,-29.5]);await contextCommand('constraint.horizontal',[-11,-29.5]);
 await page.waitForFunction(()=>document.querySelectorAll('[data-sketch-constraint-id]').length>0);
 await page.getByRole('checkbox',{name:'Вспомогательная геометрия',exact:true}).check();
 await screenshot('constraint-2048');
 let doc=await save(),sketch=doc.sketches[0];
 assert.equal(sketch.entities.length,6);assert.equal(sketch.entities.filter(e=>e.type==='circle').length,1);
 assert.deepEqual(doc.dimensions.map(d=>d.value).sort((a,b)=>a-b),[12,40,60]);
 assert.ok(doc.constraints.some(c=>c.type==='horizontal'));
 const construction=sketch.entities.find(e=>e.type==='line'&&e.data.construction);assert.ok(construction);
 const solvedLine=page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="'+construction.id+'"]');
 assert.ok(Math.abs(Number(await solvedLine.getAttribute('y1'))-Number(await solvedLine.getAttribute('y2')))<.0001,'horizontal constraint changes the solved preview');
 const documentBeforeDisplay=JSON.stringify(doc);

 phase='context-target-selection';
 for(const [point,kind] of [[[20,10],'selection'],[[40,-35],'empty']]){
  const coords=await solvedLine.evaluate(e=>[(Number(e.getAttribute('x1'))+Number(e.getAttribute('x2')))/2,-(Number(e.getAttribute('y1'))+Number(e.getAttribute('y2')))/2]);
  await click(coords);assert.equal(await stage().getAttribute('data-selected-sketch-entity-id'),construction.id);
  await click(point,{button:'right'});
  assert.equal(await page.locator('.live-marking').getAttribute('data-marking-context'),kind);
  assert.equal(await stage().getAttribute('data-selected-sketch-entity-id'),'');
  assert.equal(await page.locator('.live-marking[data-marking-level="root"] [data-marking-slot="7"]').isDisabled(),true);
  assert.equal(await page.locator('.live-marking [data-context-command="constraint.fixed"]').isDisabled(),true);
  await page.keyboard.press('Escape');
 }
 assert.equal(JSON.stringify(await save()),documentBeforeDisplay);
 await click([40,-35],{button:'right'});await page.locator('.marking-list button').filter({hasText:'Отмена'}).click();
 assert.equal(await page.locator('.live-workarea').getAttribute('data-workspace'),'sketch');
 assert.equal(await page.locator('.live-marking').count(),0);
 report.contextTargetSelection={entityRightClickSelectsActualTarget:true,profileClearsStaleEntity:true,emptyClearsStaleEntity:true,idleCancelRetainsSketch:true,noDocumentMutation:true};

 phase='palette-layers';
 for(const key of ['grid','points','profiles','dimensions','constraints']){
  const toggle=page.locator('[data-sketch-option="'+key+'"]'),layer=page.locator('[data-sketch-layer="'+key+'"]');
  assert.equal(await toggle.isEnabled(),true,key+' switch');assert.ok(await layer.locator('path,line,circle,text,rect,polygon').count()>0,key+' contains visible data');
  await toggle.uncheck();assert.equal(await layer.isVisible(),false,key+' layer hides');
  await toggle.check();assert.equal(await layer.isVisible(),true,key+' layer returns');
 }
 await page.getByRole('button',{name:'Свернуть палитру эскиза',exact:true}).click();
 assert.equal(await page.locator('[data-sketch-option=grid]').isVisible(),false);
 await page.getByRole('button',{name:'Развернуть палитру эскиза',exact:true}).click();
 assert.equal(await page.locator('[data-sketch-option=grid]').isVisible(),true);
 assert.equal(JSON.stringify(await save()),documentBeforeDisplay,'display preferences must not change the CAD document');
 await screenshot('palette-2048');
 await page.locator('[data-testid="sketch-palette"]').screenshot({path:resolve(out,'fusion-live-sketch-workspace-palette-detail.png')});

 phase='annotation-edit-cancel';
 const diameter=doc.dimensions.find(d=>d.type==='diameter');
 const annotation=page.locator('[data-sketch-dimension-id="'+diameter.id+'"] text');
 await annotation.dblclick();await page.getByLabel('Значение',{exact:true}).fill('14');
 await page.getByLabel('Значение',{exact:true}).press('Escape');
 await page.waitForSelector('.live-workarea[data-workspace="sketch"]');
 assert.equal((await save()).dimensions.find(d=>d.id===diameter.id).value,12);
 await annotation.dblclick();await page.getByLabel('Значение',{exact:true}).fill('14');await page.getByLabel('Значение',{exact:true}).press('Enter');
 await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('14 мм'));
 doc=await save();assert.equal(doc.dimensions.find(d=>d.id===diameter.id).value,14);

 phase='idle-navigation';
 const beforeWheel=await view(),anchor=await pixel([15,10]);await page.mouse.move(anchor.x,anchor.y);await page.mouse.wheel(0,-300);
 await page.waitForFunction(span=>Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span'))<span,beforeWheel.span);
 const beforePan=await view();await page.mouse.down({button:'middle'});await page.mouse.move(anchor.x+65,anchor.y+38,{steps:5});await page.mouse.up({button:'middle'});
 assert.notDeepEqual((await view()).center,beforePan.center);
 await page.getByRole('button',{name:'Вид на эскиз',exact:true}).click();
 await screenshot('cube-normal-2048');
 assert.equal(await page.getByRole('button',{name:'Орбита',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Главный вид модели',exact:true}).click();
 assert.equal((await view()).span,100);
 await tool('sketch.line').click();const activeBefore=await view();const activePoint=await pixel([25,25]);
 await page.mouse.move(activePoint.x,activePoint.y);await page.mouse.down({button:'middle'});await page.mouse.move(activePoint.x+30,activePoint.y+20,{steps:3});await page.mouse.up({button:'middle'});
 assert.notDeepEqual((await view()).center,activeBefore.center);await count(6);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Главный вид модели',exact:true}).click();
 await click([20,30],{button:'right'});assert.equal(await page.locator('.live-marking[data-marking-level="root"]').count(),1);await screenshot('context-2048');
 await page.locator('.live-marking [data-marking-slot="4"]').hover();await page.locator('.live-marking[data-marking-level="sketch"]').waitFor();await screenshot('context-sketch-2048');await page.keyboard.press('Escape');

 phase='snap-and-undo';
 const snapSwitch=page.locator('[data-sketch-option="snap"]');await snapSwitch.check();
 await tool('sketch.line').click();await click([30.4,20.4]);await click([35,25]);await count(7);await page.keyboard.press('Escape');
 const snappedDocument=await save();let added=snappedDocument.sketches[0].entities.at(-1);assert.equal(added.type,'line');
 assert.ok(Math.hypot(added.data.from[0]-30,added.data.from[1]-20)<.001,'endpoint snap changes the committed coordinate');
 const endpointLinks=snappedDocument.constraints.filter(c=>c.type==='coincident'&&c.data.refs.some(ref=>ref.entityId===added.id));
 assert.equal(endpointLinks.length,1,'endpoint snap persists one real Coincident');const endpointLink=endpointLinks[0];
 assert.equal(endpointLink.data.refs.length,2);assert.ok(endpointLink.data.refs.some(ref=>ref.entityId===added.id&&ref.point==='a'));
 const endpointRef=endpointLink.data.refs.find(ref=>ref.entityId!==added.id);
 assert.ok(endpointRef&&(endpointRef.point==='a'||endpointRef.point==='b'),'Coincident references an existing endpoint');
 const endpointEntity=snappedDocument.sketches[0].entities.find(entity=>entity.id===endpointRef.entityId);
 assert.equal(endpointEntity?.type,'line');const endpoint=endpointRef.point==='a'?endpointEntity.data.from:endpointEntity.data.to;
 assert.ok(Math.hypot(endpoint[0]-30,endpoint[1]-20)<.001,'Coincident targets the snapped corner');
 // The existing command contract records Coincident and Line in separate Undo
 // frames. Verify both states explicitly; this coordinate test assumes no transaction.
 await page.locator('[data-sketch-constraint-id="'+endpointLink.id+'"]').waitFor();
 await quick('system.undo').click();await page.locator('[data-sketch-constraint-id="'+endpointLink.id+'"]').waitFor({state:'detached'});await count(7);
 const afterSnapLinkUndo=await save();assert.ok(afterSnapLinkUndo.sketches[0].entities.some(entity=>entity.id===added.id),'first Undo retains the created Line');
 assert.equal(afterSnapLinkUndo.constraints.some(constraint=>constraint.id===endpointLink.id),false,'first Undo removes the actual Coincident');
 await quick('system.undo').click();await count(6);
 await snapSwitch.uncheck();await tool('sketch.line').click();await click([30.4,20.4]);await click([35.4,25.4]);await count(7);await page.keyboard.press('Escape');
 added=(await save()).sketches[0].entities.at(-1);
 assert.ok(Math.hypot(added.data.from[0]-30,added.data.from[1]-20)>.2,'disabled snap preserves the pointer coordinate');
 await quick('system.undo').click();await count(6);await snapSwitch.check();
 phase='arc-and-keyboard-history';
 await page.locator('[data-sketch-group="SketchCreatePanel"]').click();await page.locator('[data-native-dropdown="ArcDropDown"]').hover();await page.locator('[data-native-menu-command="ArcCenterTwoPoint"]').click();
 await click([15,30]);await click([20,30]);await click([15,35]);await count(7);await page.keyboard.press('Escape');
 const arc=(await save()).sketches[0].entities.find(entity=>entity.type==='arc');assert.ok(arc);assert.ok(Math.abs(arc.data.radius-5)<.001);
 await click([25,-35]);await page.keyboard.press('Control+z');await count(6);await page.keyboard.press('Control+y');await count(7);await quick('system.undo').click();await count(6);
 report.snapping={endpointChangesCommittedCoordinate:true,disabledUsesPointerCoordinate:true,realEndpointCoincident:{id:endpointLink.id,refs:endpointLink.data.refs},endpointSnapUndo:{firstRemovesCoincidentRetainsLine:true,secondRemovesLine:true},snapOffUndoFrames:1};report.arc={threeRealClicks:true,radius:5};report.keyboardHistory={undo:true,redo:true};
 phase='entity-drag';
 const beforeDrag=await solvedLine.evaluate(e=>['x1','y1','x2','y2'].map(name=>Number(e.getAttribute(name))));
 const middle=[(beforeDrag[0]+beforeDrag[2])/2,-(beforeDrag[1]+beforeDrag[3])/2];await click(middle);
 const dragStart=await pixel(middle);await page.mouse.move(dragStart.x,dragStart.y);await page.mouse.down();await page.mouse.move(dragStart.x+28,dragStart.y+13,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Элемент эскиза перемещён'));
 const afterDrag=await solvedLine.evaluate(e=>['x1','y1','x2','y2'].map(name=>Number(e.getAttribute(name))));assert.notDeepEqual(afterDrag,beforeDrag);
 await quick('system.undo').click();await page.waitForFunction(({id,x})=>Math.abs(Number(document.querySelector('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id="'+id+'"]')?.getAttribute('x1'))-x)<.001,{id:construction.id,x:beforeDrag[0]});report.entityDrag={realPointerGesture:true,sharedSolver:true,undoRestores:true};

 phase='responsive-layout';
 for(const [width,height] of [[2048,1137],[1600,900],[1366,768]]){
  await page.setViewportSize({width,height});
  const boxes=await page.locator('.live-sketch-palette,.live-tool[data-command-id="sketch.finish"],.live-navigation').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {name:e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
  for(const b of boxes){assert.ok(b.width>0&&b.height>0&&b.x>=0&&b.y>=0&&b.right<=width+1&&b.bottom<=height+1,JSON.stringify(b));}
  assert.equal(await page.evaluate(()=>devicePixelRatio),1);await screenshot('canvas-'+width);report.screenshots.push({width,height,dpr:1,panels:boxes});
 }
 await page.setViewportSize({width:2048,height:1137});
 phase='menus';
 const visibleControls=controls=>{
  const result=[];
  for(const control of controls){
   if(control.isVisible!==true)continue;
   if(control.type==='SeparatorControl'&&(!result.length||result.at(-1).type==='SeparatorControl'))continue;
   result.push({...control,children:visibleControls(control.children||[])});
  }
  while(result.at(-1)?.type==='SeparatorControl')result.pop();
  return result;
 };
 const panels=reference.tab.panels.map(panel=>({...panel,controls:visibleControls(panel.controls)}));
 const groups=page.locator('[data-sketch-group]');assert.equal(await groups.count(),9);
 assert.deepEqual(await page.locator('section.live-sketch-group').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-native-panel'))),panels.map(p=>p.id));
 const visited=[],submenus=[],menuRows=[];
 const dropdownPaths=(controls,path=[])=>controls.flatMap(control=>control.type==='DropDownControl'?[{path:[...path,control.id],controls:control.children},...dropdownPaths(control.children,[...path,control.id])]:[]);
 async function checkMenu(controls,level){
  const menu=page.locator('.live-sketch-menu[data-menu-level="'+level+'"]');await menu.waitFor();
  const expected=controls.map(c=>c.type==='SeparatorControl'?'separator':(c.type==='DropDownControl'?'dropdown:':'command:')+(c.commandDefinition?.id||c.id));
  const actual=await menu.locator(':scope > button,:scope > hr').evaluateAll(elements=>elements.map(e=>e.tagName==='HR'?'separator':e.hasAttribute('data-native-dropdown')?'dropdown:'+e.getAttribute('data-native-dropdown'):'command:'+e.getAttribute('data-native-menu-command')));
  assert.deepEqual(actual,expected);
  const box=await menu.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=2048&&box.y+box.height<=1137,'menu stays inside viewport');
  for(const item of await menu.locator(':scope > button').all()){
   assert.match(await item.getAttribute('aria-label'),/[А-Яа-яЁё]/,'Russian menu label');
   assert.equal(await item.locator('svg.live-icon, .live-icon svg').count(),await item.getAttribute('data-native-dropdown')?0:1,'native leaf has authored SVG; observed dropdown rows have no icon');
   if(!await item.getAttribute('data-command-id')&&!await item.getAttribute('aria-haspopup'))assert.equal(await item.isDisabled(),true,'unmapped operation is disabled');
  }
  menuRows.push({id:await menu.getAttribute('data-menu-id'),level,rows:actual,bounds:box});
 }
 for(const panel of panels){
  const nativePromoted=page.locator('section.live-sketch-group[data-native-panel="'+panel.id+'"] .live-tool:not([data-authored-promotion="true"])');
  assert.deepEqual(await nativePromoted.evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().width>0).map(e=>e.getAttribute('data-native-command'))),observations.promotedIds2048[panel.id]);
  const group=page.locator('[data-sketch-group="'+panel.id+'"]');await group.click();
  await checkMenu(panel.controls,0);
  if(panel.id==='SketchCreatePanel'){await screenshot('create-menu-2048');}
  visited.push(panel.id);await page.keyboard.press('Escape');
  for(const branch of dropdownPaths(panel.controls)){
   await group.click();
   for(const [level,id] of branch.path.entries())await page.locator('.live-sketch-menu[data-menu-level="'+level+'"] [data-native-dropdown="'+id+'"]').hover();
   await checkMenu(branch.controls,branch.path.length);submenus.push({panel:panel.id,path:branch.path});await page.keyboard.press('Escape');
  }
 }
 assert.equal(submenus.length,10);report.menus=visited;report.nativeSubmenus=submenus;report.menuRows=menuRows;
 phase='menu-keyboard';
 const createGroup=page.locator('[data-sketch-group="SketchCreatePanel"]');
 await createGroup.focus();await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator(':focus').getAttribute('data-native-menu-command'),'DrawPolyline','Opening a menu must commit its first-item focus');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.live-sketch-menu').count(),0);
 assert.equal(await createGroup.evaluate(element=>document.activeElement===element),true,'Escape restores the caption focus');
 // Keep these two key presses adjacent: a wait between them would hide a
 // requestAnimationFrame focus race that leaves the second key on the caption.
 await createGroup.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator(':focus').getAttribute('data-native-dropdown'),'RectangleDropDown');
 await page.keyboard.press('ArrowRight');await page.locator('.live-sketch-menu[data-menu-level="1"]').waitFor();
 assert.equal(await page.locator(':focus').getAttribute('data-native-menu-command'),'ShapeRectangleTwoPoint');
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator(':focus').getAttribute('data-native-dropdown'),'RectangleDropDown');
 assert.equal(await page.locator('.live-sketch-menu[data-menu-level="1"]').count(),0,'ArrowLeft closes the child menu while restoring its parent row');
 await page.keyboard.press('Home');assert.equal(await page.locator(':focus').getAttribute('data-native-menu-command'),'DrawPolyline');
 await page.keyboard.press('End');assert.notEqual(await page.locator(':focus').getAttribute('data-native-menu-command'),'DrawPolyline');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.live-sketch-menu').count(),0);
 await createGroup.click();await createGroup.click();assert.equal(await page.locator('.live-sketch-menu').count(),0);
 await createGroup.click();await click([40,-35]);assert.equal(await page.locator('.live-sketch-menu').count(),0);
 report.menuKeyboard={committedOpenFocus:true,rapidArrowDown:true,arrowDown:true,arrowRight:true,arrowLeft:true,arrowLeftRestoresParent:true,home:true,end:true,escape:true,escapeRestoresCaption:true,repeatClick:true,outsideClick:true};

 phase='native-dimension-leaf';await click([7,0]);
 await page.locator('[data-sketch-group="SketchCreatePanel"]').click();await page.locator('.live-sketch-menu[data-menu-level="0"] [data-native-menu-command="SketchDimension"]').click();
 assert.equal(await page.locator('.live-sketch-menu').count(),0);
 assert.equal(await page.locator('.live-workarea').getAttribute('data-active-command'),'dimension.diameter');
 report.nativeDimensionLeaf=true;await page.getByLabel('Размер',{exact:true}).press('Escape');

 phase='finish-and-reopen';await tool('sketch.finish').click();await page.waitForSelector('.live-workarea[data-workspace="solid"]');
 assert.equal(await page.locator('[data-testid="sketch-palette"]').count(),0);await screenshot('finished-2048');
 phase='extrude-mouse-built-profile';await tool('part.extrude').click();await page.getByLabel('Расстояние',{exact:true}).fill('10');await page.locator('.live-commit').click();
 await page.waitForFunction(()=>{const app=document.querySelector('.cad-app');return app?.getAttribute('data-feature-count')==='1'&&app?.getAttribute('data-recompute-status')==='clean';},{},{timeout:90000});
 const bounds=(await page.locator('.cad-viewport').getAttribute('data-bounds')).split(',').map(Number),expectedBounds=[-30,-20,0,30,20,10];
 bounds.forEach((value,index)=>assert.ok(Math.abs(value-expectedBounds[index])<.02,'mouse-built profile B-Rep bounds'));assert.equal(await page.locator('canvas').count(),1);
 await screenshot('extruded-2048');report.mouseBuiltProfileExtrusion={status:'PASS',distance:10,bounds,oneRenderer:true};
 await save();await page.reload();await quick('system.open').click();await page.waitForFunction(()=>document.querySelector('.cad-app')?.getAttribute('data-recompute-status')==='clean',{},{timeout:90000});await page.locator('[data-timeline-sketch]').first().click();
 await page.waitForSelector('.live-workarea[data-workspace="sketch"]');await count(6);
 assert.equal((await save()).dimensions.find(d=>d.id===diameter.id).value,14);
 phase='other-origin-planes';
 for(const [plane,label] of [['XZ','Спереди'],['YZ','Справа']]){
  const other=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});other.on('pageerror',error=>errors.push(error.message));
  await other.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8099/');
  await other.locator('.live-tool[data-command-id="part.sketch.create"]').click();await other.getByLabel('Плоскость эскиза',{exact:true}).selectOption(plane);await other.locator('.live-commit').click();
  await other.waitForSelector('[data-sketch-support="'+plane+'"]');assert.ok((await other.locator('.live-sketch-cube').textContent()).includes(label.toLocaleUpperCase('ru')));
  await other.locator('.live-tool[data-command-id="sketch.line"]').click();
  for(const world of [[-10,-5],[10,5]]){const point=await pixel(world,other);await other.mouse.click(point.x,point.y);}
  await other.waitForSelector('[data-testid="cad-sketch-overlay"][data-entity-count="1"]');await other.keyboard.press('Escape');
  await other.locator('.live-quickbar [data-command-id="system.save"]').click();
  await other.waitForFunction(()=>!!localStorage.getItem('asa-cad-m2-shell-document'));
  const savedPlane=await other.evaluate(()=>JSON.parse(localStorage.getItem('asa-cad-m2-shell-document')).sketches[0].support);assert.equal(savedPlane,plane);
  await other.locator('.live-tool[data-command-id="sketch.finish"]').click();await other.waitForSelector('.live-workarea[data-workspace="solid"]');await other.close();
 }
 report.originPlanes=['XY','XZ','YZ'];
 assert.deepEqual(errors,[]);
 Object.assign(report,{status:'PASS',scenarioA:{rectangle:'two pointer clicks, 60×40 mm driving line dimensions',circle:'two pointer clicks, Ø12 driving dimension, edited to Ø14 by annotation double click',constructionLine:true,horizontalConstraint:true,entities:6},palette:{grid:true,points:true,profiles:true,dimensions:true,constraints:true,collapse:true,noDocumentMutation:true},navigation:{idleWheel:true,middlePanIdle:true,middlePanActiveTool:true,planeNormal:true,reset:true,orbit:'BLOCKED: no shared 3D sketch camera / face-frame bridge'},annotationEdit:{cancelRetainsSketch:true,enterCommits:true},saveReopen:true,pageErrors:errors});
 await writeFile(resolve(out,'fusion-live-sketch-workspace-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 const pairedStates={new:'sketch-empty','create-menu':'create-menu','line-hover':'line-hover-final','line-tooltip':'line-tooltip-final',line:'line-active',rectangle:'rectangle-preview','circle-selected':'circle-diameter',palette:'circle-diameter',constraint:'circle-diameter',context:'context-empty-safe','context-sketch':'context-sketch-submenu','cube-normal':'circle-diameter'};
 const comparison={schemaVersion:2,parityRevision:'fusion-sketch-parity-002',status:'NOT_ACCEPTED',nativeSource:{version:reference.applicationVersion,capturedUTC:reference.capturedUTC,sha256:referenceCaptureSha256,dpi:110},activeNativeSketchScreenshotAvailable:true,candidateViewports:report.screenshots,toleranceCssPx:2,limitation:observations.nativeDpiPolicy,comparisons:Object.entries(pairedStates).map(([state,native])=>({state,candidate:'fusion-live-sketch-workspace-'+state+'-2048.png',native:'fusion-parity-native-'+native+'-2048-dpi110.png',panelDeltaCssPx:null,svgVisualParity:null,status:'AWAITING_VISUAL_REVIEW'}))};
 await writeFile(resolve(out,'fusion-live-sketch-visual-review.json'),JSON.stringify(comparison,null,2)+'\n');
}catch(error){
 console.error('PHASE',phase,error.stack);console.error('STATUS',await page.locator('.live-status').innerText().catch(()=>''));
 await writeFile(resolve(out,'fusion-live-sketch-workspace-checks.json'),JSON.stringify({...report,status:'FAIL',phase,error:error.message,pageErrors:errors},null,2)+'\n');
 await screenshot('debug').catch(()=>{});process.exitCode=1;
}finally{await browser.close();}
