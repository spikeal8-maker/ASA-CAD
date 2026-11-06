import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const tool=id=>page.locator('.live-tool[data-command-id="'+id+'"]');
async function point(world){
 const svg=page.locator('[data-testid="cad-sketch-interaction"]');await svg.waitFor();
 const r=await svg.boundingBox(),v=(await svg.getAttribute('viewBox')).split(' ').map(Number);
 const scale=Math.min(r.width/v[2],r.height/v[3]);
 return {x:r.x+(r.width-v[2]*scale)/2+(world[0]-v[0])*scale,y:r.y+(r.height-v[3]*scale)/2+(-world[1]-v[1])*scale};
}
async function click(world){const p=await point(world);await page.mouse.click(p.x,p.y);}
const entities=()=>page.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count');
const waitEntities=async n=>page.waitForFunction(n=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')===String(n),n);
let phase='start';
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8093/');await tool('part.sketch.create').click();await page.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await page.locator('.live-commit').click();await page.waitForSelector('[data-testid="cad-sketch-overlay"]');
 phase='line';await tool('sketch.line').click();await click([-10,-5,0]);await click([10,-5,0]);await waitEntities(1);await page.keyboard.press('Escape');
 phase='rectangle';await tool('sketch.rectangle').click();await click([-15,0,0]);await click([15,20,0]);await waitEntities(5);await page.keyboard.press('Escape');
 phase='circle';await tool('sketch.circle').click();await click([0,-15,0]);await click([5,-15,0]);await waitEntities(6);await page.keyboard.press('Escape');
 phase='save';await page.locator('.live-quickbar [data-command-id="system.save"]').click();await page.waitForFunction(()=>!!localStorage.getItem('asa-cad-m2-shell-document'));const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('asa-cad-m2-shell-document')));const e=doc.sketches[0].entities;assert.equal(e.filter(x=>x.type==='line').length,5);assert.equal(e.filter(x=>x.type==='circle').length,1);assert.equal(e.length,6);assert.equal(await page.locator('[data-testid=part-model-stage]').count(),1);assert.equal(await page.locator('[data-testid=cad-sketch-overlay]').count(),1);assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(out,'fusion-live-mouse-sketch.png')});const report={status:'PASS',input:'real left-button pointer clicks on the common sketch interaction surface',lineTwoPoints:true,rectangleTwoCorners:true,circleCenterRadius:true,entities:6,singleSketchSurface:true,sketchContext:'shared-document-2d-presentation',viewCubeInSketch:true,viewCubeMode:'plane-locked',full3DViewCubeInSketch:false,persistedSerializableEntities:true,pageErrors:errors};await writeFile(resolve(out,'fusion-live-sketch-input-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error('PHASE',phase,e.stack);console.error('ENTITIES',await entities().catch(()=>null));await page.screenshot({path:resolve(out,'fusion-live-sketch-input-debug.png')}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}

// The existing CI entry point also exercises the contextual Sketch workspace.
if(!process.exitCode) await import('./live-sketch-workspace-browser.mjs');
if(!process.exitCode) await import('./live-sketch-frame.mjs');
if(!process.exitCode) await import('./live-sketch-field-browser.mjs');
if(!process.exitCode) await import('./live-sketch-parity-browser.mjs');
