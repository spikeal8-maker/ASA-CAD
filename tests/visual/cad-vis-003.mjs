import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const beforeUrl=(process.env.ASA_CAD_BEFORE_URL??'http://127.0.0.1:8087').replace(/\/$/,'');
const afterUrl=(process.env.ASA_CAD_AFTER_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const outputRoot=process.env.ASA_CAD_VIS_ROOT??'cad-vis-003';
const sourceSha=process.env.ASA_CAD_SOURCE_SHA??'df28b9dffe96b7bc463c7e60d8d25357ecf194ab';
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
async function fileEvidence(path,expected,state){
  const info=await stat(path); assert.ok(info.size>0,`${path}: empty`);
  const data=await readFile(path); assert.deepEqual(pngDimensions(data),expected,`${path}: dimensions`);
  return {path,bytes:info.size,sha256:createHash('sha256').update(data).digest('hex'),...expected,...state};
}
async function shot(page,relative,width,height,state){
  const path=join(outputRoot,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false});
  return fileEvidence(path,{width,height},state);
}
async function metrics(page,width,height){
  const value=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    zoom:visualViewport?.scale??1,uiScale:document.documentElement.dataset.uiScale,
    baseHref:document.querySelector('base')?.getAttribute('href')??null,
  }));
  assert.deepEqual(value,{width,height,dpr:1,zoom:1,uiScale:'100',baseHref:'/cad/'});
  return value;
}
async function openOrdinary(browser,baseUrl,width=1920,height=1080,mobile=false){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(); const errors=[]; const failed=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('requestfailed',(request)=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText??'failed'}`));
  const response=await page.goto(`${baseUrl}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok(),`navigation failed: ${response?.status()}`);
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await metrics(page,width,height);
  return {context,page,errors,failed};
}
async function shellGeometry(page){
  return page.evaluate(()=>{
    const read=(selector)=>{
      const node=document.querySelector(selector); if(!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      const box=node.getBoundingClientRect(); return {x:box.x,y:box.y,width:box.width,height:box.height};
    };
    return {tabs:read('.document-tabs'),instrument:read('.instrument-area'),work:read('.work-area')};
  });
}
function assertSameGeometry(before,after,label){
  for(const key of Object.keys(before)) for(const field of ['x','y','width','height']){
    assert.ok(Math.abs(before[key][field]-after[key][field])<0.2,`${label}: ${key}.${field} shifted`);
  }
}
const fileTrigger=(page)=>page.getByRole('button',{name:'Файл',exact:true});
const fileMenu=(page)=>page.getByRole('menu',{name:'Файл',exact:true});
async function openFile(page){
  await fileTrigger(page).click(); await fileMenu(page).waitFor();
  for(const [label,id] of [['Новый','system.new'],['Открыть','system.open'],['Сохранить','system.save']]){
    const item=fileMenu(page).getByRole('menuitem',{name:label,exact:true}); await item.waitFor();
    assert.equal(await item.getAttribute('data-command-id'),id);
  }
}
async function closeFile(page){
  if(await fileMenu(page).count()) await fileTrigger(page).click();
  assert.equal(await fileMenu(page).count(),0);
}
async function createNewPartFromFile(page){
  await openFile(page);
  await fileMenu(page).getByRole('menuitem',{name:'Новый',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"]').waitFor();
}
async function createSketchRectangle(page){
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:/XY/}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  await page.waitForFunction(()=>Boolean(document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id')));
  const sketchId=await page.locator('.cad-app').getAttribute('data-active-sketch-id'); assert.ok(sketchId);
  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const panel=page.locator('.parameter-panel'); await panel.waitFor();
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  return sketchId;
}

await mkdir(outputRoot,{recursive:true});
const browser=await chromium.launch({headless:true});
let browserVersion; let beforeEvidence; const afterEvidence=[]; const acceptance={};
try{
  browserVersion=browser.version();

  const before=await openOrdinary(browser,beforeUrl);
  const beforeGeometry=await shellGeometry(before.page);
  await fileTrigger(before.page).click();
  assert.equal(await before.page.getByRole('menu',{name:'Файл',exact:true}).count(),0,'source unexpectedly opened File popup');
  assertSameGeometry(beforeGeometry,await shellGeometry(before.page),'source File click');
  beforeEvidence=await shot(before.page,'before/file-click-1920x1080.png',1920,1080,{menuOpen:false,focusedItem:null,dirty:false});
  assert.deepEqual(before.errors,[]); assert.deepEqual(before.failed,[]);
  await before.context.close();

  const after=await openOrdinary(browser,afterUrl);
  const baseGeometry=await shellGeometry(after.page);
  await openFile(after.page);
  assertSameGeometry(baseGeometry,await shellGeometry(after.page),'File overlay');
  afterEvidence.push(await shot(after.page,'after/file-open-1920x1080.png',1920,1080,{menuOpen:true,focusedItem:null,dirty:false}));
  await closeFile(after.page);

  await after.page.setViewportSize({width:1366,height:768}); await metrics(after.page,1366,768);
  const geometry1366=await shellGeometry(after.page); await openFile(after.page);
  assertSameGeometry(geometry1366,await shellGeometry(after.page),'1366 File overlay');
  afterEvidence.push(await shot(after.page,'after/file-open-1366x768.png',1366,768,{menuOpen:true,focusedItem:null,dirty:false}));
  await closeFile(after.page);

  await after.page.setViewportSize({width:900,height:1024}); await metrics(after.page,900,1024);
  const geometry900=await shellGeometry(after.page); await openFile(after.page);
  assertSameGeometry(geometry900,await shellGeometry(after.page),'900 File overlay');
  afterEvidence.push(await shot(after.page,'after/file-open-900x1024.png',900,1024,{menuOpen:true,focusedItem:null,dirty:false}));
  await closeFile(after.page);

  await after.page.setViewportSize({width:1920,height:1080}); await metrics(after.page,1920,1080);
  await openFile(after.page);
  await fileMenu(after.page).getByRole('menuitem',{name:'Новый',exact:true}).click();
  const newDialog=after.page.getByRole('dialog',{name:'Новый документ',exact:true}); await newDialog.waitFor();
  afterEvidence.push(await shot(after.page,'after/new-dialog-from-file-1920x1080.png',1920,1080,{menuOpen:false,focusedItem:null,dirty:false,dialog:'new'}));
  await newDialog.getByRole('button',{name:'Закрыть',exact:true}).click();
  assert.equal(await newDialog.count(),0);

  await createNewPartFromFile(after.page);
  const sketchId=await createSketchRectangle(after.page);
  assert.equal(await after.page.locator('.dirty-dot').count(),1,'ordinary UI edit did not mark document dirty');
  const rawBeforeGuard=await after.page.evaluate(()=>JSON.stringify({
    kind:document.querySelector('.cad-app')?.getAttribute('data-document-kind'),
    sketch:document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id'),
    count:document.querySelector('.cad-app')?.getAttribute('data-sketch-count'),
  }));

  await openFile(after.page);
  await fileMenu(after.page).getByRole('menuitem',{name:'Новый',exact:true}).click();
  const guard=after.page.getByRole('dialog',{name:'Есть несохранённые изменения',exact:true}); await guard.waitFor();
  for(const label of ['Сохранить и продолжить','Не сохранять','Отмена']) await guard.getByRole('button',{name:label,exact:true}).waitFor();
  afterEvidence.push(await shot(after.page,'after/dirty-guard-1920x1080.png',1920,1080,{menuOpen:false,focusedItem:null,dirty:true,dialog:'dirty-new'}));
  await guard.getByRole('button',{name:'Отмена',exact:true}).click();
  assert.equal(await guard.count(),0);
  assert.equal(await after.page.getByRole('dialog',{name:'Новый документ',exact:true}).count(),0);
  const rawAfterCancel=await after.page.evaluate(()=>JSON.stringify({
    kind:document.querySelector('.cad-app')?.getAttribute('data-document-kind'),
    sketch:document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id'),
    count:document.querySelector('.cad-app')?.getAttribute('data-sketch-count'),
  }));
  assert.equal(rawAfterCancel,rawBeforeGuard,'dirty guard Cancel changed document identity');
  assert.equal(await after.page.locator('.dirty-dot').count(),1,'dirty guard Cancel cleared dirty state');
  afterEvidence.push(await shot(after.page,'after/dirty-guard-cancelled-1920x1080.png',1920,1080,{menuOpen:false,focusedItem:null,dirty:true,dialog:null}));

  await fileTrigger(after.page).focus();
  await fileTrigger(after.page).press('ArrowDown');
  const firstItem=fileMenu(after.page).getByRole('menuitem',{name:'Новый',exact:true}); await firstItem.waitFor();
  assert.equal(await firstItem.evaluate((node)=>document.activeElement===node),true);
  await firstItem.press('Escape');
  assert.equal(await fileTrigger(after.page).evaluate((node)=>document.activeElement===node),true);

  acceptance.fileMenuOpen=true;
  acceptance.systemNewBound=true;
  acceptance.newAction=true;
  acceptance.openAction=true;
  acceptance.saveAction=true;
  acceptance.dirtyNewCancel=true;
  acceptance.keyboard=true;
  acceptance.focusReturn=true;
  acceptance.sketchIdPreservedOnCancel=sketchId;
  assert.deepEqual(after.errors,[]); assert.deepEqual(after.failed,[]);
  await after.context.close();

  const phone=await openOrdinary(browser,afterUrl,390,844,true);
  assert.equal(await phone.page.locator('.main-menu-items').evaluate((node)=>getComputedStyle(node).display),'none');
  assert.ok(await phone.page.locator('[data-command-id="system.new"]:visible').count()>=1,'phone lost New document action');
  assert.ok(await phone.page.locator('[data-command-id="system.save"]:visible').count()>=1,'phone lost Save action');
  afterEvidence.push(await shot(phone.page,'after/phone-smoke-390x844.png',390,844,{menuOpen:false,focusedItem:null,dirty:false,mobile:true}));
  assert.deepEqual(phone.errors,[]); assert.deepEqual(phone.failed,[]);
  await phone.context.close();
}finally{
  await browser.close();
}

const manifest={
  schemaVersion:1,package:'CAD-VIS-003',
  source:{productSha:sourceSha,actualCheckoutSha:sourceCheckoutSha,localDockerImageId:sourceImageId,screenshotOrigin:'baseline-build'},
  result:{productSha:resultSha,actualCheckoutSha:resultCheckoutSha,localDockerImageId:resultImageId},
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  actionIds:['system.new','system.open','system.save'],
  acceptance,
  screenshots:{before:[beforeEvidence],after:afterEvidence},
  remainingFileParity:['Save As','Close','Recent documents','Export','other KOMPAS File commands','exact proprietary artwork','unmeasured exact dropdown spacing/grouping'],
  USER_PATH:'PASS',DOCUMENT:'PASS',VISUAL_DELTA:'PASS',PARITY:'PARTIAL',FULL_M2V:'NOT_ACCEPTED',
  oldArtifactDependency:false,
};
await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-003 self-contained visual evidence PASS');
