import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const beforeUrl=(process.env.ASA_CAD_BEFORE_URL??'http://127.0.0.1:8087').replace(/\/$/,'');
const afterUrl=(process.env.ASA_CAD_AFTER_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const outputRoot=process.env.ASA_CAD_VIS_ROOT??'cad-vis-002';
const sourceSha=process.env.ASA_CAD_SOURCE_SHA??'ddb30a6187aebee587eca1aae874c1885c55b824';
const resultSha=process.env.ASA_CAD_RESULT_SHA??null;
const sourceCheckoutSha=process.env.ASA_CAD_SOURCE_CHECKOUT_SHA??null;
const resultCheckoutSha=process.env.ASA_CAD_RESULT_CHECKOUT_SHA??null;
const sourceImageId=process.env.ASA_CAD_SOURCE_IMAGE_ID??null;
const resultImageId=process.env.ASA_CAD_RESULT_IMAGE_ID??null;

function pngDimensions(buffer){
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  assert.ok(buffer.subarray(0,8).equals(signature),'file is not a PNG');
  assert.equal(buffer.toString('ascii',12,16),'IHDR','PNG IHDR missing');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
async function fileEvidence(path,expected){
  const info=await stat(path); assert.ok(info.size>0,`${path}: empty`);
  const bytes=await readFile(path); assert.deepEqual(pngDimensions(bytes),expected,`${path}: dimensions`);
  return {path,bytes:info.size,sha256:createHash('sha256').update(bytes).digest('hex'),...expected};
}
async function shot(page,relative,width,height){
  const path=join(outputRoot,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false});
  return fileEvidence(path,{width,height});
}
async function assertMetrics(page,width,height){
  const value=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    zoom:visualViewport?.scale??1,uiScale:document.documentElement.dataset.uiScale,
    baseHref:document.querySelector('base')?.getAttribute('href')??null,
  }));
  assert.deepEqual(value,{width,height,dpr:1,zoom:1,uiScale:'100',baseHref:'/cad/'});
}
async function openOrdinary(browser,baseUrl,width=1920,height=1080,mobile=false,storageState){
  const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile,storageState,
  });
  const page=await context.newPage(); const errors=[]; const failed=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('requestfailed',(request)=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText??'failed'}`));
  const response=await page.goto(`${baseUrl}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok(),`navigation failed: ${response?.status()}`);
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await assertMetrics(page,width,height);
  return {context,page,errors,failed};
}
async function createNewPart(page){
  await page.locator('.new-tab-button').click();
  const dialog=page.getByRole('dialog',{name:'Новый документ'}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"]').waitFor();
}
async function createSketch(page,support='XY'){
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:new RegExp(support)}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const id=await page.locator('.cad-app').getAttribute('data-active-sketch-id');
  assert.ok(id,`${support}: missing sketch id`); return id;
}
async function createRectangle(page){
  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const panel=page.locator('.parameter-panel'); await panel.waitFor();
  const width=panel.locator('.numeric-field').filter({hasText:'Ширина'}).locator('input');
  const height=panel.locator('.numeric-field').filter({hasText:'Высота'}).locator('input');
  assert.equal(await width.inputValue(),'60'); assert.equal(await height.inputValue(),'40');
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
}
async function finish(page){
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
}
async function readOnly(page,id){
  const stage=page.locator(`[data-testid="part-model-stage"][data-sketch-context="read-only"][data-sketch-id="${id}"]`);
  await stage.waitFor();
  const overlay=stage.locator(`[data-testid="cad-sketch-overlay"][data-sketch-id="${id}"]`);
  await overlay.waitFor();
  return {stage,overlay};
}
async function save(page){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'saved document missing'); return {raw,document:JSON.parse(raw)};
}
function identity(document,id){
  const sketch=document.sketches.find((item)=>item.id===id); assert.ok(sketch,`missing ${id}`);
  return {id:sketch.id,support:sketch.support,entityIds:sketch.entities.map((item)=>item.id),dimensionIds:[...sketch.dimensionIds]};
}
async function select(page,id){
  await page.locator(`.tree-panel [data-sketch-id="${id}"]`).click();
  await page.locator(`.tree-panel[data-selected-sketch-id="${id}"]`).waitFor();
  assert.equal(await page.locator('.cad-app').getAttribute('data-active-sketch-id'),'');
}
async function edit(page,id){
  await page.locator(`[data-sketch-edit-id="${id}"]`).click();
  await page.locator(`.cad-app[data-active-sketch-id="${id}"]`).waitFor();
  await page.locator('[data-testid="part-model-stage"][data-sketch-context="isolated-2d"]').waitFor();
}
async function width80(page){
  await page.getByRole('button',{name:/Ширина: 60 мм/}).click();
  const input=page.locator('.numeric-field').filter({hasText:'Размер'}).locator('input');
  await input.waitFor(); await input.fill('80');
  await page.getByRole('button',{name:'Применить',exact:true}).click();
  await page.getByText('Ширина изменен на 80 мм; модель перестроена',{exact:true}).waitFor({timeout:60000});
}
async function overlaySpan(overlay){
  return overlay.locator('line').evaluateAll((lines)=>{
    const xs=lines.flatMap((line)=>[Number(line.getAttribute('x1')),Number(line.getAttribute('x2'))]);
    const ys=lines.flatMap((line)=>[Number(line.getAttribute('y1')),Number(line.getAttribute('y2'))]);
    return {width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  });
}

await mkdir(outputRoot,{recursive:true});
const browser=await chromium.launch({headless:true});
let browserVersion; let beforeEvidence; let afterEvidence=[]; let identityEvidence={}; let flow={};
try{
  browserVersion=browser.version();

  const before=await openOrdinary(browser,beforeUrl);
  await createNewPart(before.page);
  const beforeId=await createSketch(before.page);
  await createRectangle(before.page);
  await finish(before.page);
  await before.page.locator('.stage-message').waitFor();
  await before.page.getByText('1 эскиз(а)',{exact:true}).waitFor();
  assert.equal(await before.page.locator('[data-testid="cad-sketch-overlay"]').count(),0,'source unexpectedly keeps finished Sketch visible');
  beforeEvidence=await shot(before.page,'before/finished-sketch-1920x1080.png',1920,1080);
  assert.deepEqual(before.errors,[]); assert.deepEqual(before.failed,[]);
  await before.context.close();

  const after=await openOrdinary(browser,afterUrl);
  await createNewPart(after.page);
  const sketchId=await createSketch(after.page);
  await createRectangle(after.page);
  const savedInitial=await save(after.page);
  const initial=identity(savedInitial.document,sketchId);
  assert.equal(initial.support,'XY');
  afterEvidence.push(await shot(after.page,'after/edit-sketch-1920x1080.png',1920,1080));

  await finish(after.page);
  await after.page.locator('.cad-app[data-active-sketch-id=""]').waitFor();
  const finished=await readOnly(after.page,sketchId);
  const afterFinishSupport=await finished.stage.getAttribute('data-sketch-support');
  assert.equal(afterFinishSupport,'XY');
  assert.equal(await after.page.getByText('1 эскиз(а)',{exact:true}).count(),0);
  await finished.stage.getByText('Ширина: 60 мм',{exact:true}).waitFor();
  await finished.stage.getByText('Высота: 40 мм',{exact:true}).waitFor();
  afterEvidence.push(await shot(after.page,'after/finished-sketch-1920x1080.png',1920,1080));

  await select(after.page,sketchId);
  const selectedSaved=await save(after.page);
  assert.equal(selectedSaved.raw,savedInitial.raw,'selection mutated CadDocument');
  afterEvidence.push(await shot(after.page,'after/selected-sketch-1920x1080.png',1920,1080));

  await edit(after.page,sketchId);
  afterEvidence.push(await shot(after.page,'after/reedit-sketch-1920x1080.png',1920,1080));
  await width80(after.page);
  assert.equal(await after.page.locator('.cad-app').getAttribute('data-active-sketch-id'),sketchId);
  assert.equal(await after.page.getByRole('tab',{name:'Эскиз'}).getAttribute('aria-selected'),'true');
  await finish(after.page);
  const finished80=await readOnly(after.page,sketchId);
  await after.page.waitForFunction(()=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-overlay-source')==='solver-preview');
  const span=await overlaySpan(finished80.overlay);
  assert.ok(Math.abs(span.width-80)<0.2,`width expected 80 got ${span.width}`);
  assert.ok(Math.abs(span.height-40)<0.2,`height expected 40 got ${span.height}`);
  afterEvidence.push(await shot(after.page,'after/finished-sketch-80x40-1920x1080.png',1920,1080));

  const savedFinal=await save(after.page);
  const finalId=identity(savedFinal.document,sketchId);
  assert.deepEqual(finalId,initial,'Sketch/support/entity/dimension IDs changed');
  assert.equal(savedFinal.document.sketches.length,1);
  assert.equal(savedFinal.document.dimensions.find((item)=>item.name==='width')?.value,80);
  assert.equal(savedFinal.document.dimensions.find((item)=>item.name==='height')?.value,40);

  await after.page.getByTitle('Открыть').click();
  await after.page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  await after.page.locator('.cad-app[data-active-sketch-id=""][data-sketch-count="1"]').waitFor();
  await readOnly(after.page,sketchId);
  afterEvidence.push(await shot(after.page,'after/reopen-sketch-1920x1080.png',1920,1080));
  const reopenedSaved=await save(after.page);
  const reopenedId=identity(reopenedSaved.document,sketchId);
  assert.deepEqual(reopenedId,initial);

  await after.page.setViewportSize({width:1366,height:768}); await assertMetrics(after.page,1366,768);
  await readOnly(after.page,sketchId);
  afterEvidence.push(await shot(after.page,'after/finished-sketch-1366x768.png',1366,768));
  await after.page.setViewportSize({width:768,height:1024}); await assertMetrics(after.page,768,1024);
  await readOnly(after.page,sketchId);
  afterEvidence.push(await shot(after.page,'after/finished-sketch-768x1024.png',768,1024));

  const storageState=await after.context.storageState();
  assert.deepEqual(after.errors,[]); assert.deepEqual(after.failed,[]);
  await after.context.close();

  const phone=await openOrdinary(browser,afterUrl,390,844,true,storageState);
  await phone.page.getByRole('button',{name:/Инструменты/}).click();
  const tools=phone.page.locator('[data-mobile-tools="true"]'); await tools.waitFor();
  await tools.locator('[data-command-id="system.open"]').click();
  await phone.page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  await readOnly(phone.page,sketchId);
  afterEvidence.push(await shot(phone.page,'after/phone-smoke-390x844.png',390,844));
  assert.deepEqual(phone.errors,[]); assert.deepEqual(phone.failed,[]);
  await phone.context.close();

  identityEvidence={
    originalSketchId:sketchId,afterFinishSketchId:sketchId,reeditSketchId:sketchId,reopenSketchId:reopenedId.id,
    support:{initial:initial.support,afterFinish:afterFinishSupport,reopen:reopenedId.support},
    entityIds:initial.entityIds,dimensionIds:initial.dimensionIds,
    widthAfterReedit:80,heightAfterReedit:40,duplicateSketch:false,
  };
  flow={
    sourceBeforeSketchId:beforeId,
    afterFinish:{activeEditSketch:null,workspace:'solid',sketchCount:1,visible:true},
    selection:{activeEditSketch:null,serializedDocumentUnchanged:true},
    reedit:{sketchId,sketchCount:1},
    reopen:{sketchId:reopenedId.id,sketchCount:1,visible:true},
  };
}finally{
  await browser.close();
}

const manifest={
  schemaVersion:1,package:'CAD-VIS-002',
  source:{productSha:sourceSha,actualCheckoutSha:sourceCheckoutSha,localDockerImageId:sourceImageId,screenshotOrigin:'baseline-build'},
  result:{productSha:resultSha,actualCheckoutSha:resultCheckoutSha,localDockerImageId:resultImageId},
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  identity:identityEvidence,flow,
  screenshots:{before:[beforeEvidence],after:afterEvidence},
  VISUAL_DELTA:'PASS',PARITY:'PARTIAL',DOCUMENT:'PASS',USER_PATH:'PASS',FULL_M2V:'NOT_ACCEPTED',
  oldArtifactDependency:false,
};
await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-002 self-contained visual evidence PASS');
