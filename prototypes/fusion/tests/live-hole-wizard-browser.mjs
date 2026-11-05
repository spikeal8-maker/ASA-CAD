import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {PerspectiveCamera,Vector3} from '../../../vendor/toubkal/node_modules/three/build/three.module.js';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],failed=[];
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
const tool=id=>page.locator('.live-tool[data-command-id="'+id+'"]');
const wizard=()=>page.locator('.live-hole-wizard');
const stage=s=>page.locator('.live-hole-wizard[data-hole-stage="'+s+'"]');
const menu=()=>page.locator('[data-native-group="SolidCreatePanel"]').click();
const hole=()=>page.locator('[data-native-menu-command="FusionHoleCommand"]');
const commit=()=>page.locator('.live-commit').click();
async function pick(world){
 const canvas=page.locator('.cad-viewport canvas'),box=await canvas.boundingBox();
 const pose=await page.locator('.cad-viewport').evaluate(e=>({
  position:e.dataset.cameraPosition.split(',').map(Number),
  target:e.dataset.cameraTarget.split(',').map(Number),
  up:e.dataset.cameraUp.split(',').map(Number),
  matrix:e.querySelector('canvas').dataset.projectionMatrix.split(',').map(Number),
 }));
 const camera=new PerspectiveCamera();camera.position.fromArray(pose.position);camera.up.fromArray(pose.up);
 camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld(true);
 camera.projectionMatrix.fromArray(pose.matrix);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 const projected=new Vector3(...world).project(camera);
 assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'Pick outside visible model');
 await page.mouse.click(box.x+(projected.x+1)*box.width/2,box.y+(1-projected.y)*box.height/2);
}
const count=async()=>page.locator('.cad-app').evaluate(e=>({
 sketches:Number(e.dataset.sketchCount),features:Number(e.dataset.featureCount),
 status:e.dataset.recomputeStatus,activeSketch:e.dataset.activeSketchId,
}));
let phase='start';
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8097/');
 await page.waitForSelector('.live-ribbon');
 // A Hole must not be advertised as available before the body exists.
 phase='empty-disabled';
 await menu();assert.equal(await hole().isEnabled(),false,'Cannot make a hole without solid body');
 await page.keyboard.press('Escape');
 // Build first B-Rep body by ordinary UI.
 phase='solid';
 await tool('part.sketch.create').click();
 await page.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await commit();
 await tool('sketch.rectangle').click();
 await page.getByLabel('Ширина',{exact:true}).fill('60');
 await page.getByLabel('Высота',{exact:true}).fill('40');await commit();
 await tool('sketch.finish').click();await tool('part.extrude').click();
 await page.getByLabel('Расстояние',{exact:true}).fill('10');await commit();
 await page.waitForFunction(()=>document.querySelector('.cad-app')?.dataset.featureCount==='1'&&!!document.querySelector('.cad-viewport')?.dataset.bounds,{timeout:60000});
 await page.getByRole('button',{name:'Главный вид',exact:true}).click();
 // The original Hole keyboard shortcut must trigger the same real workflow.
 phase='shortcut-h';
 await page.keyboard.press('h');await stage('support').waitFor();
 await page.getByRole('button',{name:'Закрыть мастер отверстия'}).click();
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.dataset.activeCommand==='');
 // Search must use the identical native action and never an independent kernel.
 phase='search';
 await page.locator('.live-search').fill('Отверстие');
 const searchHole=page.locator('.live-search-results').getByRole('button',{name:'Отверстие',exact:true});
 await searchHole.waitFor();assert.equal(await searchHole.isEnabled(),true);
 await searchHole.click();await stage('support').waitFor();
 await page.getByRole('button',{name:'Закрыть мастер отверстия'}).click();
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.dataset.activeCommand==='');
 // The right-click radial slot must open that very same wizard.
 phase='marking';
 const canvas=page.locator('.cad-viewport canvas'),bounds=await canvas.boundingBox();
 await page.mouse.click(bounds.x+bounds.width*.6,bounds.y+bounds.height*.35,{button:'right'});
 const radialHole=page.locator('.marking-slot[data-marking-slot="3"]');
 await radialHole.waitFor();assert.equal(await radialHole.isEnabled(),true);
 await radialHole.click();await stage('support').waitFor();
 await page.getByRole('button',{name:'Закрыть мастер отверстия'}).click();
 await page.waitForFunction(()=>document.querySelector('.live-workarea')?.dataset.activeCommand==='');
 // Cancelling a wizard must not mutate CAD-document history or leave a transient sketch.
 phase='cancel';
 await menu();await hole().waitFor();assert.equal(await hole().isEnabled(),true,'Hole should become available for a valid solid');
 await hole().click();await stage('support').waitFor();
 assert.equal(await count().then(x=>x.features),1);
 await page.getByRole('button',{name:'Закрыть мастер отверстия'}).click();
 await page.waitForFunction(()=>!document.querySelector('.live-hole-wizard'));
 assert.equal((await count()).sketches,1,'Closing before creating support should not add sketch');
 assert.equal((await count()).features,1,'Closing before creating support should not add feature');
 // Complete the native menu entry through *actual* shared actions.
 phase='support';
 await menu();assert.equal(await hole().isEnabled(),true);await hole().click();
 await stage('support').waitFor();await page.locator('.cad-viewport[data-selection-mode="face"]').waitFor();
 await pick([0,0,10]);await page.locator('.cad-app[data-selected-kind="face"]').waitFor();
 await page.screenshot({path:resolve(out,'fusion-v7-hole-select-face.png')});
 await commit();
 await stage('circle').waitFor();
 assert.equal((await count()).sketches,2);
 phase='circle';
 await wizard().getByRole('button',{name:'Нарисовать окружность'}).click();
 await page.getByLabel('Диаметр',{exact:true}).fill('-5');
 assert.equal(await page.locator('.live-commit').isDisabled(),true,'Negative hole diameter must not be committed');
 await page.getByLabel('Диаметр',{exact:true}).fill('12');
 assert.equal(await page.locator('.live-commit').isEnabled(),true);
 await commit();
 await stage('finish').waitFor();
 await page.screenshot({path:resolve(out,'fusion-v7-hole-circle.png')});
 phase='finish';
 await wizard().getByRole('button',{name:'Завершить эскиз'}).click();await stage('cut').waitFor();
 phase='cut';
 await wizard().getByRole('button',{name:'Вырезать сквозь тело'}).click();
 await page.locator('.live-parameters[data-command="part.cutExtrude"]').waitFor();
 assert.equal((await count()).features,1,'Starting a cut must not mutate B-Rep until confirmed');
 assert.equal(await page.getByLabel('Операция',{exact:true}).inputValue(),'cut');
 await commit();
 await stage('complete').waitFor();
 await page.waitForFunction(()=>document.querySelector('.cad-app')?.dataset.featureCount==='2'&&document.querySelector('.cad-app')?.dataset.recomputeStatus==='clean',{timeout:90000});
 await page.screenshot({path:resolve(out,'fusion-v7-hole-complete.png')});
 assert.equal((await count()).features,2);
 await wizard().getByRole('button',{name:'Готово'}).click();
 assert.equal(await wizard().count(),0);
 phase='save-open';
 await page.locator('.live-quickbar [data-command-id="system.save"]').click();
 await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
 const saved=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
 assert.ok(saved,'Must save real CAD document');
 const doc=JSON.parse(saved);
 assert.deepEqual(doc.features.map(x=>x.type),['extrude','cut-extrude']);
 assert.equal(doc.sketches.length,2);
 assert.equal(doc.bodies.length,1);
 assert.equal(doc.stableReferences.length,1);
 assert.equal(doc.dimensions.find(x=>x.name==='diameter').value,12);
 assert.equal(doc.features[1].parameters.sketchId,doc.sketches[1].id);
 await page.reload();await page.waitForSelector('.live-ribbon');
 await page.locator('.live-quickbar [data-command-id="system.open"]').click();
 await page.waitForFunction(()=>document.querySelector('.cad-app')?.dataset.featureCount==='2'&&document.querySelector('.cad-app')?.dataset.recomputeStatus==='clean',{timeout:90000});
 assert.equal((await count()).sketches,2);
 assert.deepEqual(errors,[],'Unexpected browser errors');
 assert.deepEqual(failed,[],'Unexpected network failures');
 const report={status:'PASS',scope:'Guided basic through-hole only',nativeEntry:'FusionHoleCommand',entryPoints:['native-menu','keyboard-H','command-search','right-click-radial'],invalidNegativeDiameterRejected:true,realSharedActions:['part.sketch.create','sketch.circle','sketch.finish','part.cutExtrude'],support:'selected top B-Rep face',diameter:12,featureTypes:doc.features.map(f=>f.type),stableReferences:doc.stableReferences.length,wizardCancellationDoesNotMutateDocument:true,oneCadDocument:true,saveOpenPass:true,fullFusionHoleParity:false,advancedModesImplemented:false,pageErrors:errors,failedRequests:failed};
 await writeFile(resolve(out,'fusion-v7-hole-checks.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}catch(e){
 console.error('PHASE',phase,e.stack);
 console.error('COUNTS',await count().catch(()=>({})));
 console.error('ERRORS',errors);
 await page.screenshot({path:resolve(out,'fusion-v7-hole-debug.png')}).catch(()=>{});
 process.exitCode=1;
}finally{await browser.close();}
