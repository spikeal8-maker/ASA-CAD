import assert from 'node:assert/strict';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import ref from '../native-reference.v5.json' with {type:'json'};
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:2048,height:1137}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
try{
 await page.goto(process.env.ASA_FUSION_URL||'http://127.0.0.1:8093/');
 await page.locator('.live-groups .live-tool').first().waitFor();
 const tabs=ref.tabs;
 const counts=[];
 for(let i=0;i<tabs.length;i++){
  await page.locator('.live-tabs button').nth(i).click();
  const expected=tabs[i].panels.flatMap(id=>ref.panels[id].promoted||[]).map(item=>item.commandId).filter(Boolean);
  const got=await page.locator('.live-group .live-tool[data-native-command]').evaluateAll(nodes=>nodes.map(n=>({
    id:n.getAttribute('data-native-command'),name:n.getAttribute('aria-label'),markup:!!n.querySelector('svg,.live-icon'),
    status:n.querySelector('[data-art-status]')?.getAttribute('data-art-status')||'custom-authored'
  })));
  assert.deepEqual(got.map(x=>x.id),expected,'Toolbar command order '+tabs[i].id);
  assert.ok(got.every(x=>x.name?.length&&x.markup),'Missing Russian name/art '+tabs[i].id);
  const misses=got.filter(x=>x.status==='missing-reference');
  assert.deepEqual(misses,[],'Generic icon placeholders on '+tabs[i].id);
  counts.push({tab:tabs[i].id,buttons:got.length,missing:misses.length,authored:got.filter(x=>x.status==='independent-redraw-awaiting-review').length});
  if(i===0){
   await page.screenshot({path:resolve(out,'fusion-live-solid-ribbon-icons.png')});
   const hole=page.locator('[data-native-menu-command="FusionHoleCommand"]');
   await page.locator('[data-native-group="SolidCreatePanel"]').click();
   await hole.waitFor();assert.equal(await hole.isEnabled(),false,'Native Hole must not claim full kernel implementation');
   await page.keyboard.press('Escape');
  }
  if(i===5)await page.screenshot({path:resolve(out,'fusion-live-utilities-ribbon-icons.png')});
 }
 assert.equal(counts.reduce((sum,x)=>sum+x.buttons,0),142,'Promoted placements count');
 await page.setViewportSize({width:1366,height:768});
 const metrics=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,windowWidth:innerWidth,tabLabels:[...document.querySelectorAll('.live-tabs button')].map(x=>({label:x.textContent,overflow:x.scrollWidth-x.clientWidth}))}));
 assert.ok(metrics.documentWidth<=metrics.windowWidth+1,'Entire document overflows at 1366');
 assert.ok(metrics.tabLabels.every(x=>x.overflow<=2),'Russian tab label truncation: '+JSON.stringify(metrics.tabLabels));
 await page.screenshot({path:resolve(out,'fusion-live-ribbon-1366.png')});
 assert.deepEqual(errors,[]);
 const report={status:'PASS',scope:'Actual rendered tool ribbon at 2048x1137 and 1366x768',tabs:counts,placements:142,missingPlaceholders:0,nativeHoleDisabledUntilCompatibleBodyExists:true,rootOverflow:false,labelsNotClipped:true,pageErrors:errors,pixelParityAccepted:false};
 await writeFile(resolve(out,'fusion-live-ribbon-checks.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error.stack);await page.screenshot({path:resolve(out,'fusion-live-ribbon-debug.png')}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
