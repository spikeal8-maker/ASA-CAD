import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const beforeUrl=(process.env.ASA_CAD_BEFORE_URL??'http://127.0.0.1:8087').replace(/\/$/,'');
const afterUrl=(process.env.ASA_CAD_AFTER_URL??'http://127.0.0.1:8088').replace(/\/$/,'');
const outputRoot=process.env.ASA_CAD_VIS_ROOT??'cad-vis-006b';
const sourceSha=process.env.ASA_CAD_SOURCE_SHA??'015e445f179a62f5c96b9d931bf03ccca1a86d1d';
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
async function evidence(path,expected,state){
  const info=await stat(path),data=await readFile(path);
  assert.ok(info.size>0); assert.deepEqual(pngDimensions(data),expected);
  return {path,bytes:info.size,sha256:hash(data),...expected,...state};
}
async function shot(page,relative,width,height,state){
  const path=join(outputRoot,relative); await mkdir(dirname(path),{recursive:true});
  await page.screenshot({path,fullPage:false});
  return evidence(path,{width,height},state);
}
async function open(browser,baseUrl,width=1920,height=1080){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('requestfailed',(request)=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText??'failed'}`));
  const response=await page.goto(`${baseUrl}/cad/?uiScale=100`,{waitUntil:'networkidle',timeout:30000});
  assert.ok(response?.ok()); await page.getByRole('button',{name:'ASA-CAD',exact:true}).waitFor();
  return {context,page,errors,failed};
}
async function fileCommand(page,label){
  await page.getByRole('button',{name:'Файл',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Файл',exact:true}); await menu.waitFor();
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
}
async function newPart(page){
  await fileCommand(page,'Новый');
  const dialog=page.getByRole('dialog',{name:'Новый документ',exact:true}); await dialog.waitFor();
  await dialog.getByRole('button',{name:/Деталь/}).click();
  await page.locator('.cad-app[data-document-kind="part"][data-sketch-count="0"][data-feature-count="0"]').waitFor();
  await page.locator('.tree-root .tree-label').filter({hasText:'Деталь 1'}).first().waitFor();
}

await mkdir(outputRoot,{recursive:true});
const browser=await chromium.launch({headless:true});
let browserVersion,beforeEvidence; const afterEvidence=[];
try{
  browserVersion=browser.version();

  const before=await open(browser,beforeUrl);
  await newPart(before.page);
  beforeEvidence=await shot(before.page,'before/tree-part-origin-1920x1080.png',1920,1080,{
    reference:'kompas25-part-shell',
    state:'legacy-depth-chevron-tree',
  });
  assert.deepEqual(before.errors,[]); assert.deepEqual(before.failed,[]);
  await before.context.close();

  const after=await open(browser,afterUrl);
  await newPart(after.page);

  const part=after.page.locator('[data-tree-disclosure="part-root"]');
  const origin=after.page.locator('[data-tree-disclosure="origin"]');
  await part.waitFor(); await origin.waitFor();
  assert.equal(await part.getAttribute('aria-expanded'),'true');
  assert.equal(await origin.getAttribute('aria-expanded'),'true');
  for(const id of ['plane-xy','plane-xz','plane-yz']){
    const row=after.page.locator(`[data-tree-node="${id}"]`);
    await row.waitFor();
    assert.equal(await row.getAttribute('aria-expanded'),null);
    assert.equal(await row.locator('[data-tree-disclosure]').count(),0);
    assert.equal(await row.locator('.tree-chevron svg').count(),0);
  }
  afterEvidence.push(await shot(after.page,'after/tree-part-origin-expanded-1920x1080.png',1920,1080,{
    partExpanded:true,originExpanded:true,planesVisible:true,
  }));

  await origin.click();
  assert.equal(await origin.getAttribute('aria-expanded'),'false');
  assert.equal(await after.page.locator('[data-tree-node^="plane-"]').count(),0);
  afterEvidence.push(await shot(after.page,'after/tree-origin-collapsed-1920x1080.png',1920,1080,{
    partExpanded:true,originExpanded:false,planesVisible:false,
  }));

  await origin.click();
  await after.page.locator('[data-tree-node="plane-xy"]').waitFor();
  await part.click();
  assert.equal(await part.getAttribute('aria-expanded'),'false');
  assert.equal(await after.page.locator('[data-tree-branch="origin"]').count(),0);
  afterEvidence.push(await shot(after.page,'after/tree-part-collapsed-1920x1080.png',1920,1080,{
    partExpanded:false,originVisible:false,
  }));

  await part.click();
  await after.page.locator('[data-tree-branch="origin"]').waitFor();
  await after.page.setViewportSize({width:1366,height:768});
  await after.page.locator('[data-tree-node="plane-yz"]').waitFor();
  afterEvidence.push(await shot(after.page,'after/tree-part-origin-expanded-1366x768.png',1366,768,{
    partExpanded:true,originExpanded:true,planesVisible:true,
  }));

  assert.equal(await after.page.locator('button button').count(),0);
  assert.deepEqual(after.errors,[]); assert.deepEqual(after.failed,[]);
  await after.context.close();
}finally{
  await browser.close();
}

const manifest={
  schemaVersion:1,
  package:'CAD-VIS-006B',
  reference:'kompas25-part-shell',
  source:{productSha:sourceSha,actualCheckoutSha:sourceCheckoutSha,localDockerImageId:sourceImageId},
  result:{productSha:resultSha,actualCheckoutSha:resultCheckoutSha,localDockerImageId:resultImageId},
  environment:{browser:`Chromium ${browserVersion}`,os:`${process.platform} ${process.arch}`,deviceScaleFactor:1,uiScale:100,browserZoomPercent:100},
  screenshots:{before:[beforeEvidence],after:afterEvidence},
  acceptanceFocus:[
    'Part branch',
    'Origin branch',
    'indentation',
    'chevron placement',
    'leaf rows',
    'expanded/collapsed state',
    'row alignment',
  ],
  VISUAL_DELTA:'PASS',
  PARITY:'PARTIAL',
  FULL_TREE_PARITY:'NOT_CLAIMED',
  FULL_M2V:'NOT_ACCEPTED',
  oldArtifactDependency:false,
};
await writeFile(join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CAD-VIS-006B self-contained tree visual evidence PASS');
