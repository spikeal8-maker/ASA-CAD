import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.ASA_CAD_PUPPETEER_MODULE||'puppeteer');
const dirnameHere=dirname(fileURLToPath(import.meta.url));
const root=resolve(dirnameHere,'..');
const url=pathToFileURL(resolve(root,'fusion-v4.html')).href;
const browser=await puppeteer.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE||puppeteer.executablePath(),args:['--no-sandbox','--disable-extensions']});
const errors=[],network=[];
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.setViewport({width:2048,height:1137,deviceScaleFactor:1});
 await page.goto(url,{waitUntil:'load'});
 await page.waitForSelector('.v4-command');
 let check=await page.evaluate(()=>{
   const all=[...document.querySelectorAll('.v4-command')];
   return {count:all.length,allDrawn:all.every(b=>b.querySelector('svg.v4-art[data-art]')?.getAttribute('data-art')===b.dataset.tool),
     bad:all.filter(b=>b.innerHTML.includes('undefined')).map(b=>b.dataset.tool),
     atlas:window.asaFusionIconAtlas.names.length,
     startBar:document.querySelector('.titlebar')?getComputedStyle(document.querySelector('.titlebar')).display:'absent',
     htmlWidth:document.documentElement.scrollWidth,
     outerWidth:innerWidth}
 });
 assert.equal(check.count,23,'Solid tab button count');
 assert.equal(check.atlas,51,'51 distinct command art keys');
 const art=await page.evaluate(()=>{const bodies=window.asaFusionIconAtlas.names.map(name=>{const box=document.createElement('template');box.innerHTML=icon(name,42);return box.content.querySelector('svg')?.innerHTML||'';});return {unique:new Set(bodies).size,invalid:bodies.filter(s=>!s||s.includes('undefined')).length};});
 assert.equal(art.unique,51,'All 51 commands must have visually distinct SVG markup');
 assert.equal(art.invalid,0,'No missing path or undefined SVG artwork');
 assert.ok(check.allDrawn,'Every tool has own art SVG');
 assert.deepEqual(check.bad,[],'No missing SVG markup');
 assert.ok(['none','absent'].includes(check.startBar),'System title row must remain removed');
 assert.ok(check.htmlWidth<=check.outerWidth,'Unexpected document overflow');
 const counts=[];
 for(const tab of ['ТВЁРДОЕ ТЕЛО','ПОВЕРХНОСТИ','СЕТКА','ЛИСТОВОЙ МЕТАЛЛ','ПЛАСТИК','УТИЛИТЫ','АВТОМАТИЗАЦИЯ']){
   await page.evaluate(tab=>window.asaCad.setActiveTab(tab),tab);
   const checkTab=await page.evaluate(()=>({
     count:document.querySelectorAll('.v4-command').length,
     iconMisses:[...document.querySelectorAll('.v4-command')].filter(b=>!b.querySelector('svg.v4-art')).map(b=>b.dataset.tool),
     clipped:[...document.querySelectorAll('.groupLabel')].filter(b=>b.scrollWidth-b.clientWidth>2).map(b=>b.dataset.menu)
   }));
   assert.equal(checkTab.iconMisses.length,0,'Unmapped icons in '+tab);
   assert.equal(checkTab.clipped.length,0,'Group labels clipped in '+tab+':'+checkTab.clipped.join(','));
   counts.push([tab,checkTab.count]);
 }
 assert.equal(counts.reduce((s,x)=>s+x[1],0),68,'Every ribbon item across tabs');
 await page.evaluate(()=>window.asaCad.setActiveTab('ТВЁРДОЕ ТЕЛО'));
 const group='[data-menu="СОЗДАТЬ"]';
 await page.click(group);
 await page.waitForSelector('.v4-popup.show');
 assert.equal(await page.$$eval('.v4-popitem',xs=>xs.length),7,'7 dropdown options');
 await page.hover('.v4-popitem[data-menu-item="1"]');
 await page.waitForSelector('.fusion-flyout.show');
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-menu.png')});
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.v4-popup')?.classList.contains('show'));
 await page.click('[data-tool="Выдавливание"]');
 await page.waitForSelector('.paramPanel.show');
 assert.equal(await page.$eval('#paramTitle',x=>x.textContent),'Выдавливание');
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-parameters.png')});
 await page.click('#paramCancel');
 await page.waitForFunction(()=>!document.querySelector('.paramPanel')?.classList.contains('show'));
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-empty.png')});
 await page.click('#dataBtn');
 await page.waitForFunction(()=>document.querySelector('.app')?.classList.contains('show-data'));
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-projects.png')});
 await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
 await page.click('#closeData');
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-1366.png')});
 const narrow=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,
    innerWidth,
    ribbonClient:document.getElementById('groups').clientWidth,
    ribbonScroll:document.getElementById('groups').scrollWidth,
    titleHeight:document.querySelector('.titlebar')?.getBoundingClientRect().height??0
 }));
 assert.ok(narrow.width<=narrow.innerWidth+1,'Root document overflows at 1366');
 assert.equal(narrow.titleHeight,0);
 assert.equal(errors.length,0,'JavaScript page errors: '+errors.join(', '));
 assert.equal(network.length,0,'Offline reference must not issue remote requests: '+network.join(', '));
 await page.goto(url+'?icons=1',{waitUntil:'load'});
 await page.waitForSelector('.fusion-audit-item');
 assert.equal(await page.$$eval('.fusion-audit-item',xs=>xs.length),51,'51 visual review cards');
 await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 await page.screenshot({path:resolve(root,'evidence','fusion-v4-icons-review.png'),fullPage:true});
 await page.click('.fusion-audit-close');
 assert.equal(await page.$$('.fusion-audit:not([hidden])').then(xs=>xs.length),0);
 console.log(JSON.stringify({status:'PASS',tabs:counts,iconAtlas:check.atlas,buttons:68,menuItems:7,flyout:true,params:true,narrow,networkRequests:network.length,pageErrors:errors.length},null,2));
}catch(e){console.error('FAIL:',e.stack);process.exitCode=1;}finally{await browser.close();}
