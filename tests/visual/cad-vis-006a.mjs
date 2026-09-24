import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const beforeUrl=(process.env.ASA_CAD_BEFORE_URL??'http://127.0.0.1:8087').replace(/\/$/,'');
const afterUrl=(process.env.ASA_CAD_AFTER_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const outputRoot=process.env.ASA_CAD_VIS_ROOT??'cad-vis-006a';
const sourceSha=process.env.ASA_CAD_SOURCE_SHA??'4dce4d088c561e5942b06a7c2fdfca88ffae5b62';
const resultSha=process.env.ASA_CAD_RESULT_SHA??null;
const sourceCheckoutSha=process.env.ASA_CAD_SOURCE_CHECKOUT_SHA??null;
const resultCheckoutSha=process.env.ASA_CAD_RESULT_CHECKOUT_SHA??null;
const sourceImageId=process.env.ASA_CAD_SOURCE_IMAGE_ID??null;
const resultImageId=process.env.ASA_CAD_RESULT_IMAGE_ID??null;

function hash(value){return createHash('sha256').update(value).digest('hex');}
function pngDimensions(buffer){
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  assert.ok(buffer.subarray(0,8).equals(signature),'not PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
async function shot(page,relative,width,height,state){
  const path=join(outputRoot,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false});
  const info=await stat(path),data=await readFile(path);
  assert.ok(info.size>0); assert.deepEqual(pngDimensions(data),{width,height});
  return {path,bytes:info.size,sha256:hash(data),width,height,...state};
}
async function open(browser,baseUrl,width=1920,height=1080){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  page.on('requestfailed',(r)=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));
  const response=await page.goto(`${baseUrl}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok()); await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  return {context,page,errors,failed};
}
async function fileCommand(page,label){
  await page.getByRole('button',{name:'Файл',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Файл',exact:true}); await menu.waitFor();
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
}
async function save(page){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw); return {raw,doc:JSON.parse(raw),sha256:hash(raw)};
}
async function bounds(page){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw); return raw.split(',').map(Number);
}
function assertBounds(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<0.25,`${label}[${index}] ${value}`));
}
function vector(value,label){
  assert.ok(value,`missing ${label}`); const result=value.split(',').map(Number);
  assert.equal(result.length,3); assert.ok(result.every(Number.isFinite)); return result;
}
async function clickWorld(page,point){
  const viewport=page.locator('[data-testid="cad-viewport"]'),canvas=viewport.locator('canvas');
  await canvas.waitFor(); const box=await canvas.boundingBox(); assert.ok(box);
  const state=await viewport.evaluate((node)=>({
    position:node.getAttribute('data-camera-position'),
    target:node.getAttribute('data-camera-target'),
    up:node.getAttribute('data-camera-up'),
  }));
  const b=await bounds(page);
  const diagonal=Math.max(Math.hypot(b[3]-b[0],b[4]-b[1],b[5]-b[2]),10);
  const camera=new THREE.PerspectiveCamera(34,box.width/box.height,Math.max(diagonal/1000,0.01),diagonal*100);
  camera.position.set(...vector(state.position,'camera position'));
  camera.up.set(...vector(state.up,'camera up'));
  camera.lookAt(new THREE.Vector3(...vector(state.target,'camera target')));
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  const projected=new THREE.Vector3(...point).project(camera);
  assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1);
  await canvas.click({position:{x:(projected.x+1)*box.width/2,y:(1-projected.y)*box.height/2}});
}
async function newPart(page){
  await fileCommand(page,'Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-feature-count="0"]').waitFor();
}
async function createCutReady(page){
  await newPart(page);
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByRole('button',{name:/XY/}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.getByTitle('Параметры').click();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();

  await page.locator('[data-command-id="part.extrude"]').first().click();
  const extrude=page.locator('.extrude-parameter-panel'); await extrude.waitFor();
  await extrude.getByRole('button',{name:'Создать объект',exact:true}).click();
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="1"]').waitFor({timeout:120000});
  assertBounds(await bounds(page),[-30,-20,0,30,20,10],'base bounds');

  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Грань построения',{exact:true}).waitFor();
  await page.locator('[data-testid="cad-viewport"][data-selection-mode="face"]').waitFor();
  await clickWorld(page,[0,0,10]);
  await page.getByText('Грань выбрана',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const sketchId=await page.locator('.cad-app').getAttribute('data-active-sketch-id'); assert.ok(sketchId);
  await page.getByText('Эскиз 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Окружность/i}).click();
  await page.getByTitle('Параметры').click();
  const circle=page.locator('.parameter-panel'); await circle.waitFor();
  assert.equal(await circle.locator('.numeric-field').filter({hasText:'Диаметр'}).locator('input').inputValue(),'12');
  await circle.locator('.parameter-actions button.primary').click();
  await page.getByText('Окружность Ø12 мм создана',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  return sketchId;
}
async function openCut(page){
  const button=page.locator('[data-command-id="part.cutExtrude"]').first();
  assert.equal(await button.isEnabled(),true); await button.click();
}

await mkdir(outputRoot,{recursive:true});
const browser=await chromium.launch({headless:true});
let browserVersion,beforeEvidence; const afterEvidence=[];
let cutEvidence={},fingerprints={};
try{
  browserVersion=browser.version();

  const before=await open(browser,beforeUrl);
  const beforeSketch=await createCutReady(before.page);
  await openCut(before.page);
  const oldPanel=before.page.locator('.parameter-panel'); await oldPanel.waitFor();
  await oldPanel.getByText('Условие окончания',{exact:true}).waitFor();
  await oldPanel.getByText('Сквозь всё',{exact:true}).waitFor();
  await oldPanel.getByRole('button',{name:'Создать',exact:true}).waitFor();
  beforeEvidence=await shot(before.page,'before/cut-extrude-active-1920x1080.png',1920,1080,{
    sketchId:beforeSketch,legacySimplifiedPanel:true,
  });
  assert.deepEqual(before.errors,[]); assert.deepEqual(before.failed,[]); await before.context.close();

  const after=await open(browser,afterUrl);
  const sketchId=await createCutReady(after.page);
  const clean=await save(after.page); fingerprints.before=clean.sha256;
  assert.equal(clean.doc.sketches.length,2); assert.equal(clean.doc.features.length,1); assert.equal(clean.doc.bodies.length,1);
  const bodyId=clean.doc.bodies[0].id;
  const revisionBefore=await after.page.locator('[data-testid="cad-viewport"]').getAttribute('data-runtime-revision');

  await openCut(after.page);
  let panel=after.page.locator('.cut-extrude-parameter-panel'); await panel.waitFor();
  assert.equal(await panel.getAttribute('data-cut-profile-id'),sketchId);
  await panel.getByText('Основные параметры',{exact:true}).waitFor();
  await panel.getByText('Эскиз 2',{exact:true}).waitFor();
  await panel.getByText('Нормаль к плоскости эскиза',{exact:true}).waitFor();
  await panel.getByText('Сквозь всё',{exact:true}).waitFor();
  assert.equal(await panel.getByText(/OpenCascade|WASM|runtime|feature payload|internal ID/i).count(),0);
  afterEvidence.push(await shot(after.page,'after/cut-extrude-active-1920x1080.png',1920,1080,{
    sketchId,method:'through-all',
  }));

  await after.page.setViewportSize({width:1366,height:768});
  panel=after.page.locator('.cut-extrude-parameter-panel'); await panel.waitFor();
  afterEvidence.push(await shot(after.page,'after/cut-extrude-active-1366x768.png',1366,768,{
    sketchId,method:'through-all',
  }));
  await after.page.setViewportSize({width:1920,height:1080});

  panel=after.page.locator('.cut-extrude-parameter-panel'); await panel.waitFor();
  await panel.getByRole('button',{name:'Создать объект',exact:true}).click();
  await after.page.getByText('Сквозной вырез построен локально',{exact:true}).waitFor({timeout:120000});
  await after.page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="2"]').waitFor({timeout:120000});
  const revisionAfter=await after.page.locator('[data-testid="cad-viewport"]').getAttribute('data-runtime-revision');
  assert.notEqual(revisionAfter,revisionBefore,'cut did not rebuild runtime geometry');
  const cutBounds=await bounds(after.page); assertBounds(cutBounds,[-30,-20,0,30,20,10],'cut bounds');
  afterEvidence.push(await shot(after.page,'after/cut-extrude-result-1920x1080.png',1920,1080,{
    sketchId,bounds:cutBounds,runtimeRevision:revisionAfter,
  }));

  const saved=await save(after.page); fingerprints.after=saved.sha256;
  const cut=saved.doc.features.find((item)=>item.type==='cut-extrude'); assert.ok(cut);
  assert.equal(cut.parameters.sketchId,sketchId); assert.equal(cut.parameters.end,'through-all');
  assert.equal(saved.doc.sketches.length,2); assert.equal(saved.doc.features.length,2); assert.equal(saved.doc.bodies.length,1);
  assert.equal(saved.doc.bodies[0].id,bodyId);
  const featureId=cut.id;

  await after.page.reload({waitUntil:'networkidle'});
  await after.page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await fileCommand(after.page,'Открыть');
  await after.page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:120000});
  await after.page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="2"]').waitFor({timeout:120000});
  const reopened=await save(after.page);
  const reopenedCut=reopened.doc.features.find((item)=>item.type==='cut-extrude'); assert.ok(reopenedCut);
  assert.equal(reopenedCut.id,featureId); assert.equal(reopenedCut.parameters.sketchId,sketchId);
  assert.equal(reopenedCut.parameters.end,'through-all'); assert.equal(reopened.doc.bodies[0].id,bodyId);
  assertBounds(await bounds(after.page),cutBounds,'reopened cut bounds');

  cutEvidence={
    sketchId,sketchName:'Эскиз 2',method:'through-all',featureId,bodyId,
    bodyCount:1,bounds:cutBounds,runtimeRevisionBefore:revisionBefore,runtimeRevisionAfter:revisionAfter,
    saveOpenIdentity:'PASS',
  };
  assert.deepEqual(after.errors,[]); assert.deepEqual(after.failed,[]); await after.context.close();
}finally{await browser.close();}

const manifest={
  schemaVersion:1,
  package:'CAD-VIS-006A',
  reference:'kompas25-cut-extrude-active',
  source:{productSha:sourceSha,actualCheckoutSha:sourceCheckoutSha,localDockerImageId:sourceImageId},
  result:{productSha:resultSha,actualCheckoutSha:resultCheckoutSha,localDockerImageId:resultImageId},
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  cut:cutEvidence,
  fingerprints,
  screenshots:{before:[beforeEvidence],after:afterEvidence},
  remainingCutExtrudeParity:[
    'На расстояние',
    'До объекта',
    'До ближайшей поверхности',
    'Второе направление',
    'Симметрично',
    'Уклон',
    'Тонкая стенка',
    'редактирование существующей операции',
    'multi-body application scope',
    'phantom',
    'proprietary icons/artwork',
    'exact spacing',
  ],
  STRUCTURAL_BEHAVIORAL_DELTA:'PASS',
  VISUAL_DELTA:'PASS',
  PARITY:'PARTIAL',
  FULL_M2V:'NOT_ACCEPTED',
  oldArtifactDependency:false,
};
await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-006A self-contained visual evidence PASS');
