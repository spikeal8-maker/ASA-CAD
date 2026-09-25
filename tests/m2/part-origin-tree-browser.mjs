import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[],failed=[];
page.on('pageerror',(error)=>errors.push(error.message));
page.on('requestfailed',(request)=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText??'failed'}`));

const partDisclosure=()=>page.locator('[data-tree-disclosure="part-root"]');
const originDisclosure=()=>page.locator('[data-tree-disclosure="origin"]');
const originBranch=()=>page.locator('[data-tree-branch="origin"]');
const plane=(id)=>page.locator(`[data-tree-node="${id}"]`);

async function fileCommand(label){
  await page.getByRole('button',{name:'Файл',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Файл',exact:true}); await menu.waitFor();
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
}

async function newPart(){
  await fileCommand('Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();
  await page.locator('.tree-root .tree-label').filter({hasText:'Деталь 1'}).first().waitFor();
}

async function saveAndRead(){
  await page.getByTitle('Сохранить').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'serialized CadDocument missing');
  return raw;
}

async function observable(){
  const app=page.locator('.cad-app');
  return {
    raw:await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document')),
    dirty:await page.locator('.dirty-dot').count(),
    sketchCount:await app.getAttribute('data-sketch-count'),
    featureCount:await app.getAttribute('data-feature-count'),
    bodyCount:await page.getByText(/^Тело \d+$/).count(),
    undoEnabled:await page.locator('[data-command-id="system.undo"]').first().isEnabled(),
  };
}

function assertUnchanged(actual,expected,label){
  assert.deepEqual(actual,expected,`${label} mutated observable document/history state`);
}

async function assertPlanesVisible(expected){
  for(const id of ['plane-xy','plane-xz','plane-yz']){
    if(expected) await plane(id).waitFor();
    else assert.equal(await plane(id).count(),0,`${id} should be hidden`);
  }
}

try{
  await page.goto(`${base}/cad/?uiScale=100`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  await newPart();

  const baselineRaw=await saveAndRead();
  const baseline=await observable();
  assert.equal(baseline.raw,baselineRaw);
  assert.equal(baseline.dirty,0,'saved Part must be clean');
  assert.equal(baseline.sketchCount,'0');
  assert.equal(baseline.featureCount,'0');
  assert.equal(baseline.undoEnabled,false,'new saved Part should have no undo history');

  const part=partDisclosure(),origin=originDisclosure();
  await part.waitFor(); await origin.waitFor();

  assert.equal(await part.getAttribute('aria-expanded'),'true','Part root must default expanded');
  assert.equal(await origin.getAttribute('aria-expanded'),'true','Origin must default expanded');
  assert.equal(await page.locator('[data-tree-branch="part-root"]').getByText('Деталь 1',{exact:true}).count(),1);
  assert.equal(await originBranch().getByText('Начало координат',{exact:true}).count(),1);
  await assertPlanesVisible(true);

  for(const id of ['plane-xy','plane-xz','plane-yz']){
    const row=plane(id);
    assert.equal(await row.getAttribute('aria-expanded'),null,`${id} must not expose aria-expanded`);
    assert.equal(await row.locator('[data-tree-disclosure]').count(),0,`${id} must not have disclosure target`);
    assert.equal(await row.locator('.tree-chevron svg').count(),0,`${id} must not draw fake chevron`);
  }
  assert.equal(await page.locator('button button').count(),0,'tree must not nest button inside button');

  await origin.click();
  assert.equal(await origin.getAttribute('aria-expanded'),'false','Origin collapse state mismatch');
  await assertPlanesVisible(false);
  assert.equal(await page.locator('[data-tree-branch="part-root"]').count(),1,'Origin collapse hid Part root');
  assert.equal(await originBranch().count(),1,'Origin collapse hid Origin row');
  assertUnchanged(await observable(),baseline,'collapse Origin');

  await origin.click();
  assert.equal(await origin.getAttribute('aria-expanded'),'true','Origin re-expand state mismatch');
  await assertPlanesVisible(true);
  assertUnchanged(await observable(),baseline,'expand Origin');

  await part.click();
  assert.equal(await part.getAttribute('aria-expanded'),'false','Part collapse state mismatch');
  assert.equal(await originBranch().count(),0,'Part collapse must hide Origin');
  await assertPlanesVisible(false);
  assert.equal(await page.locator('[data-tree-branch="part-root"]').getByText('Деталь 1',{exact:true}).count(),1,'Part root disappeared while collapsed');
  assertUnchanged(await observable(),baseline,'collapse Part');

  await part.click();
  assert.equal(await part.getAttribute('aria-expanded'),'true','Part re-expand state mismatch');
  await originBranch().waitFor();
  assert.equal(await originDisclosure().getAttribute('aria-expanded'),'true','Origin state should remain expanded');
  await assertPlanesVisible(true);
  assertUnchanged(await observable(),baseline,'expand Part');

  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed,[],`failed requests: ${failed.join(' | ')}`);

  console.log('PART_ROOT_BRANCH PASS');
  console.log('PART_ROOT_DEFAULT_EXPANDED PASS');
  console.log('PART_ROOT_COLLAPSE PASS');
  console.log('PART_ROOT_REEXPAND PASS');
  console.log('ORIGIN_BRANCH PASS');
  console.log('ORIGIN_DEFAULT_EXPANDED PASS');
  console.log('ORIGIN_COLLAPSE PASS');
  console.log('ORIGIN_REEXPAND PASS');
  console.log('PLANES_ARE_LEAVES PASS');
  console.log('DISCLOSURE_NO_MUTATION PASS');
}finally{
  await browser.close();
}
