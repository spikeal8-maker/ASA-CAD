import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));

const app=()=>page.locator('.cad-app');
const extrudeButton=()=>page.locator('[data-command-id="part.extrude"]').first();
const panel=()=>page.locator('.extrude-parameter-panel');
const distance=()=>panel().locator('.numeric-field').filter({hasText:'Расстояние'}).locator('input');

async function bounds(){
  const raw=await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw,'missing viewport bounds'); return raw.split(',').map(Number);
}
function near(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<0.25,`${label}[${index}] ${value} != ${expected[index]}`));
}
async function save(){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'saved document missing'); return {raw,doc:JSON.parse(raw)};
}
async function newPart(){
  await page.locator('.new-tab-button').click();
  const guard=page.getByRole('dialog',{name:'Есть несохранённые изменения'});
  if(await guard.count()) await guard.getByRole('button',{name:'Не сохранять'}).click();
  const dialog=page.getByRole('dialog',{name:'Новый документ'}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-feature-count="0"]').waitFor();
}
async function profile(support='XY'){
  await page.getByRole('button',{name:/Создать эскиз/i}).click();
  await page.getByText('Плоскость построения',{exact:true}).waitFor();
  await page.getByRole('button',{name:new RegExp(support)}).click();
  await page.getByRole('button',{name:'Создать',exact:true}).click();
  const sketchId=await app().getAttribute('data-active-sketch-id'); assert.ok(sketchId);
  await page.getByRole('button',{name:/Прямоугольник/i}).click();
  await page.getByTitle('Параметры').click();
  await page.locator('.parameter-panel').waitFor();
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Прямоугольник 60×40 мм создан',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Завершить эскиз/i}).click();
  await page.getByText('Эскиз завершен',{exact:true}).waitFor();
  await app().locator('xpath=..').waitFor();
  return sketchId;
}
async function openExtrude(){
  const button=extrudeButton();
  assert.equal(await button.isEnabled(),true,'Extrude should be enabled');
  await button.click(); await panel().waitFor();
}
async function assertPanel(sketchId){
  assert.equal(await panel().getAttribute('data-extrude-profile-id'),sketchId);
  await panel().getByText('Эскиз 1',{exact:true}).waitFor();
  await panel().getByText('Нормаль к плоскости эскиза',{exact:true}).waitFor();
  await panel().getByText('На расстояние',{exact:true}).waitFor();
  assert.equal(await distance().inputValue(),'10');
  await panel().getByText('Прямое',{exact:true}).waitFor();
  assert.equal(await panel().getByRole('switch',{name:'Симметрично'}).getAttribute('aria-checked'),'false');
  assert.equal(await app().getAttribute('data-feature-count'),'0');
  assert.equal(await app().getAttribute('data-body-count'),null);
}
async function assertCounts(features,bodies){
  assert.equal(await app().getAttribute('data-feature-count'),String(features));
  const bodyText=await page.getByText(new RegExp(`^Тело `)).count();
  assert.equal(bodyText,bodies);
}
async function apply(){
  await panel().getByRole('button',{name:'Создать объект',exact:true}).click();
  await page.locator('.cad-app[data-runtime-status="ready"]').waitFor({timeout:120000});
  await page.locator('[data-testid="cad-viewport"] canvas').waitFor({timeout:60000});
}
async function inspectExtrude(){
  const saved=await save();
  const feature=saved.doc.features.find((item)=>item.type==='extrude');
  assert.ok(feature,'persisted extrude missing');
  return {saved,feature,sketch:saved.doc.sketches.find((item)=>item.id===feature.parameters.sketchId)};
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await newPart();

  const sketchId=await profile('XY');
  const clean=await save();
  await openExtrude(); await assertPanel(sketchId);
  await distance().fill('25');
  await panel().getByRole('button',{name:'Сменить направление'}).click();
  await panel().getByRole('switch',{name:'Симметрично'}).click();
  assert.equal(await panel().getByRole('button',{name:'Сменить направление'}).isDisabled(),true);
  assert.equal(await app().locator('.dirty-dot').count(),0,'transient Extrude UI made document dirty');
  await panel().getByRole('button',{name:'Отмена',exact:true}).click();
  assert.equal(await panel().count(),0); await assertCounts(0,0);
  assert.equal((await save()).raw,clean.raw,'Cancel mutated CadDocument');

  await openExtrude();
  await distance().fill('0');
  await panel().getByRole('alert').getByText('Расстояние должно быть больше 0',{exact:true}).waitFor();
  assert.equal(await panel().getByRole('button',{name:'Создать объект'}).isDisabled(),true);
  await app().focus(); await page.keyboard.press('Control+Enter');
  await assertCounts(0,0);
  assert.equal(await app().locator('.dirty-dot').count(),0,'invalid Extrude made document dirty');
  await panel().getByRole('button',{name:'Отмена',exact:true}).click();
  assert.equal((await save()).raw,clean.raw,'invalid Extrude mutated CadDocument');

  await openExtrude(); await apply(); await assertCounts(1,1);
  near(await bounds(),[-30,-20,0,30,20,10],'direct bounds');
  const direct=await inspectExtrude();
  assert.equal(direct.feature.parameters.sketchId,sketchId);
  assert.equal(direct.feature.parameters.distance,10);
  assert.equal(Boolean(direct.feature.parameters.reverse),false);
  assert.equal(Boolean(direct.feature.parameters.symmetric),false);
  const directFeatureId=direct.feature.id;
  await page.reload({waitUntil:'networkidle'});
  await page.getByTitle('Открыть').click();
  await page.getByText('Локальный документ открыт',{exact:true}).waitFor({timeout:60000});
  near(await bounds(),[-30,-20,0,30,20,10],'reopened direct bounds');
  const reopened=await save();
  assert.equal(reopened.doc.features[0].id,directFeatureId);
  assert.equal(reopened.doc.features[0].parameters.sketchId,sketchId);
  assert.equal(reopened.doc.features[0].parameters.distance,10);

  await newPart(); const reverseSketch=await profile('XY'); await openExtrude();
  await panel().getByRole('button',{name:'Сменить направление'}).click();
  await panel().getByText('Обратное',{exact:true}).waitFor(); await apply();
  near(await bounds(),[-30,-20,-10,30,20,0],'reverse bounds');
  const reverse=await inspectExtrude();
  assert.equal(reverse.feature.parameters.sketchId,reverseSketch);
  assert.equal(reverse.feature.parameters.reverse,true);

  await newPart(); const symmetricSketch=await profile('XY'); await openExtrude();
  await distance().fill('20'); await panel().getByRole('switch',{name:'Симметрично'}).click();
  assert.equal(await panel().getByRole('button',{name:'Сменить направление'}).isDisabled(),true);
  await apply(); near(await bounds(),[-30,-20,-10,30,20,10],'symmetric bounds');
  const symmetric=await inspectExtrude();
  assert.equal(symmetric.feature.parameters.sketchId,symmetricSketch);
  assert.equal(symmetric.feature.parameters.distance,20);
  assert.equal(symmetric.feature.parameters.symmetric,true);

  for(const support of ['XZ','YZ']){
    await newPart(); await profile(support);
    const button=extrudeButton();
    assert.equal(await button.isDisabled(),true,`${support}: Extrude must fail closed`);
    assert.match(await button.getAttribute('title')??'',/прямоугольный эскиз.*XY/i);
    await assertCounts(0,0);
    const saved=await save();
    assert.equal(saved.doc.features.length,0,`${support}: disabled Extrude mutated features`);
    assert.equal(saved.doc.bodies.length,0,`${support}: disabled Extrude mutated bodies`);
  }

  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  console.log('✓ V4 Extrude profile/method/distance panel PASS');
  console.log('✓ invalid + Cancel no-mutation PASS');
  console.log('✓ direct/reverse/symmetric bounds + persistence PASS');
  console.log('✓ XZ/YZ fail-closed PASS');
}finally{await browser.close();}
