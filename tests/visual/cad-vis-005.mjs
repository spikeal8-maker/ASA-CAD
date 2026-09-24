import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const root=process.env.ASA_CAD_VIS_ROOT??'cad-vis-005';
const baseMain=process.env.ASA_CAD_BASE_MAIN??'337bf6c802997ad2561c593f555751bd55a67f56';
const resultSha=process.env.ASA_CAD_RESULT_SHA??null;
const checkoutSha=process.env.ASA_CAD_CHECKOUT_SHA??null;
const imageId=process.env.ASA_CAD_IMAGE_ID??null;
const viewport={width:1920,height:1080};

function sha(data){return createHash('sha256').update(data).digest('hex');}
function pngDimensions(buffer){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  assert.ok(buffer.subarray(0,8).equals(sig),'not a PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
async function fileEvidence(path,expected,state={}){
  const data=await readFile(path); const info=await stat(path);
  assert.ok(info.size>0,`${path}: empty`);
  if(expected) assert.deepEqual(pngDimensions(data),expected,`${path}: dimensions`);
  return {path,bytes:info.size,sha256:sha(data),...state};
}
async function shot(page,relative,state={}){
  const path=join(root,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false});
  return fileEvidence(path,viewport,state);
}
async function bounds(page){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw,'viewport bounds missing'); const values=raw.split(',').map(Number);
  assert.equal(values.length,6); assert.ok(values.every(Number.isFinite)); return values;
}
function near(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<0.25,`${label}[${i}] ${v} != ${expected[i]}`));
}
async function entityIds(page){
  return page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').evaluateAll(nodes=>
    [...new Set(nodes.map(n=>n.getAttribute('data-sketch-entity-id')).filter(Boolean))].sort());
}
async function persisted(page){
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'persisted document missing'); return JSON.parse(raw);
}
function identity(doc){
  assert.equal(doc.sketches.length,1); assert.equal(doc.features.length,1); assert.equal(doc.bodies.length,1);
  const sketch=doc.sketches[0], feature=doc.features[0], body=doc.bodies[0];
  const width=doc.dimensions.find(x=>x.name==='width'), height=doc.dimensions.find(x=>x.name==='height');
  assert.ok(width&&height,'driving dimensions missing');
  return {
    sketchId:sketch.id,
    support:sketch.support,
    entityIds:sketch.entities.map(x=>x.id).sort(),
    dimensionIds:[...sketch.dimensionIds].sort(),
    widthDimensionId:width.id,
    extrudeFeatureId:feature.id,
    bodyId:body.id,
    width:width.value,
    height:height.value,
    extrudeDistance:feature.parameters.distance,
    featureSketchId:feature.parameters.sketchId,
  };
}

await mkdir(root,{recursive:true});
await mkdir(join(root,'lesson'),{recursive:true});
await mkdir(join(root,'video-tmp'),{recursive:true});
const browser=await chromium.launch({headless:true,slowMo:35});
const context=await browser.newContext({
  viewport,deviceScaleFactor:1,
  recordVideo:{dir:join(root,'video-tmp'),size:viewport},
});
const page=await context.newPage();
const video=page.video(); assert.ok(video,'Playwright video is unavailable');
const errors=[],failed=[],screenshots=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));
const fileTrigger=()=>page.getByRole('button',{name:'Файл',exact:true});
const fileMenu=()=>page.getByRole('menu',{name:'Файл',exact:true});
async function fileCommand(label){
  await fileTrigger().click(); const menu=fileMenu(); await menu.waitFor();
  const item=menu.getByRole('menuitem',{name:label,exact:true}); await item.waitFor(); await item.click();
}

let browserVersion=null;
let lesson={};
try{
  browserVersion=browser.version();
  const response=await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok(),`navigation failed ${response?.status()}`);
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  const env=await page.evaluate(()=>({
    path:location.pathname,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    uiScale:document.documentElement.dataset.uiScale,baseHref:document.querySelector('base')?.getAttribute('href'),
  }));
  assert.deepEqual(env,{path:'/cad/',width:1920,height:1080,dpr:1,uiScale:'100',baseHref:'/cad/'});

  await fileCommand('Новый');
  const newDialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await newDialog.waitFor();
  await newDialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();
  assert.equal(await page.locator('.dirty-dot').count(),0);
  screenshots.push(await shot(page,'steps/00-new-part.png',{step:'NEW_PART'}));

  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:/XY/}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const sketchId=await page.locator('.cad-app').getAttribute('data-active-sketch-id'); assert.ok(sketchId);

  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const rectanglePanel=page.locator('.parameter-panel'); await rectanglePanel.waitFor();
  const width=rectanglePanel.locator('.numeric-field').filter({hasText:'Ширина'}).locator('input');
  const height=rectanglePanel.locator('.numeric-field').filter({hasText:'Высота'}).locator('input');
  assert.equal(await width.inputValue(),'60'); assert.equal(await height.inputValue(),'40');
  await rectanglePanel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  const initialEntityIds=await entityIds(page); assert.equal(initialEntityIds.length,4);
  await page.getByRole('button',{name:/Ширина: 60 мм/}).waitFor();
  await page.getByRole('button',{name:/Высота: 40 мм/}).waitFor();
  screenshots.push(await shot(page,'steps/01-sketch-60x40-edit.png',{step:'SKETCH_60x40',sketchId}));

  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await page.locator('.cad-app[data-active-sketch-id=""]').waitFor();
  const finished=page.locator(`[data-testid="part-model-stage"][data-sketch-context="read-only"][data-sketch-id="${sketchId}"]`);
  await finished.waitFor(); assert.deepEqual(await entityIds(page),initialEntityIds);
  screenshots.push(await shot(page,'steps/02-sketch-finished.png',{step:'FINISH',sketchId}));

  const extrude=page.locator('[data-command-id="part.extrude"]').first(); assert.equal(await extrude.isEnabled(),true);
  await extrude.click(); const exPanel=page.locator('.extrude-parameter-panel'); await exPanel.waitFor();
  assert.equal(await exPanel.getAttribute('data-extrude-profile-id'),sketchId);
  await exPanel.getByText('Эскиз 1',{exact:true}).waitFor();
  await exPanel.getByText('На расстояние',{exact:true}).waitFor();
  assert.equal(await exPanel.locator('.numeric-field').filter({hasText:'Расстояние'}).locator('input').inputValue(),'10');
  await exPanel.getByText('Прямое',{exact:true}).waitFor();
  assert.equal(await exPanel.getByRole('switch',{name:'Симметрично'}).getAttribute('aria-checked'),'false');
  screenshots.push(await shot(page,'steps/03-extrude-active.png',{step:'EXTRUDE_ACTIVE',distance:10}));

  await exPanel.getByRole('button',{name:'Создать объект',exact:true}).click();
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="1"]').waitFor({timeout:120000});
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({timeout:60000});
  await page.getByText('Тело 1',{exact:true}).waitFor();
  const initialBounds=await bounds(page); near(initialBounds,[-30,-20,0,30,20,10],'initial');
  screenshots.push(await shot(page,'steps/04-solid-60x40x10.png',{step:'EXTRUDE_10',bounds:initialBounds}));

  await page.getByRole('button',{name:/Ширина: 60 мм/}).click();
  const dimensionPanel=page.locator('.parameter-panel'); await dimensionPanel.getByText('Изменить размер',{exact:true}).waitFor();
  const dimensionValue=dimensionPanel.locator('.numeric-field').filter({hasText:'Размер'}).locator('input');
  assert.equal(await dimensionValue.inputValue(),'60'); await dimensionValue.fill('80');
  screenshots.push(await shot(page,'steps/05-width-edit-60-to-80.png',{step:'WIDTH_EDIT',from:60,to:80}));
  await dimensionPanel.getByRole('button',{name:'Применить',exact:true}).click();
  await page.getByText('Ширина изменен на 80 мм; модель перестроена',{exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:/Ширина: 80 мм/}).waitFor();
  const updatedBounds=await bounds(page); near(updatedBounds,[-40,-20,0,40,20,10],'updated');
  screenshots.push(await shot(page,'steps/06-solid-80x40x10.png',{step:'WIDTH_60_TO_80',bounds:updatedBounds}));

  const rebuild=page.locator('[data-command-id="system.rebuild"]').first(); assert.equal(await rebuild.isEnabled(),true);
  await rebuild.click(); await page.getByText('Перестроено',{exact:true}).waitFor({timeout:60000});
  const rebuildBounds=await bounds(page); near(rebuildBounds,updatedBounds,'rebuild');
  screenshots.push(await shot(page,'steps/07-after-explicit-rebuild.png',{step:'EXPLICIT_REBUILD',bounds:rebuildBounds}));

  await fileCommand('Сохранить'); await page.getByText('Сохранено локально',{exact:true}).waitFor();
  assert.equal(await page.locator('.dirty-dot').count(),0);
  const savedDoc=await persisted(page); const savedIdentity=identity(savedDoc);
  assert.equal(savedIdentity.sketchId,sketchId); assert.deepEqual(savedIdentity.entityIds,initialEntityIds);
  assert.equal(savedIdentity.support,'XY'); assert.equal(savedIdentity.width,80); assert.equal(savedIdentity.height,40);
  assert.equal(savedIdentity.extrudeDistance,10); assert.equal(savedIdentity.featureSketchId,sketchId);

  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await page.locator('.cad-app[data-sketch-count="0"][data-feature-count="0"]').waitFor();
  await fileCommand('Открыть'); await page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  await page.locator('.cad-app[data-runtime-status="ready"][data-sketch-count="1"][data-feature-count="1"]').waitFor({timeout:120000});
  const reopenBounds=await bounds(page); near(reopenBounds,updatedBounds,'reopen');
  const reopenedIdentity=identity(await persisted(page)); assert.deepEqual(reopenedIdentity,savedIdentity);
  screenshots.push(await shot(page,'steps/08-reopened-solid.png',{step:'RELOAD_OPEN',bounds:reopenBounds}));

  await page.locator(`.tree-panel [data-sketch-id="${sketchId}"]`).click();
  const edit=page.locator(`[data-sketch-edit-id="${sketchId}"]`); await edit.waitFor(); await edit.click();
  await page.locator(`.cad-app[data-active-sketch-id="${sketchId}"][data-sketch-count="1"][data-feature-count="1"]`).waitFor();
  assert.deepEqual(await entityIds(page),initialEntityIds);
  await page.getByRole('button',{name:/Ширина: 80 мм/}).waitFor();
  await page.getByRole('button',{name:/Высота: 40 мм/}).waitFor();
  screenshots.push(await shot(page,'steps/09-reopened-sketch-edit.png',{step:'REOPEN_SKETCH_EDIT',sketchId}));

  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await page.locator('.cad-app[data-active-sketch-id=""][data-sketch-count="1"][data-feature-count="1"]').waitFor();
  await page.getByText('Элемент выдавливания 1',{exact:true}).waitFor();
  await page.getByText('Тело 1',{exact:true}).waitFor();
  near(await bounds(page),updatedBounds,'final');

  lesson={
    sketchId:savedIdentity.sketchId,
    entityIds:savedIdentity.entityIds,
    dimensionIds:savedIdentity.dimensionIds,
    widthDimensionId:savedIdentity.widthDimensionId,
    extrudeFeatureId:savedIdentity.extrudeFeatureId,
    bodyId:savedIdentity.bodyId,
    initialBounds,updatedBounds,rebuildBounds,reopenBounds,
    persisted:{width:savedIdentity.width,height:savedIdentity.height,extrudeDistance:savedIdentity.extrudeDistance,support:savedIdentity.support},
    finalCounts:{sketches:1,features:1,bodies:1},
  };
  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed,[],`failed product requests: ${failed.join(' | ')}`);
} finally {
  const videoTarget=join(root,'lesson/part-lesson.webm');
  const saveVideo=video.saveAs(videoTarget);
  await context.close();
  await saveVideo;
  await browser.close();
}

const videoEvidence=await fileEvidence(join(root,'lesson/part-lesson.webm'),null);
const manifest={
  schemaVersion:1,
  package:'CAD-VIS-005',
  baseMain,
  result:{productSha:resultSha,actualCheckoutSha:checkoutSha,localDockerImageId:imageId},
  PRODUCT_REPAIR_REQUIRED:false,
  PRODUCT_DELTA:'NONE',
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,viewport,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  route:'/cad/',
  lesson,
  video:{path:'lesson/part-lesson.webm',bytes:videoEvidence.bytes,sha256:videoEvidence.sha256},
  screenshots,
  assertions:{
    NEW_PART:'PASS',SKETCH_60x40:'PASS',FINISH:'PASS',EXTRUDE_10:'PASS',
    WIDTH_60_TO_80:'PASS',EXPLICIT_REBUILD:'PASS',SAVE:'PASS',RELOAD_OPEN:'PASS',
    IDENTITY_PRESERVED:'PASS',REOPEN_SKETCH_EDIT:'PASS',
  },
  USER_PATH:'PASS',
  DOCUMENT:'PASS',
  LESSON_SEQUENCE:'PASS',
  VISUAL_DELTA:'NOT_APPLICABLE_NO_PRODUCT_CHANGE',
  PARITY:'PARTIAL',
  FULL_M2V:'NOT_ACCEPTED',
  FULL_KOMPAS_PARITY:'NO',
  PUBLIC_INTERACTIVE_PREVIEW:'PREVIEW_BLOCKED_NOT_AUTHORIZED',
  oldArtifactDependency:false,
};
await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-005 complete ordinary Part lesson PASS');
console.log(`SKETCH_ID=${lesson.sketchId}`);
console.log(`WIDTH_DIMENSION_ID=${lesson.widthDimensionId}`);
console.log(`EXTRUDE_FEATURE_ID=${lesson.extrudeFeatureId}`);
console.log(`BODY_ID=${lesson.bodyId}`);
console.log(`LESSON_VIDEO=${manifest.video.path} ${manifest.video.bytes} bytes ${manifest.video.sha256}`);
