import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import { reloadAndOpenSavedDocument } from '../m3/M3DocumentReplacement.mjs';

const base=(process.env.ASA_CAD_SHELL_URL??'http://127.0.0.1:8090/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[],failed=[];
page.on('pageerror',(error)=>errors.push(error.message));
page.on('requestfailed',(request)=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText??'failed'}`));

const branch=(name)=>page.locator('[data-sketch-branch-id]').filter({hasText:name});
const disclosure=(name)=>branch(name).locator('[data-sketch-disclosure]');
const children=(name)=>branch(name).locator('[data-sketch-children]');

async function saveAndRead(){
  await page.locator('.global-actions [data-command-id="system.save"]').click();
  await page.getByText('Сохранено локально',{exact:true}).waitFor();
  const raw=await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document'));
  assert.ok(raw,'saved CadDocument missing');
  return JSON.parse(raw);
}
async function observable(){
  return {
    raw:await page.evaluate(()=>localStorage.getItem('asa-cad-m2-shell-document')),
    dirty:await page.locator('.dirty-dot').count(),
    undoEnabled:await page.locator('[data-command-id="system.undo"]').first().isEnabled(),
  };
}
async function ids(locator,attribute){
  return locator.evaluateAll((nodes,attr)=>nodes.map((node)=>node.getAttribute(attr)),attribute);
}
async function assertTreeMatches(document){
  for(const sketch of document.sketches){
    const node=branch(sketch.name);
    await node.waitFor();
    assert.equal(await disclosure(sketch.name).getAttribute('aria-expanded'),'true',`${sketch.name} must default expanded`);
    assert.deepEqual(
      await ids(node.locator('[data-tree-sketch-entity-id]'),'data-tree-sketch-entity-id'),
      sketch.entities.map((entity)=>entity.id),
      `${sketch.name} entity rows must come from sketch.entities`,
    );
    const expectedDimensions=document.dimensions.filter((dimension)=>sketch.dimensionIds.includes(dimension.id)).map((dimension)=>dimension.id);
    assert.deepEqual(
      await ids(node.locator('[data-dimension-id]'),'data-dimension-id'),
      expectedDimensions,
      `${sketch.name} dimensions must follow sketch.dimensionIds ownership`,
    );
  }
  const allDimensionIds=await ids(page.locator('[data-dimension-id]'),'data-dimension-id');
  assert.equal(allDimensionIds.length,new Set(allDimensionIds).size,'dimension must appear only once in tree');
  assert.equal(allDimensionIds.length,document.dimensions.length,'all dimensions must have exactly one tree owner');
  assert.equal(await page.locator('[data-tree-node^="dimension-ownership-"]').count(),0,'fixture contains orphan/multi-owner dimensions');
}

try{
  await page.goto(`${base}/dev/part/reference`,{waitUntil:'networkidle'});
  await page.locator('.cad-app[data-dev-fixture="reference"][data-fixture-status="ready"]').waitFor({timeout:120_000});
  await page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({timeout:120_000});

  assert.equal(await page.locator('[data-tree-disclosure="part-root"]').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('[data-tree-disclosure="origin"]').getAttribute('aria-expanded'),'true');
  for(const id of ['plane-xy','plane-xz','plane-yz']) await page.locator(`[data-tree-node="${id}"]`).waitFor();

  const saved=await saveAndRead();
  assert.equal(saved.sketches.length,2,'reference fixture must contain two real sketches');
  assert.equal(saved.dimensions.length,3,'reference fixture must contain three real dimensions');
  await assertTreeMatches(saved);

  assert.deepEqual(await ids(branch('Эскиз 1').locator('[data-sketch-entity-type]'),'data-sketch-entity-type'),['line','line','line','line']);
  assert.deepEqual(await ids(branch('Эскиз 2').locator('[data-sketch-entity-type]'),'data-sketch-entity-type'),['circle']);
  await branch('Эскиз 1').getByText('Ширина: 60 мм',{exact:true}).waitFor();
  await branch('Эскиз 1').getByText('Высота: 40 мм',{exact:true}).waitFor();
  await branch('Эскиз 2').getByText('Диаметр: 12 мм',{exact:true}).waitFor();

  const baseline=await observable();
  await disclosure('Эскиз 1').click();
  assert.equal(await disclosure('Эскиз 1').getAttribute('aria-expanded'),'false');
  assert.equal(await children('Эскиз 1').count(),0);
  assert.equal(await disclosure('Эскиз 2').getAttribute('aria-expanded'),'true');
  assert.equal(await children('Эскиз 2').count(),1);
  assert.deepEqual(await observable(),baseline,'Sketch 1 disclosure mutated document/history state');
  await disclosure('Эскиз 1').click();
  await children('Эскиз 1').waitFor();

  await disclosure('Эскиз 2').click();
  assert.equal(await disclosure('Эскиз 2').getAttribute('aria-expanded'),'false');
  assert.equal(await children('Эскиз 2').count(),0);
  assert.equal(await disclosure('Эскиз 1').getAttribute('aria-expanded'),'true');
  assert.equal(await children('Эскиз 1').count(),1);
  assert.deepEqual(await observable(),baseline,'Sketch 2 disclosure mutated document/history state');
  await disclosure('Эскиз 2').click();
  await children('Эскиз 2').waitFor();

  const sketch1=saved.sketches.find((sketch)=>sketch.name==='Эскиз 1');
  assert.ok(sketch1,'Sketch 1 missing');
  const width=saved.dimensions.find((dimension)=>dimension.name==='width');
  assert.ok(width && sketch1.dimensionIds.includes(width.id),'width dimension ownership missing');
  await page.locator(`[data-dimension-id="${width.id}"]`).click();
  await page.getByText('Изменить размер',{exact:true}).waitFor();
  const field=page.locator('.parameter-panel .numeric-field input');
  assert.equal(Number(await field.inputValue()),60);
  await field.fill('62');
  await page.locator('.parameter-actions button.primary').click();
  await page.getByText('Ширина: 62 мм',{exact:true}).waitFor();
  const edited=await saveAndRead();
  const editedWidth=edited.dimensions.find((dimension)=>dimension.id===width.id);
  assert.equal(editedWidth?.value,62,'nested dimension edit changed identity/value incorrectly');
  assert.deepEqual(edited.sketches.find((sketch)=>sketch.id===sketch1.id)?.dimensionIds,sketch1.dimensionIds,'dimension ownership changed after edit');

  await reloadAndOpenSavedDocument(page);
  const reopened=await saveAndRead();
  assert.deepEqual(reopened.sketches.map((sketch)=>({id:sketch.id,dimensionIds:sketch.dimensionIds})),edited.sketches.map((sketch)=>({id:sketch.id,dimensionIds:sketch.dimensionIds})),'save/open changed sketch dimension ownership');
  assert.deepEqual(reopened.dimensions.map((dimension)=>dimension.id),edited.dimensions.map((dimension)=>dimension.id),'save/open changed dimension IDs');
  const reopenedWidth=reopened.dimensions.find((dimension)=>dimension.id===width.id);
  assert.ok(reopenedWidth,'reopened width dimension must preserve the same id');
  assert.equal(reopenedWidth.value,62,'edited width value must survive save/reopen');
  await assertTreeMatches(reopened);
  await branch('Эскиз 1').getByText('Ширина: 62 мм',{exact:true}).waitFor();

  assert.equal(await page.locator('button button').count(),0,'tree must not nest buttons');
  assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
  assert.deepEqual(failed,[],`failed requests: ${failed.join(' | ')}`);

  console.log('V6C_SKETCH_BRANCHES PASS');
  console.log('V6C_INDEPENDENT_SKETCH_DISCLOSURE PASS');
  console.log('V6C_REAL_ENTITY_STRUCTURE PASS');
  console.log('V6C_DIMENSION_OWNERSHIP PASS');
  console.log('V6C_OWNED_DIMENSION_DUPLICATES 0');
  console.log('V6C_ORPHAN_DIMENSIONS 0');
  console.log('V6C_DIMENSION_EDIT_FROM_TREE PASS');
  console.log('V6C_DISCLOSURE_DOCUMENT_MUTATION NO');
  console.log('V6C_SAVE_REOPEN_OWNERSHIP PASS');
  console.log('V6C_EDITED_VALUE_AFTER_REOPEN PASS');
}finally{
  await browser.close();
}
