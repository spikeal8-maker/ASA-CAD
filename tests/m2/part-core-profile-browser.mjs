import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const executablePath=process.env.ASA_CAD_BROWSER_EXECUTABLE;
const browser=await chromium.launch(executablePath?{headless:true,executablePath}:{headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));

const app=()=>page.locator('.cad-app');
const stage=()=>page.locator('[data-testid="part-model-stage"]');
const overlay=()=>page.locator('[data-testid="cad-sketch-overlay"]');
const viewport=()=>page.locator('[data-testid="cad-viewport"]');

async function command(id){
  const button=page.locator(`[data-command-id="${id}"]`).filter({visible:true}).first();
  await button.waitFor();
  assert.equal(await button.isEnabled(),true,`${id} disabled: ${await button.getAttribute('title')}`);
  await button.click();
}
async function createSketch(){
  await command('part.sketch.create');
  await page.getByRole('button',{name:/XY/}).click();
  await page.locator('.parameter-actions button.primary').click();
  const id=await app().getAttribute('data-active-sketch-id');
  assert.ok(id); return id;
}

async function screenPoint(layer,[x,y]){
  const box=await layer.boundingBox(); assert.ok(box);
  const state=await stage().evaluate((node)=>({
    span:Number(node.getAttribute('data-sketch-view-span')),
    center:(node.getAttribute('data-sketch-view-center')??'0,0').split(',').map(Number),
  }));
  const scale=Math.min(box.width,box.height)/state.span;
  const side=state.span*scale;
  const left=box.x+(box.width-side)/2;
  const top=box.y+(box.height-side)/2;
  return {
    x:left+(x-(state.center[0]-state.span/2))*scale,
    y:top+((state.center[1]+state.span/2)-y)*scale,
  };
}
async function drawSegment(from,to,count,{zoomOut=false}={}){
  await command('sketch.line');
  const layer=page.locator('[data-testid="cad-sketch-interaction"][data-tool="line"]');
  await layer.waitFor();
  if(zoomOut){
    const box=await layer.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,350);
    await page.waitForFunction(()=>Number(document.querySelector('[data-testid="part-model-stage"]')?.getAttribute('data-sketch-view-span'))>140);
  }
  const a=await screenPoint(layer,from);
  const b=await screenPoint(layer,to);
  await page.mouse.click(a.x,a.y);
  await page.mouse.click(b.x,b.y);
  await page.locator(`[data-testid="cad-sketch-overlay"][data-entity-count="${count}"]`).waitFor();
}
async function applyExtrude10(){
  await command('part.extrude');
  const panel=page.locator('.extrude-parameter-panel'); await panel.waitFor();
  await panel.locator('.numeric-field input').first().fill('10');
  await panel.locator('.parameter-actions button.primary').click();
}

async function bounds(){
  const raw=await viewport().getAttribute('data-bounds');
  assert.ok(raw); return raw.split(',').map(Number);
}
function near(actual,expected,tolerance,label){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);
}
async function save(){
  const expected={
    sketches:Number(await app().getAttribute('data-sketch-count')),
    features:Number(await app().getAttribute('data-feature-count')),
  };
  await command('system.save');
  await page.waitForFunction(({sketches,features})=>{
    const raw=localStorage.getItem('asa-cad-m2-shell-document');
    if(!raw) return false;
    const document=JSON.parse(raw);
    return document.sketches.length===sketches && document.features.length===features;
  },expected);
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw); return JSON.parse(raw);
}
async function newPart(){
  await save();
  await page.locator('.new-tab-button').click();
  const dialog=page.getByRole('dialog',{name:'Новый документ'});
  await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-sketch-count="0"]').waitFor();
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await app().waitFor();
  await createSketch();

  const l=[[0,0],[60,0],[60,20],[20,20],[20,40],[0,40],[0,0]];
  for(let i=0;i<l.length-1;i++) await drawSegment(l[i],l[i+1],i+1,{zoomOut:i===0});
  await command('sketch.finish');
  await applyExtrude10();
  await page.locator('.cad-app[data-recompute-status="clean"][data-feature-count="1"]').waitFor({timeout:120000});
  const lBounds=await bounds();
  near(lBounds[3]-lBounds[0],60,0.6,'L body width');
  near(lBounds[4]-lBounds[1],40,0.6,'L body height');
  near(lBounds[5]-lBounds[2],10,0.1,'L body depth');
  const lDoc=await save();
  assert.equal(lDoc.sketches[0].entities.length,6);
  assert.equal(lDoc.features.length,1);

  const palette=await page.evaluate(()=>({
    menu:getComputedStyle(document.querySelector('.main-menu-bar')).backgroundColor,
    ribbon:getComputedStyle(document.querySelector('.instrument-area')).backgroundColor,
    panel:getComputedStyle(document.querySelector('.management-panel')).backgroundColor,
  }));
  assert.deepEqual(palette,{menu:'rgb(51, 51, 51)',ribbon:'rgb(72, 72, 72)',panel:'rgb(72, 72, 72)'});
  assert.equal(await page.locator('.panel-title-row button[title^="Параметры дерева"]').isDisabled(),true);
  const rawBeforeSearch=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  const treeSearch=page.getByRole('textbox',{name:'Найти в дереве'});
  await treeSearch.fill('Эскиз');
  await page.locator('[data-sketch-branch-id]').waitFor();
  assert.equal(await page.locator('[data-body-id]').count(),0,'tree search must filter unrelated body rows');
  await treeSearch.fill('');
  await page.locator('[data-body-id]').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document')),rawBeforeSearch);

  await newPart();
  await createSketch();
  const open=[[0,0],[40,0],[40,20],[0,20]];
  for(let i=0;i<open.length-1;i++) await drawSegment(open[i],open[i+1],i+1);
  await command('sketch.finish');
  await applyExtrude10();
  const error=page.locator('.parameter-inline-error');
  await error.waitFor();
  assert.match(await error.textContent()??'',/closed contour|контур|profile/i);
  assert.equal(await app().getAttribute('data-feature-count'),'0','invalid profile created a feature');
  assert.equal(await page.locator('[data-body-id]').count(),0,'invalid profile created a fake body');
  const invalidDoc=await save();
  assert.equal(invalidDoc.features.length,0);
  assert.equal(invalidDoc.bodies.length,0);

  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  console.log('PART_CORE_PROFILE_UI PASS (L-shape pointer flow + invalid-profile fail-honest)');
}finally{
  await browser.close();
}
