import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import * as THREE from '../../vendor/toubkal/node_modules/three/build/three.module.js';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[],failed=[];
page.on('pageerror',(e)=>errors.push(e.message));
page.on('requestfailed',(r)=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));

const app=()=>page.locator('.cad-app');
async function fileCommand(label){
  await page.getByRole('button',{name:'Файл',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Файл',exact:true}); await menu.waitFor();
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
}
async function save(){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw); return {raw,doc:JSON.parse(raw)};
}
async function bounds(){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw); return raw.split(',').map(Number);
}
function near(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<0.25,`${label}[${index}] ${value}`));
}
function vector(value,label){
  assert.ok(value,`missing ${label}`); const result=value.split(',').map(Number);
  assert.equal(result.length,3); assert.ok(result.every(Number.isFinite)); return result;
}
async function clickWorld(point){
  const viewport=page.locator('[data-testid="cad-viewport"]'),canvas=viewport.locator('canvas');
  await canvas.waitFor(); const box=await canvas.boundingBox(); assert.ok(box);
  const state=await viewport.evaluate((node)=>({
    position:node.getAttribute('data-camera-position'),
    target:node.getAttribute('data-camera-target'),
    up:node.getAttribute('data-camera-up'),
  }));
  const b=await bounds();
  const diagonal=Math.max(Math.hypot(b[3]-b[0],b[4]-b[1],b[5]-b[2]),10);
  const camera=new THREE.PerspectiveCamera(34,box.width/box.height,Math.max(diagonal/1000,0.01),diagonal*100);
  camera.position.set(...vector(state.position,'camera position'));
  camera.up.set(...vector(state.up,'camera up'));
  camera.lookAt(new THREE.Vector3(...vector(state.target,'camera target')));
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  const projected=new THREE.Vector3(...point).project(camera);
  assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'projected point outside viewport');
  await canvas.click({position:{x:(projected.x+1)*box.width/2,y:(1-projected.y)*box.height/2}});
}
async function createBaseBody(){
  await fileCommand('Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
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
  await app().filter({has:page.locator('[data-runtime-status="ready"]')}).count().catch(()=>0);
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="1"]').waitFor({timeout:120000});
  near(await bounds(),[-30,-20,0,30,20,10],'base bounds');
}
async function createCutSketch(){
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Грань построения',{exact:true}).waitFor();
  await page.locator('[data-testid="cad-viewport"][data-selection-mode="face"]').waitFor();
  await clickWorld([0,0,10]);
  await page.getByText('Грань выбрана',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const id=await app().getAttribute('data-active-sketch-id'); assert.ok(id);
  await page.getByText('Эскиз 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Окружность/i}).click();
  await page.getByTitle('Параметры').click();
  const panel=page.locator('.parameter-panel'); await panel.waitFor();
  assert.equal(await panel.locator('.numeric-field').filter({hasText:'Диаметр'}).locator('input').inputValue(),'12');
  await panel.locator('.parameter-actions button.primary').click();
  await page.getByText('Окружность Ø12 мм создана',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  return id;
}
async function openCut(){
  const button=page.locator('[data-command-id="part.cutExtrude"]').first();
  assert.equal(await button.isEnabled(),true); await button.click();
  const panel=page.locator('.cut-extrude-parameter-panel'); await panel.waitFor(); return panel;
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await createBaseBody();
  const cutSketchId=await createCutSketch();
  const clean=await save();
  assert.equal(clean.doc.sketches.length,2); assert.equal(clean.doc.features.length,1); assert.equal(clean.doc.bodies.length,1);
  const bodyId=clean.doc.bodies[0].id;
  const revisionBefore=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-runtime-revision');
  assert.match(revisionBefore??'',/^occ-\d+$/);

  let panel=await openCut();
  assert.equal(await panel.getAttribute('data-cut-profile-id'),cutSketchId);
  await panel.getByText('Основные параметры',{exact:true}).waitFor();
  await panel.getByText('Эскиз 2',{exact:true}).waitFor();
  await panel.getByText('Нормаль к плоскости эскиза',{exact:true}).waitFor();
  await panel.getByText('Сквозь всё',{exact:true}).waitFor();
  assert.equal(await panel.getByText(/OpenCascade|WASM|runtime|feature payload/i).count(),0);
  assert.equal(await app().getAttribute('data-feature-count'),'1');
  assert.equal(await page.locator('.dirty-dot').count(),0);
  const begun=await save();
  assert.equal(begun.raw,clean.raw,'begin Cut-Extrude mutated CadDocument');

  await panel.getByRole('button',{name:'Отмена',exact:true}).click();
  await page.getByText('Команда отменена',{exact:true}).waitFor();
  const cancelled=await save();
  assert.equal(cancelled.raw,clean.raw,'Cancel Cut-Extrude mutated CadDocument');

  panel=await openCut();
  await panel.getByRole('button',{name:'Создать объект',exact:true}).click();
  await page.getByText('Сквозной вырез построен локально',{exact:true}).waitFor({timeout:120000});
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="2"]').waitFor({timeout:120000});
  await page.getByText('Вырезать выдавливанием 1',{exact:true}).waitFor();
  near(await bounds(),[-30,-20,0,30,20,10],'cut bounds');
  const revisionAfter=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-runtime-revision');
  assert.match(revisionAfter??'',/^occ-\d+$/); assert.notEqual(revisionAfter,revisionBefore,'cut did not rebuild runtime geometry');

  const cutSaved=await save();
  assert.equal(cutSaved.doc.sketches.length,2,'duplicate Sketch created');
  assert.equal(cutSaved.doc.features.length,2,'duplicate Feature created');
  assert.equal(cutSaved.doc.bodies.length,1);
  assert.equal(cutSaved.doc.bodies[0].id,bodyId);
  const cut=cutSaved.doc.features.find((item)=>item.type==='cut-extrude'); assert.ok(cut);
  assert.equal(cut.parameters.sketchId,cutSketchId);
  assert.equal(cut.parameters.end,'through-all');
  const cutFeatureId=cut.id;

  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await fileCommand('Открыть');
  await page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:120000});
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="2"]').waitFor({timeout:120000});
  const reopened=await save();
  const reopenedCut=reopened.doc.features.find((item)=>item.type==='cut-extrude'); assert.ok(reopenedCut);
  assert.equal(reopenedCut.id,cutFeatureId);
  assert.equal(reopenedCut.parameters.sketchId,cutSketchId);
  assert.equal(reopenedCut.parameters.end,'through-all');
  assert.equal(reopened.doc.bodies[0].id,bodyId);
  assert.equal(reopened.doc.sketches.length,2); assert.equal(reopened.doc.features.length,2);
  near(await bounds(),[-30,-20,0,30,20,10],'reopen bounds');

  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed,[],`failed requests: ${failed.join(' | ')}`);
  console.log('CAD-VIS-006A Cut-Extrude parameters PASS');
  console.log(`  SKETCH_ID=${cutSketchId}`);
  console.log(`  CUT_FEATURE_ID=${cutFeatureId}`);
  console.log(`  BODY_ID=${bodyId}`);
  console.log('  begin/cancel byte-equivalent; through-all cut and Save/Open identities preserved');
}finally{await browser.close();}
