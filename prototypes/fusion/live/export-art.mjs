import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:process.env.ASA_CAD_BROWSER_EXECUTABLE});
try{
 const page=await browser.newPage();
 await page.goto(pathToFileURL(resolve(here,'../fusion-v5.html')).href);
 const artwork=await page.evaluate(()=>Object.fromEntries(Object.keys(asaFusionNativeReference.commands).map(id=>[id,{svg:asaNativeIcon.draw(id,40),status:asaNativeIcon.status(id)}])));
 await writeFile(resolve(here,'artwork.v6.json'),JSON.stringify(artwork,null,2)+'\n');
 console.log('EXPORTED_OWN_ARTWORK',Object.keys(artwork).length);
}finally{await browser.close();}
