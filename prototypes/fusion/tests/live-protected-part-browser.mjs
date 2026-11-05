import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {PerspectiveCamera,Vector3} from '../../../vendor/toubkal/node_modules/three/build/three.module.js';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],failed=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
const tool=id=>page.locator('.live-tool[data-command-id="'+id+'"]');
const quick=id=>page.locator('.live-quickbar [data-command-id="'+id+'"]');
const ok=()=>page.locator('.live-commit').click();
const model=async()=>page.locator('.cad-viewport').evaluate(e=>({p:e.dataset.cameraPosition.split(',').map(Number),t:e.dataset.cameraTarget.split(',').map(Number),up:e.dataset.cameraUp.split(',').map(Number),bounds:e.dataset.bounds.split(',').map(Number)}));
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<.02,'Bounds '+a+' expected '+b));};
async function pick(point){
 const c=page.locator('.cad-viewport canvas'),box=await c.boundingBox(),p=await model();
 const camera=new PerspectiveCamera();camera.position.fromArray(p.p);camera.up.fromArray(p.up);camera.lookAt(new Vector3(...p.t));camera.updateMatrixWorld(true);
 camera.projectionMatrix.fromArray((await c.getAttribute('data-projection-matrix')).split(',').map(Number));camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 const v=new Vector3(...point).project(camera);assert.ok(Math.abs(v.x)<1&&Math.abs(v.y)<1,'Test point outside camera');
 await page.mouse.click(box.x+(v.x+1)*box.width/2,box.y+(1-v.y)*box.height/2);
}
const waitModel=async n=>page.waitForFunction(n=>{const a=document.querySelector('.cad-app');return a?.getAttribute('data-feature-count')===String(n)&&a?.getAttribute('data-recompute-status')==='clean';},n,{timeout:90000});
let phase='start';const report={status:'RUNNING',scope:'Ordinary UI protected Part, no injected document or kernel calls',kernelConnected:true,visualParityAccepted:false};
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8093/');await page.waitForSelector('.live-viewcube[data-camera-ready=true]');
 await tool('part.sketch.create').click();await page.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await ok();
 await tool('sketch.rectangle').click();await page.getByLabel('Ширина',{exact:true}).fill('60');await page.getByLabel('Высота',{exact:true}).fill('40');await ok();await page.waitForFunction(()=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')==='4');
 await tool('sketch.finish').click();await tool('part.extrude').click();await page.getByLabel('Расстояние',{exact:true}).fill('10');await ok();await waitModel(1);
 phase='face-sketch';await page.getByRole('button',{name:'Главный вид',exact:true}).click();await tool('part.sketch.create').click();await page.waitForSelector('.cad-viewport[data-selection-mode=face]');await pick([0,0,10]);await page.waitForSelector('.cad-app[data-selected-kind=face]');await ok();await page.waitForSelector('.cad-app[data-sketch-count="2"]');
 const sketchStage=page.locator('[data-testid=part-model-stage]');
 report.faceSketch={support:await sketchStage.getAttribute('data-sketch-support'),projection:await sketchStage.getAttribute('data-sketch-projection'),modelContextReady:await sketchStage.getAttribute('data-model-context-ready'),viewCubeMode:await page.locator('.live-sketch-cube').getAttribute('data-sketch-mode')};
 assert.equal(report.faceSketch.projection,'stable-reference');assert.equal(report.faceSketch.modelContextReady,'false');assert.equal(report.faceSketch.viewCubeMode,'plane-locked');assert.ok(report.faceSketch.support.startsWith('ref_'));
 phase='circle';await tool('sketch.circle').click();await page.getByLabel('Диаметр',{exact:true}).fill('12');await ok();await page.getByText('Окружность Ø12 мм создана',{exact:true}).waitFor();await tool('sketch.finish').click();
 phase='cut';await tool('part.cutExtrude').click();assert.equal(await page.getByLabel('Операция',{exact:true}).inputValue(),'cut');await ok();await waitModel(2);near((await model()).bounds,[-30,-20,0,30,20,10]);
 phase='fillet';await page.getByRole('button',{name:'Главный вид',exact:true}).click();await tool('part.fillet').click();await page.waitForSelector('.cad-viewport[data-selection-mode=edge]');await pick([0,-20,0]);await page.waitForSelector('.cad-app[data-selected-kind=edge]');await page.getByLabel('Радиус',{exact:true}).fill('1');await ok();await waitModel(3);near((await model()).bounds,[-30,-20,0,30,20,10]);
 await page.screenshot({path:resolve(out,'fusion-live-protected-part.png')});
 phase='width-edit';await page.locator('[data-dimension-id]',{hasText:/Ширина: 60 мм/}).click();await page.getByLabel('Значение',{exact:true}).fill('80');await ok();await page.getByText('Ширина изменен на 80 мм; модель перестроена',{exact:true}).waitFor({timeout:90000});near((await model()).bounds,[-40,-20,0,40,20,10]);
 phase='save';await quick('system.save').click();await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
 const saved=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));assert.ok(saved);const doc=JSON.parse(saved);
 assert.deepEqual(doc.features.map(f=>f.type),['extrude','cut-extrude','fillet']);assert.equal(doc.sketches.length,2);assert.equal(doc.bodies.length,1);assert.equal(doc.stableReferences.length,2);assert.equal(doc.dimensions.find(d=>d.name==='width').value,80);assert.equal(doc.dimensions.find(d=>d.name==='diameter').value,12);for(const term of ['TopoDS','faceIndex','segmentIndex'])assert.equal(saved.includes(term),false,term+' leaked to persisted intent');
 phase='reopen';await page.reload();await page.waitForSelector('.live-ribbon');await quick('system.open').click();await waitModel(3);near((await model()).bounds,[-40,-20,0,40,20,10]);
 phase='reedit-hole';await page.locator('[data-dimension-id]',{hasText:/Диаметр: 12 мм/}).click();await page.getByLabel('Значение',{exact:true}).fill('14');await ok();await page.getByText('Диаметр изменен на 14 мм; модель перестроена',{exact:true}).waitFor({timeout:90000});await waitModel(3);near((await model()).bounds,[-40,-20,0,40,20,10]);
 await page.getByRole('button',{name:'Главный вид',exact:true}).click();await page.screenshot({path:resolve(out,'fusion-live-protected-part-reopened.png')});
 assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 Object.assign(report,{status:'PASS',base:'60x40x10 mm',cutDiameter:12,filletRadius:1,widthEdited:80,reopenedDiameterEdited:14,features:doc.features.map(f=>f.type),stableReferences:2,serializableIntent:true,oneRenderer:true,pageErrors:errors,failedRequests:failed});
 await writeFile(resolve(out,'fusion-live-protected-part-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error('PHASE',phase,e.stack);console.error('STATUS',await page.locator('.live-status').innerText().catch(()=>''));await page.screenshot({path:resolve(out,'fusion-live-protected-debug.png')}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
