import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const executablePath=process.env.ASA_CAD_BROWSER_EXECUTABLE;
const browser=await chromium.launch(executablePath?{headless:true,executablePath}:{headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));

const app=()=>page.locator('.cad-app');
const overlay=()=>page.locator('[data-testid="cad-sketch-overlay"]');
const viewport=()=>page.locator('[data-testid="cad-viewport"]');

async function command(id){
  const button=page.locator(`[data-command-id="${id}"]`).filter({visible:true}).first();
  await button.waitFor();
  assert.equal(await button.isEnabled(),true,`${id} disabled: ${await button.getAttribute('title')}`);
  await button.click();
}
async function bounds(){
  const raw=await viewport().getAttribute('data-bounds');
  assert.ok(raw,'missing runtime bounds');
  return raw.split(',').map(Number);
}
async function save(){
  await command('system.save');
  await page.waitForFunction(()=>localStorage.getItem('asa-cad-m2-shell-document')!==null);
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'saved document missing');
  return JSON.parse(raw);
}
async function lines(){
  return overlay().locator('line[data-sketch-entity-id]').evaluateAll((nodes)=>nodes.map((line)=>({
    id:line.getAttribute('data-sketch-entity-id'),
    x1:Number(line.getAttribute('x1')),y1:Number(line.getAttribute('y1')),
    x2:Number(line.getAttribute('x2')),y2:Number(line.getAttribute('y2')),
  })));
}
function horizontalLengths(items){
  return items.filter((line)=>Math.abs(line.y1-line.y2)<0.2).map((line)=>Math.abs(line.x2-line.x1)).sort((a,b)=>a-b);
}
function verticalLengths(items){
  return items.filter((line)=>Math.abs(line.x1-line.x2)<0.2).map((line)=>Math.abs(line.y2-line.y1)).sort((a,b)=>a-b);
}
function near(actual,expected,tolerance,label){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);
}
async function clickHorizontalEdge(){
  const candidates=overlay().locator('line[data-sketch-entity-id]');
  for(let index=0;index<await candidates.count();index++){
    const line=candidates.nth(index);
    const hit=await line.evaluate((node)=>{
      const x1=Number(node.getAttribute('x1')),y1=Number(node.getAttribute('y1'));
      const x2=Number(node.getAttribute('x2')),y2=Number(node.getAttribute('y2'));
      if(Math.abs(y1-y2)>0.2) return null;
      const matrix=node.getScreenCTM(); if(!matrix) return null;
      const point=new DOMPoint((x1+x2)/2,(y1+y2)/2).matrixTransform(matrix);
      return {x:point.x,y:point.y,id:node.getAttribute('data-sketch-entity-id')};
    });
    if(hit){
      await page.mouse.click(hit.x,hit.y);
      await app().waitFor();
      await page.locator(`.cad-app[data-selected-sketch-entity-id="${hit.id}"]`).waitFor();
      return hit.id;
    }
  }
  throw new Error('horizontal Sketch edge not found');
}
async function openSketch(sketchId){
  await page.locator(`[data-sketch-id="${sketchId}"]`).click();
  await page.locator(`[data-sketch-edit-id="${sketchId}"]`).click();
  await page.locator(`.cad-app[data-active-sketch-id="${sketchId}"]`).waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="4"]').waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-overlay-source="solver-preview"]').waitFor();
}
async function createDirectRectangle60x40(){
  await command('sketch.rectangle');
  const layer=page.locator('[data-testid="cad-sketch-interaction"][data-tool="rectangle"]');
  await layer.waitFor();
  const box=await layer.boundingBox(); assert.ok(box);
  const side=Math.min(box.width,box.height);
  const point=(x,y)=>({x:box.x+(box.width-side)/2+side*x,y:box.y+(box.height-side)/2+side*y});
  const first=point(0.20,0.30),opposite=point(0.80,0.70);
  await page.mouse.click(first.x,first.y);
  await page.mouse.move(opposite.x,opposite.y);
  await page.mouse.click(opposite.x,opposite.y);
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="4"]').waitFor();
}
async function applyExtrude10(){
  await command('part.extrude');
  const panel=page.locator('.extrude-parameter-panel'); await panel.waitFor();
  const field=panel.locator('.numeric-field input').first();
  await field.fill('10');
  await panel.locator('.parameter-actions button.primary').click();
  await page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({timeout:120000});
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"]').waitFor();

  await command('part.sketch.create');
  await page.getByRole('button',{name:/XY/}).click();
  await page.locator('.parameter-actions button.primary').click();
  const sketchId=await app().getAttribute('data-active-sketch-id');
  assert.ok(sketchId,'active Sketch id missing');

  await createDirectRectangle60x40();
  await command('sketch.finish');
  await applyExtrude10();
  let shape=await bounds();
  near(shape[3]-shape[0],60,0.6,'initial body width');
  near(shape[4]-shape[1],40,0.6,'initial body height');
  near(shape[5]-shape[2],10,0.1,'initial body depth');

  await openSketch(sketchId);
  const dimensionEntityId=await clickHorizontalEdge();
  await command('dimension.horizontal');
  const field=page.locator('.parameter-panel .numeric-field input'); await field.waitFor();
  await field.fill('80');
  await page.locator('.parameter-actions button.primary').click();
  await page.locator('[data-testid="cad-sketch-overlay"][data-overlay-source="solver-preview"]').waitFor();

  await command('sketch.finish');
  await command('system.rebuild');
  await page.locator('.cad-app[data-recompute-status="clean"]').waitFor({timeout:120000});
  shape=await bounds();
  near(shape[3]-shape[0],80,0.6,'edited body width');
  near(shape[4]-shape[1],40,0.6,'edited body height');
  near(shape[5]-shape[2],10,0.1,'edited body depth');

  const saved=await save();
  const dimension=saved.dimensions.find((item)=>item.entityIds.includes(dimensionEntityId));
  assert.ok(dimension,'driving dimension missing');
  assert.equal(dimension.value,80);
  assert.ok(saved.sketches[0].dimensionIds.includes(dimension.id),'dimension ownership missing');

  await page.reload({waitUntil:'networkidle'});
  await command('system.open');
  await page.locator('.cad-app[data-feature-count="1"][data-sketch-count="1"]').waitFor();
  await page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({timeout:120000});
  const reopenedBounds=await bounds();
  near(reopenedBounds[3]-reopenedBounds[0],80,0.6,'reopened body width');

  await openSketch(sketchId);
  const solved=await lines();
  const horizontal=horizontalLengths(solved);
  const vertical=verticalLengths(solved);
  assert.equal(horizontal.length,2);
  assert.equal(vertical.length,2);
  for(const value of horizontal) near(value,80,0.3,'solved horizontal edge');
  for(const value of vertical) near(value,40,0.3,'solved vertical edge');

  const reopened=await save();
  assert.equal(reopened.dimensions.find((item)=>item.id===dimension.id)?.value,80);
  assert.deepEqual(reopened.sketches[0].dimensionIds,saved.sketches[0].dimensionIds);
  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  console.log('PART_CORE_PARAMETRIC_GEOMETRY PASS');
}finally{
  await browser.close();
}
