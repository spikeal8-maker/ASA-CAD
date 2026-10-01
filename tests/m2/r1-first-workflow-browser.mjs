import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const executablePath=process.env.ASA_CAD_BROWSER_EXECUTABLE;
const browser=await chromium.launch(executablePath?{headless:true,executablePath}:{headless:true});

function near(actual,expected,tolerance,label){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);
}
function pointNear(actual,expected,label){
  near(actual[0],expected[0],0.001,`${label}.x`);
  near(actual[1],expected[1],0.001,`${label}.y`);
}
async function fileCommand(page,label){
  await page.getByRole('button',{name:'Файл',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Файл',exact:true}); await menu.waitFor();
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
}
async function newDocument(page,name){
  await fileCommand(page,'Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:new RegExp(name)}).click();
}
async function drawingPoint(page,x,y){
  return page.locator('[data-testid="cad-sketch-interaction"]').evaluate((svg,p)=>{
    const m=svg.getScreenCTM(); if(!m) throw new Error('Drawing CTM missing');
    const q=new DOMPoint(p.x,-p.y).matrixTransform(m);
    return {x:q.x,y:q.y};
  },{x,y});
}
async function clickDrawingPoint(page,x,y){
  const p=await drawingPoint(page,x,y); await page.mouse.click(p.x,p.y);
}
async function lineState(page,id){
  const line=page.locator(`[data-drawing-entity-id="${id}"]`);
  await line.waitFor({state:'attached'});
  return line.evaluate((node)=>({
    id:node.getAttribute('data-drawing-entity-id'),
    length:Number(node.getAttribute('data-drawing-length')),
    from:[Number(node.getAttribute('x1')), -Number(node.getAttribute('y1'))],
    to:[Number(node.getAttribute('x2')), -Number(node.getAttribute('y2'))],
  }));
}
async function selectLine(page,state){
  await clickDrawingPoint(page,(state.from[0]+state.to[0])/2,(state.from[1]+state.to[1])/2);
  await page.locator('.drawing-parameter-panel').getByText('Отрезок',{exact:true}).waitFor();
}
async function lengthInput(page){
  return page.locator('.numeric-field').filter({hasText:'Длина'}).locator('input');
}
async function assertFooterLayout(page,label){
  const action=page.locator('.parameter-actions').first();
  const primary=action.locator('button.primary');
  await primary.waitFor();
  const [a,s,p]=await Promise.all([action.boundingBox(),page.locator('.status-bar').boundingBox(),primary.boundingBox()]);
  assert.ok(a&&s&&p,`${label}: missing footer geometry`);
  assert.ok(a.y+a.height<=s.y+0.5,`${label}: parameter actions overlap status bar`);
  const vp=page.viewportSize();
  assert.ok(vp&&p.x>=0&&p.y>=0&&p.x+p.width<=vp.width&&p.y+p.height<=vp.height,`${label}: Apply clipped`);
  assert.equal(await primary.isEnabled(),true,`${label}: Apply disabled`);
}

async function partWorkspaceScenario(){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  const page=await context.newPage();
  const errors=[],wasm=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  page.on('request',(r)=>{/\.wasm(?:\?|$)/i.test(r.url())&&wasm.push(r.url());});
  try{
    await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
    const stage=page.locator('[data-testid="part-model-stage"][data-workarea-kind="part-empty"]');
    await stage.waitFor();
    assert.equal(await page.locator('.stage-message').count(),0,'empty Part regressed to central splash');
    assert.equal(wasm.length,0,'empty Part loaded WASM before a solid/sketch operation');
    for(const id of ['XY','XZ','YZ']){
      await page.locator(`[data-plane-id="${id}"]`).waitFor();
      await page.locator(`[data-tree-node="plane-${id.toLowerCase()}"]`).waitFor();
    }
    await page.locator('[data-plane-id="XZ"]').click();
    assert.equal(await stage.getAttribute('data-selected-base-plane'),'XZ');
    assert.match(await page.locator('[data-tree-node="plane-xz"]').getAttribute('class'),/selected/);

    await page.getByRole('button',{name:/Создать эскиз/i}).first().click();
    const xz=page.locator('.parameter-panel .plane-grid button').filter({hasText:'XZ'});
    await xz.waitFor(); assert.match(await xz.getAttribute('class'),/selected/);
    await page.getByRole('button',{name:'Создать',exact:true}).click();
    await page.locator('[data-testid="part-model-stage"][data-sketch-context="isolated-2d"][data-sketch-support="XZ"]').waitFor();
    assert.deepEqual(errors,[],`Part workspace page errors: ${errors.join('; ')}`);
  }finally{await context.close();}
}

async function drawingScenario(){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  const page=await context.newPage();
  const errors=[],failed=[],wasm=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  page.on('requestfailed',(r)=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));
  page.on('request',(r)=>{/\.wasm(?:\?|$)/i.test(r.url())&&wasm.push(r.url());});
  try{
    await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
    await newDocument(page,'Чертеж');
    const stage=page.locator('[data-testid="drawing-stage"]');
    await stage.waitFor();
    assert.equal(await stage.getAttribute('data-sheet-format'),'A4');
    assert.equal(await stage.getAttribute('data-sheet-width'),'297');
    assert.equal(await stage.getAttribute('data-sheet-height'),'210');
    assert.equal(wasm.length,0,'standalone Drawing unexpectedly loaded CAD WASM');

    await page.locator('[data-command-id="draft.line"]').filter({visible:true}).first().click();
    await clickDrawingPoint(page,20,20);
    await clickDrawingPoint(page,70,20);
    const first=page.locator('[data-drawing-entity-id]').first();
    await first.waitFor({state:'attached'});
    const firstId=await first.getAttribute('data-drawing-entity-id'); assert.ok(firstId);
    let state=await lineState(page,firstId);
    near(state.length,50,0.001,'initial Line length');
    pointNear(state.from,[20,20],'initial from'); pointNear(state.to,[70,20],'initial to');

    await selectLine(page,state);
    await assertFooterLayout(page,'1600x900');
    const length=await lengthInput(page);
    near(Number(await length.inputValue()),50,0.001,'length editor initial');
    await length.fill('70');
    await page.locator('.parameter-actions button.primary').click();
    await page.getByText('Отрезок изменен: 70 мм',{exact:true}).waitFor();
    state=await lineState(page,firstId);
    near(state.length,70,0.001,'Line after 50->70');
    pointNear(state.from,[20,20],'70mm from'); pointNear(state.to,[90,20],'70mm to');

    const app=page.locator('.cad-app'); await app.focus();
    await page.keyboard.press('Control+z');
    await page.waitForFunction((id)=>Math.abs(Number(document.querySelector(`[data-drawing-entity-id="${id}"]`)?.getAttribute('data-drawing-length'))-50)<0.001,firstId);
    await app.focus(); await page.keyboard.press('Control+y');
    await page.waitForFunction((id)=>document.querySelector(`[data-drawing-entity-id="${id}"]`)?.getAttribute('data-drawing-length')==='70',firstId);

    state=await lineState(page,firstId); await selectLine(page,state);
    await page.locator('[data-command-id="draft.entity.delete"]').filter({visible:true}).first().click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-drawing-entity-id]').length===0);
    await app.focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction((id)=>Boolean(document.querySelector(`[data-drawing-entity-id="${id}"]`)),firstId);
    await app.focus(); await page.keyboard.press('Control+y');
    await page.waitForFunction(()=>document.querySelectorAll('[data-drawing-entity-id]').length===0);
    await app.focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction((id)=>document.querySelector(`[data-drawing-entity-id="${id}"]`)?.getAttribute('data-drawing-length')==='70',firstId);

    await page.locator('[data-command-id="system.save"]').first().click();
    await page.getByText('Сохранено локально',{exact:true}).waitFor();
    let raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
    assert.ok(raw,'Drawing Save missing serialized document');
    let saved=JSON.parse(raw);
    assert.equal(saved.kind,'drawing');
    let savedLine=saved.sheets[0].entities.find((x)=>x.id===firstId);
    assert.ok(savedLine,'saved Drawing lost Line identity');
    pointNear(savedLine.from,[20,20],'saved from'); pointNear(savedLine.to,[90,20],'saved to');

    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('.cad-app').getAttribute('data-document-kind'),'part','reload should start standalone shell cleanly');
    await fileCommand(page,'Открыть');
    await page.locator('.cad-app[data-document-kind="drawing"]').waitFor();
    state=await lineState(page,firstId);
    near(state.length,70,0.001,'reopened Line length');

    await selectLine(page,state);
    const reopenLength=await lengthInput(page);
    await reopenLength.fill('80');
    await page.locator('.parameter-actions button.primary').click();
    state=await lineState(page,firstId);
    near(state.length,80,0.001,'continued edit after Open');
    assert.equal(state.id,firstId,'continued edit changed entity ID');

    await app.focus();
    const beforePan=await stage.evaluate((node)=>({
      center:node.getAttribute('data-drawing-view-center'),
      span:Number(node.getAttribute('data-drawing-view-span')),
    }));
    await page.keyboard.press('ArrowRight');
    await app.focus(); await page.keyboard.press('ArrowUp');
    await app.focus(); await page.keyboard.press('Control+=');
    const afterPan=await stage.evaluate((node)=>({
      center:node.getAttribute('data-drawing-view-center'),
      span:Number(node.getAttribute('data-drawing-view-span')),
    }));
    assert.notEqual(afterPan.center,beforePan.center,'Drawing pan did not move viewport center');
    assert.ok(afterPan.span<beforePan.span,'Drawing zoom-in did not reduce span');

    await page.locator('[data-command-id="draft.line"]').filter({visible:true}).first().click();
    await clickDrawingPoint(page,120,70);
    await clickDrawingPoint(page,168,106);
    const lines=page.locator('[data-drawing-entity-id]');
    assert.equal(await lines.count(),2);
    const secondId=await lines.nth(1).getAttribute('data-drawing-entity-id'); assert.ok(secondId&&secondId!==firstId);
    const sloped=await lineState(page,secondId);
    near(sloped.length,60,0.001,'sloped Line after pan/zoom');
    pointNear(sloped.from,[120,70],'sloped from'); pointNear(sloped.to,[168,106],'sloped to');

    await page.setViewportSize({width:1366,height:768});
    state=await lineState(page,firstId); await selectLine(page,state);
    await assertFooterLayout(page,'1366x768');
    assert.equal(await page.locator('.status-bar').isVisible(),true,'status bar missing at 1366x768');

    raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
    saved=raw?JSON.parse(raw):null;
    assert.ok(saved,'persisted Drawing disappeared after continued editing');
    assert.deepEqual(errors,[],`Drawing page errors: ${errors.join('; ')}`);
    assert.deepEqual(failed,[],`Drawing failed requests: ${failed.join('; ')}`);
    assert.equal(wasm.length,0,'Drawing workflow loaded B-Rep/solver WASM');
    console.log('R1_DRAWING_WORKFLOW PASS');
    console.log('R1_DRAWING_50_70_UNDO_REDO PASS');
    console.log('R1_DRAWING_SAVE_RELOAD_OPEN_STABLE_ID PASS');
    console.log('R1_DRAWING_SLOPED_AFTER_PAN_ZOOM PASS');
    console.log('R1_LAYOUT_1600x900_1366x768 PASS');
  }finally{await context.close();}
}

try{
  await partWorkspaceScenario();
  await drawingScenario();
  console.log('R1_PART_EMPTY_WORKAREA_PLANES PASS');
}finally{
  await browser.close();
}
