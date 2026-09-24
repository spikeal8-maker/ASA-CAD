import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[],failed=[];
page.on('pageerror',(e)=>errors.push(e.message));
page.on('requestfailed',(r)=>failed.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText??'failed'}`));

const app=()=>page.locator('.cad-app');
const fileTrigger=()=>page.getByRole('button',{name:'Файл',exact:true});
const fileMenu=()=>page.getByRole('menu',{name:'Файл',exact:true});

async function fileCommand(label){
  await fileTrigger().click(); const menu=fileMenu(); await menu.waitFor();
  const item=menu.getByRole('menuitem',{name:label,exact:true}); await item.waitFor(); await item.click();
}
async function bounds(){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw,'missing viewport bounds'); const values=raw.split(',').map(Number);
  assert.equal(values.length,6); assert.ok(values.every(Number.isFinite)); return values;
}
function near(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<0.25,`${label}[${i}] ${v} != ${expected[i]}`));
}
async function entityIds(){
  return page.locator('[data-testid="cad-sketch-overlay"] [data-sketch-entity-id]').evaluateAll(nodes=>
    [...new Set(nodes.map(n=>n.getAttribute('data-sketch-entity-id')).filter(Boolean))].sort());
}
async function persisted(){
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'persisted document missing'); return JSON.parse(raw);
}
function identity(doc){
  assert.equal(doc.sketches.length,1); assert.equal(doc.features.length,1); assert.equal(doc.bodies.length,1);
  const sketch=doc.sketches[0], feature=doc.features[0], body=doc.bodies[0];
  const width=doc.dimensions.find(x=>x.name==='width'), height=doc.dimensions.find(x=>x.name==='height');
  assert.ok(width&&height,'driving dimensions missing');
  return {
    sketchId:sketch.id, support:sketch.support,
    entityIds:sketch.entities.map(x=>x.id).sort(), dimensionIds:[...sketch.dimensionIds].sort(),
    widthDimensionId:width.id, featureId:feature.id, bodyId:body.id,
    width:width.value,height:height.value,distance:feature.parameters.distance,featureSketchId:feature.parameters.sketchId,
  };
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/cad/');

  await fileCommand('Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();
  assert.equal(await page.locator('.dirty-dot').count(),0,'new Part must be clean');

  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:/XY/}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const sketchId=await app().getAttribute('data-active-sketch-id'); assert.ok(sketchId);

  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.locator('.content-area.panel-closed').waitFor();
  await page.getByTitle('Параметры').click();
  const rectPanel=page.locator('.parameter-panel'); await rectPanel.waitFor();
  const width=rectPanel.locator('.numeric-field').filter({hasText:'Ширина'}).locator('input');
  const height=rectPanel.locator('.numeric-field').filter({hasText:'Высота'}).locator('input');
  assert.equal(await width.inputValue(),'60'); assert.equal(await height.inputValue(),'40');
  await rectPanel.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  const initialEntities=await entityIds(); assert.equal(initialEntities.length,4);
  await page.getByRole('button',{name:/Ширина: 60 мм/}).waitFor();
  await page.getByRole('button',{name:/Высота: 40 мм/}).waitFor();

  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await page.locator('.cad-app[data-active-sketch-id=""]').waitFor();
  const readOnly=page.locator(`[data-testid="part-model-stage"][data-sketch-context="read-only"][data-sketch-id="${sketchId}"]`);
  await readOnly.waitFor();
  assert.deepEqual(await entityIds(),initialEntities,'Finish changed entity ids');

  const extrude=page.locator('[data-command-id="part.extrude"]').first();
  assert.equal(await extrude.isEnabled(),true); await extrude.click();
  const exPanel=page.locator('.extrude-parameter-panel'); await exPanel.waitFor();
  assert.equal(await exPanel.getAttribute('data-extrude-profile-id'),sketchId);
  await exPanel.getByText('Эскиз 1',{exact:true}).waitFor();
  await exPanel.getByText('На расстояние',{exact:true}).waitFor();
  assert.equal(await exPanel.locator('.numeric-field').filter({hasText:'Расстояние'}).locator('input').inputValue(),'10');
  await exPanel.getByText('Прямое',{exact:true}).waitFor();
  assert.equal(await exPanel.getByRole('switch',{name:'Симметрично'}).getAttribute('aria-checked'),'false');
  await exPanel.getByRole('button',{name:'Создать объект',exact:true}).click();
  await page.locator('.cad-app[data-runtime-status="ready"][data-feature-count="1"]').waitFor({timeout:120000});
  await page.getByText('Тело 1',{exact:true}).waitFor();
  near(await bounds(),[-30,-20,0,30,20,10],'initial bounds');

  const widthRow=page.getByRole('button',{name:/Ширина: 60 мм/}); await widthRow.click();
  const dimPanel=page.locator('.parameter-panel'); await dimPanel.getByText('Изменить размер',{exact:true}).waitFor();
  const value=dimPanel.locator('.numeric-field').filter({hasText:'Размер'}).locator('input');
  assert.equal(await value.inputValue(),'60'); await value.fill('80');
  await dimPanel.getByRole('button',{name:'Применить',exact:true}).click();
  await page.getByText('Ширина изменен на 80 мм; модель перестроена',{exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:/Ширина: 80 мм/}).waitFor();
  near(await bounds(),[-40,-20,0,40,20,10],'updated bounds');

  const rebuild=page.locator('[data-command-id="system.rebuild"]').first();
  assert.equal(await rebuild.isEnabled(),true); await rebuild.click();
  await page.getByText('Перестроено',{exact:true}).waitFor({timeout:60000});
  near(await bounds(),[-40,-20,0,40,20,10],'rebuild bounds');

  await fileCommand('Сохранить');
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  assert.equal(await page.locator('.dirty-dot').count(),0,'Save did not clear dirty state');
  const saved=await persisted(); const beforeOpen=identity(saved);
  assert.equal(beforeOpen.sketchId,sketchId); assert.deepEqual(beforeOpen.entityIds,initialEntities);
  assert.equal(beforeOpen.support,'XY'); assert.equal(beforeOpen.width,80); assert.equal(beforeOpen.height,40);
  assert.equal(beforeOpen.distance,10); assert.equal(beforeOpen.featureSketchId,sketchId);

  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await page.locator('.cad-app[data-sketch-count="0"][data-feature-count="0"]').waitFor();
  await fileCommand('Открыть');
  await page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  await page.locator('.cad-app[data-runtime-status="ready"][data-sketch-count="1"][data-feature-count="1"]').waitFor({timeout:120000});
  near(await bounds(),[-40,-20,0,40,20,10],'reopen bounds');
  const afterOpen=identity(await persisted()); assert.deepEqual(afterOpen,beforeOpen,'Save/Open changed document identity');

  const sketchRow=page.locator(`.tree-panel [data-sketch-id="${sketchId}"]`); await sketchRow.click();
  const edit=page.locator(`[data-sketch-edit-id="${sketchId}"]`); await edit.waitFor(); await edit.click();
  await page.locator(`.cad-app[data-active-sketch-id="${sketchId}"][data-sketch-count="1"][data-feature-count="1"]`).waitFor();
  assert.deepEqual(await entityIds(),initialEntities,'re-open edit changed entity ids');
  await page.getByRole('button',{name:/Ширина: 80 мм/}).waitFor();
  await page.getByRole('button',{name:/Высота: 40 мм/}).waitFor();

  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await page.locator('.cad-app[data-active-sketch-id=""][data-sketch-count="1"][data-feature-count="1"]').waitFor();
  await page.getByText('Элемент выдавливания 1',{exact:true}).waitFor();
  await page.getByText('Тело 1',{exact:true}).waitFor();
  near(await bounds(),[-40,-20,0,40,20,10],'final bounds');

  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed,[],`failed product requests: ${failed.join(' | ')}`);
  console.log('CAD-VIS-005 ordinary Part lesson PASS');
  console.log(`  SKETCH_ID=${beforeOpen.sketchId}`);
  console.log(`  WIDTH_DIMENSION_ID=${beforeOpen.widthDimensionId}`);
  console.log(`  EXTRUDE_FEATURE_ID=${beforeOpen.featureId}`);
  console.log(`  BODY_ID=${beforeOpen.bodyId}`);
  console.log('  initial bounds=-30,-20,0,30,20,10');
  console.log('  updated/rebuild/reopen bounds=-40,-20,0,40,20,10');
  console.log('  identity preserved through Save/reload/Open/re-edit');
}finally{await browser.close();}
