import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const report={status:'RUNNING',kernelConnected:true,visualParityAccepted:false};
const base=process.env.ASA_FUSION_URL||'http://127.0.0.1:8093/';
const pose=()=>page.locator('.cad-viewport').evaluate(e=>({p:e.dataset.cameraPosition.split(',').map(Number),t:e.dataset.cameraTarget.split(',').map(Number),u:e.dataset.cameraUp.split(',').map(Number)}));
const norm=a=>{const m=Math.hypot(...a);return a.map(v=>v/m);};
const dir=p=>norm(p.p.map((v,i)=>v-p.t[i]));
const near=(a,b,eps=1e-4)=>a.every((x,i)=>Math.abs(x-b[i])<eps);
const menu=async label=>{await page.getByRole('button',{name:'Меню куба ориентации',exact:true}).click();if(['Большой куб','Средний куб','Маленький куб','Очень маленький куб','Автоматически'].includes(label))await page.getByRole('menuitem',{name:'Размер куба',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();if(label==='Текущий вид сделать главным')await page.getByRole('menuitem',{name:'Фиксированное расстояние',exact:true}).click();};
try{
 await page.goto(new URL('/dev/part/extrude',base).href);await page.waitForFunction(()=>!!document.querySelector('.cad-viewport')?.getAttribute('data-bounds'),null,{timeout:60000});
 await page.waitForSelector('.live-viewcube[data-camera-ready=true]');
 const all=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)all.push([x,y,z].join(','));
 const remaining=new Set(all),visited=[];
 for(let i=0;i<70&&remaining.size;i++){
  const visible=await page.locator('[data-cube-direction]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.cubeDirection))]);
  let chosen=visible.find(v=>remaining.has(v));
  if(!chosen){
   const queue=visible.map(v=>[v]),seen=new Set(visible);
   while(queue.length&&!chosen){const path=queue.shift(),last=path.at(-1);if(remaining.has(last)){chosen=path[0];break;}for(const target of all){if(!seen.has(target)&&last.split(',').some((n,k)=>+n*+target.split(',')[k]>0)){seen.add(target);queue.push([...path,target]);}}}
  }
  assert.ok(chosen,'Unreachable cube targets '+[...remaining]);
  const tile=page.locator('[data-cube-direction="'+chosen+'"]').first();await tile.click();
  const actual=dir(await pose());assert.ok(near(actual,norm(chosen.split(',').map(Number))),chosen+' camera mismatch '+actual);
  if(remaining.delete(chosen))visited.push(chosen);
 }
 assert.equal(remaining.size,0,'All 26 directions must be reached using rendered cube hit targets');report.clickedDirections=visited;
 await page.getByRole('button',{name:'Главный вид',exact:true}).click();
 await menu('Перспектива');assert.equal(await page.locator('canvas').getAttribute('data-projection'),'perspective');
 const matrixP=(await page.locator('canvas').getAttribute('data-projection-matrix')).split(',').map(Number);assert.equal(matrixP[11],-1);assert.equal(matrixP[15],0);
 await menu('Ортографическая');const matrixO=(await page.locator('canvas').getAttribute('data-projection-matrix')).split(',').map(Number);assert.equal(matrixO[11],0);assert.equal(matrixO[15],1);
 const canvas=page.locator('.cad-viewport canvas'),b=await canvas.boundingBox();await canvas.click({position:{x:b.width/2,y:b.height/2}});await page.waitForFunction(()=>!!document.querySelector('.cad-app')?.getAttribute('data-selected-body-id'));
 const beforeZoom=await canvas.getAttribute('data-camera-zoom');await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,-180);await page.waitForTimeout(300);assert.notEqual(await canvas.getAttribute('data-camera-zoom'),beforeZoom);
 await menu('Перспектива с ортогональными гранями');await page.locator('[data-cube-face=top]').click();assert.equal(await canvas.getAttribute('data-projection'),'orthographic');
 await page.locator('[data-cube-direction="1,-1,1"]').first().click();assert.equal(await canvas.getAttribute('data-projection'),'perspective');
 const beforeOrbit=await pose();await page.keyboard.down('Shift');await page.mouse.move(b.x+b.width*.6,b.y+b.height*.6);await page.mouse.down({button:'middle'});await page.mouse.move(b.x+b.width*.6+100,b.y+b.height*.6+30,{steps:8});await page.mouse.up({button:'middle'});await page.keyboard.up('Shift');const afterOrbit=await pose();assert.ok(!near(beforeOrbit.p,afterOrbit.p));assert.ok(near(beforeOrbit.t,afterOrbit.t));
 await menu('Текущий вид сделать главным');const home=await pose();
 const cube=page.locator('.live-viewcube>svg'),cb=await cube.boundingBox();await page.mouse.move(cb.x+cb.width*.5,cb.y+cb.height*.5);await page.mouse.down();await page.mouse.move(cb.x+cb.width*.5-35,cb.y+cb.height*.5+21,{steps:7});await page.mouse.up();assert.ok(!near((await pose()).p,home.p));
 await page.getByRole('button',{name:'Главный вид',exact:true}).click();const restored=await pose();assert.ok(near(restored.p,home.p));assert.ok(near(restored.u,home.u));
 await menu('Большой куб');assert.equal(Math.round((await page.locator('.live-viewcube').boundingBox()).width),168);await menu('Средний куб');
 await page.screenshot({path:resolve(out,'fusion-live-viewcube.png')});
 assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);
 Object.assign(report,{status:'PASS',cubeDirections:26,realProjectionMatrices:true,orthographicPicking:true,orthographicWheelZoom:true,mixedProjection:true,shiftMiddleOrbit:true,cubeDrag:true,savedHomeRestored:true,sizeMenu:true,singleRenderer:true,pageErrors:errors});
 await writeFile(resolve(out,'fusion-live-navigation-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e.stack);console.error('ERRORS',errors);await page.screenshot({path:resolve(out,'fusion-live-navigation-debug.png')}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
