import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const beforeUrl=(process.env.ASA_CAD_BEFORE_URL??'http://127.0.0.1:8087').replace(/\/$/,'');
const afterUrl=(process.env.ASA_CAD_AFTER_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const outputRoot=process.env.ASA_CAD_VIS_ROOT??'cad-vis-004';
const sourceSha=process.env.ASA_CAD_SOURCE_SHA??'fcabaa45b7929b35a2fd37865515f849413676a1';
const resultSha=process.env.ASA_CAD_RESULT_SHA??null;
const sourceCheckoutSha=process.env.ASA_CAD_SOURCE_CHECKOUT_SHA??null;
const resultCheckoutSha=process.env.ASA_CAD_RESULT_CHECKOUT_SHA??null;
const sourceImageId=process.env.ASA_CAD_SOURCE_IMAGE_ID??null;
const resultImageId=process.env.ASA_CAD_RESULT_IMAGE_ID??null;

function hashText(value){return createHash('sha256').update(value).digest('hex');}
function pngDimensions(buffer){
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  assert.ok(buffer.subarray(0,8).equals(signature),'not PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
async function evidence(path,expected,state){
  const info=await stat(path); const data=await readFile(path);
  assert.ok(info.size>0); assert.deepEqual(pngDimensions(data),expected);
  return {path,bytes:info.size,sha256:createHash('sha256').update(data).digest('hex'),...expected,...state};
}
async function shot(page,relative,width,height,state){
  const path=join(outputRoot,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false}); return evidence(path,{width,height},state);
}
async function openOrdinary(browser,baseUrl,width=1920,height=1080,mobile=false){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(); const errors=[]; const failed=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  page.on('requestfailed',(r)=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));
  const response=await page.goto(`${baseUrl}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok()); await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  const env=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,uiScale:document.documentElement.dataset.uiScale,baseHref:document.querySelector('base')?.getAttribute('href')}));
  assert.deepEqual(env,{width,height,dpr:1,uiScale:'100',baseHref:'/cad/'});
  return {context,page,errors,failed};
}
async function newPart(page){
  await page.locator('.new-tab-button').click();
  const dialog=page.getByRole('dialog',{name:'Новый документ'}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-feature-count="0"]').waitFor();
}
async function desktopProfile(page,support='XY'){
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:new RegExp(support)}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const id=await page.locator('.cad-app').getAttribute('data-active-sketch-id'); assert.ok(id);
  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.getByTitle('Параметры').click(); await page.locator('.parameter-panel').waitFor();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  return id;
}
async function save(page){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw); return {raw,doc:JSON.parse(raw),sha256:hashText(raw)};
}
async function openExtrude(page){
  const button=page.locator('[data-command-id="part.extrude"]').first();
  assert.equal(await button.isEnabled(),true); await button.click();
  const panel=page.locator('.extrude-parameter-panel'); await panel.waitFor(); return panel;
}
async function bounds(page){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw); return raw.split(',').map(Number);
}
function assertBounds(actual,expected,label){
  actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<0.25,`${label}[${i}] ${v}`));
}
async function apply(page,panel){
  await panel.getByRole('button',{name:'Создать объект'}).click();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({timeout:120000});
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({timeout:60000});
}
function extrudeFeature(doc){const f=doc.features.find((item)=>item.type==='extrude');assert.ok(f);return f;}

await mkdir(outputRoot,{recursive:true});
const browser=await chromium.launch({headless:true});
let browserVersion; let beforeEvidence; const afterEvidence=[];
let primary={}; let reverse={}; let symmetric={}; let fingerprints={}; let phoneSmoke=false;
try{
  browserVersion=browser.version();

  const before=await openOrdinary(browser,beforeUrl);
  await newPart(before.page); const beforeSketch=await desktopProfile(before.page);
  await before.page.locator('[data-command-id="part.extrude"]').first().click();
  await before.page.getByText(/OpenCascade WASM/).waitFor();
  beforeEvidence=await shot(before.page,'before/extrude-active-1920x1080.png',1920,1080,{sketchId:beforeSketch,oldDeveloperText:true});
  assert.deepEqual(before.errors,[]); assert.deepEqual(before.failed,[]); await before.context.close();

  const after=await openOrdinary(browser,afterUrl);
  await newPart(after.page); const sketchId=await desktopProfile(after.page);
  const clean=await save(after.page); fingerprints.before=clean.sha256;
  let panel=await openExtrude(after.page);
  assert.equal(await panel.getAttribute('data-extrude-profile-id'),sketchId);
  await panel.getByText('Эскиз 1',{exact:true}).waitFor();
  await panel.getByText('Нормаль к плоскости эскиза',{exact:true}).waitFor();
  await panel.getByText('На расстояние',{exact:true}).waitFor();
  assert.equal(await panel.getByText(/OpenCascade|WASM|runtime/).count(),0);
  afterEvidence.push(await shot(after.page,'after/extrude-active-1920x1080.png',1920,1080,{distance:10,reverse:false,symmetric:false,sketchId}));

  await after.page.setViewportSize({width:1366,height:768});
  await panel.waitFor(); afterEvidence.push(await shot(after.page,'after/extrude-active-1366x768.png',1366,768,{distance:10,reverse:false,symmetric:false}));
  await after.page.setViewportSize({width:768,height:1024});
  await panel.waitFor(); afterEvidence.push(await shot(after.page,'after/extrude-active-768x1024.png',768,1024,{distance:10,reverse:false,symmetric:false}));
  await after.page.setViewportSize({width:1920,height:1080});

  await panel.getByRole('button',{name:'Сменить направление'}).click();
  await panel.getByText('Обратное',{exact:true}).waitFor();
  afterEvidence.push(await shot(after.page,'after/extrude-reverse-1920x1080.png',1920,1080,{distance:10,reverse:true,symmetric:false}));

  const input=panel.locator('.numeric-field').filter({hasText:'Расстояние'}).locator('input');
  await input.fill('20'); await panel.getByRole('switch',{name:'Симметрично'}).click();
  assert.equal(await panel.getByRole('button',{name:'Сменить направление'}).isDisabled(),true);
  afterEvidence.push(await shot(after.page,'after/extrude-symmetric-1920x1080.png',1920,1080,{distance:20,reverse:false,symmetric:true}));

  await panel.getByRole('switch',{name:'Симметрично'}).click(); await input.fill('0');
  await panel.getByRole('alert').waitFor();
  await after.page.locator('.cad-app').focus(); await after.page.keyboard.press('Control+Enter');
  assert.equal(await after.page.locator('.cad-app').getAttribute('data-feature-count'),'0');
  assert.equal(await after.page.locator('.dirty-dot').count(),0);
  const invalidRaw=await after.page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document')); assert.ok(invalidRaw);
  fingerprints.invalid=hashText(invalidRaw); assert.equal(fingerprints.invalid,fingerprints.before);
  afterEvidence.push(await shot(after.page,'after/extrude-invalid-1920x1080.png',1920,1080,{distance:0,validation:'Расстояние должно быть больше 0'}));
  await panel.getByRole('button',{name:'Отмена'}).click();
  const afterCancel=await save(after.page); fingerprints.cancel=afterCancel.sha256; assert.equal(fingerprints.cancel,fingerprints.before);

  panel=await openExtrude(after.page); await apply(after.page,panel);
  const directBounds=await bounds(after.page); assertBounds(directBounds,[-30,-20,0,30,20,10],'direct');
  afterEvidence.push(await shot(after.page,'after/extrude-result-1920x1080.png',1920,1080,{bounds:directBounds}));
  const directSaved=await save(after.page); const directFeature=extrudeFeature(directSaved.doc);
  const directBody=directSaved.doc.bodies[0]; assert.ok(directBody);
  await after.page.reload({waitUntil:'networkidle'}); await after.page.getByTitle('Открыть').click();
  await after.page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  const reopenBounds=await bounds(after.page); assertBounds(reopenBounds,directBounds,'reopen');
  const reopened=await save(after.page); assert.equal(reopened.doc.features[0].id,directFeature.id);
  primary={sketchId,sketchName:'Эскиз 1',support:'XY',distance:10,reverse:false,symmetric:false,featureId:directFeature.id,bodyId:directBody.id,bounds:directBounds,reopenBounds};

  await newPart(after.page); const reverseSketch=await desktopProfile(after.page); panel=await openExtrude(after.page);
  await panel.getByRole('button',{name:'Сменить направление'}).click(); await apply(after.page,panel);
  const reverseBounds=await bounds(after.page); assertBounds(reverseBounds,[-30,-20,-10,30,20,0],'reverse');
  const reverseSaved=await save(after.page); const reverseFeature=extrudeFeature(reverseSaved.doc);
  assert.equal(reverseFeature.parameters.reverse,true);
  reverse={sketchId:reverseSketch,distance:10,reverse:true,symmetric:false,bounds:reverseBounds};

  await newPart(after.page); const symmetricSketch=await desktopProfile(after.page); panel=await openExtrude(after.page);
  await panel.locator('.numeric-field').filter({hasText:'Расстояние'}).locator('input').fill('20');
  await panel.getByRole('switch',{name:'Симметрично'}).click(); await apply(after.page,panel);
  const symmetricBounds=await bounds(after.page); assertBounds(symmetricBounds,[-30,-20,-10,30,20,10],'symmetric');
  const symmetricSaved=await save(after.page); const symmetricFeature=extrudeFeature(symmetricSaved.doc);
  assert.equal(symmetricFeature.parameters.symmetric,true); assert.equal(symmetricFeature.parameters.distance,20);
  symmetric={sketchId:symmetricSketch,distance:20,reverse:false,symmetric:true,bounds:symmetricBounds};

  assert.deepEqual(after.errors,[]); assert.deepEqual(after.failed,[]); await after.context.close();

  const phone=await openOrdinary(browser,afterUrl,390,844,true);
  const toolsTab=phone.page.getByRole('button',{name:/Инструменты/}); await toolsTab.click();
  let tools=phone.page.locator('[data-mobile-tools="true"]'); await tools.waitFor();
  await tools.locator('[data-command-id="part.sketch.create"]').click();
  await phone.page.getByRole('button',{name:/XY/}).click();
  await phone.page.locator('.parameter-actions button.primary').click();
  await toolsTab.click(); tools=phone.page.locator('[data-mobile-tools="true"]'); await tools.waitFor();
  await tools.locator('[data-command-id="sketch.rectangle"]').click();
  const layer=phone.page.locator('[data-testid="cad-sketch-interaction"][data-tool="rectangle"]'); await layer.waitFor();
  const box=await layer.boundingBox(); assert.ok(box);
  await phone.page.touchscreen.tap(box.x+box.width*.38,box.y+box.height*.38);
  await phone.page.touchscreen.tap(box.x+box.width*.62,box.y+box.height*.62);
  await phone.page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="4"]').waitFor({timeout:20000});
  await toolsTab.click(); tools=phone.page.locator('[data-mobile-tools="true"]'); await tools.waitFor();
  await tools.locator('[data-command-id="sketch.finish"]').click();
  await phone.page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await toolsTab.click(); tools=phone.page.locator('[data-mobile-tools="true"]'); await tools.waitFor();
  const mobileExtrude=tools.locator('[data-command-id="part.extrude"]'); assert.equal(await mobileExtrude.isEnabled(),true);
  await mobileExtrude.click(); await phone.page.locator('.extrude-parameter-panel').waitFor();
  afterEvidence.push(await shot(phone.page,'after/phone-smoke-390x844.png',390,844,{extrudePanel:true}));
  phoneSmoke=true; assert.deepEqual(phone.errors,[]); assert.deepEqual(phone.failed,[]); await phone.context.close();
}finally{await browser.close();}

const manifest={
  schemaVersion:1,package:'CAD-VIS-004',
  source:{productSha:sourceSha,actualCheckoutSha:sourceCheckoutSha,localDockerImageId:sourceImageId},
  result:{productSha:resultSha,actualCheckoutSha:resultCheckoutSha,localDockerImageId:resultImageId},
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  primary,reverse,symmetric,fingerprints,phoneSmoke,
  screenshots:{before:[beforeEvidence],after:afterEvidence},
  remainingExtrudeParity:[
    'full B-Rep phantom','second direction','other end conditions','draft angle','thin wall',
    'application scope','properties','editing existing feature','multi-profile selection',
    'exact proprietary artwork','unmeasured exact spacing'
  ],
  USER_PATH:'PASS',DOCUMENT:'PASS',VISUAL_DELTA:'PASS',PARITY:'PARTIAL',FULL_M2V:'NOT_ACCEPTED',
  oldArtifactDependency:false,
};
await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-004 self-contained visual evidence PASS');
