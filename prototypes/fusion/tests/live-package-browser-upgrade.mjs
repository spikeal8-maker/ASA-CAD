import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import {basename,dirname,extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../../vendor/toubkal/node_modules/playwright-core/index.mjs';

// Run only after the final commit has been packaged with --previous-package.
// Required: ASA_FUSION_PREVIOUS_PACKAGE, ASA_FUSION_CANDIDATE_PACKAGE,
// ASA_CAD_BROWSER_EXECUTABLE. Optional: ASA_FUSION_EVIDENCE_DIR and
// ASA_FUSION_UPGRADE_ROLLBACK=0 (rollback runs by default).
// Syntax-only validation: node --check prototypes/fusion/tests/live-package-browser-upgrade.mjs
// Both legacy and versioned previous entries are supported; every retained generation is verified.
// No installed launcher, existing browser profile, or listener on 8099 is used.
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const output=resolve(process.env.ASA_FUSION_EVIDENCE_DIR||join(repo,'prototypes/fusion/evidence'));
const reportFile=join(output,'fusion-live-package-browser-upgrade-checks.json');
const storageKeys={canonical:'asa-cad-m2-shell-document:state',mirror:'asa-cad-m2-shell-document'};
const digest=value=>createHash('sha256').update(value).digest('hex');
const prefix=head=>'/__asa_builds/'+head+'/';
const within=(base,file)=>file===base||file.startsWith(base+sep);
const report={schemaVersion:2,status:'RUNNING',startedUTC:new Date().toISOString(),
 scope:'Real packaged PlaneGCS/OpenCascade upgrade on an owned ephemeral loopback origin',
 input:'Public UI only; DOM and LocalStorage reads are assertions, not document injection',
 installedOriginTouched:false,existingBrowserUsed:false,visualParityAccepted:false,
 phases:[],servers:[],requests:[],storageChecks:[],screenshots:[],pageErrors:[],requestFailures:[],cleanupErrors:[]};
let phase='preflight',browser=null,context=null,server=null,origin=null,port=null,activeHead=null;
let currentPage=null,previous=null,candidate=null,legacyHead=null,recordNetwork=true,outputAllowed=false;
const assetSources=new Map();
const ownedServers=new Set(),pageNames=new WeakMap(),requestRecords=new WeakMap(),responses=[];

function required(name){const value=process.env[name];assert.ok(value,name+' is required');return value;}
function safeFile(base,name){
 assert.ok(typeof name==='string'&&name&&!name.includes('\\')&&!name.includes(':')&&!name.includes('\0')&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'),'Unsafe manifest path: '+name);
 const file=resolve(base,name);assert.ok(within(base,file),'Manifest path escapes package: '+name);
 let current=base;
 for(const part of name.split('/')){current=join(current,part);assert.equal(lstatSync(current).isSymbolicLink(),false,'Package link: '+name);}
 assert.ok(lstatSync(file).isFile()&&within(base,realpathSync(file)),'Non-regular package file: '+name);
 return file;
}
function verifyPackage(folder){
 const base=realpathSync(resolve(folder)),raw=readFileSync(safeFile(base,'delivery-manifest.json'));
 const manifest=JSON.parse(raw),files=new Map();
 assert.equal(manifest.product,'ASA-CAD-Fusion-Live');assert.equal(manifest.version,8);
 assert.equal(manifest.workspace,'fusion-sketch-v1');assert.equal(manifest.launchPort,8099);
 assert.match(manifest.sourceHead,/^[a-f0-9]{40}$/);assert.ok(Array.isArray(manifest.files));
 for(const item of manifest.files){
  assert.equal(files.has(item.path),false,'Duplicate manifest path: '+item.path);
  const bytes=readFileSync(safeFile(base,item.path));
  assert.equal(bytes.length,item.bytes,'Package byte count changed: '+item.path);
  assert.equal(digest(bytes),item.sha256,'Package checksum changed: '+item.path);files.set(item.path,item);
 }
 assert.ok(files.has('app/index.html')&&files.has('serve.cjs'),'Package is missing entry/server');
 assert.ok([...files.keys()].some(name=>name.startsWith('app/')&&/opencascade.*\.wasm$/i.test(name)),'Real OCC WASM is absent');
 assert.ok([...files.keys()].some(name=>name.startsWith('app/')&&/planegcs.*\.wasm$/i.test(name)),'Real PlaneGCS WASM is absent');
 return {base,raw,manifest,files,manifestSha256:digest(raw)};
}
function packageBuilds(value){
 const manifest=value.manifest,routing=manifest.assetRouting;
 const builds=new Map([[manifest.sourceHead,{sourceHead:manifest.sourceHead,version:manifest.version,workspace:manifest.workspace,root:'app',package:value}]]);
 if(routing){
  assert.equal(routing.prefix,prefix(manifest.sourceHead));assert.ok(Array.isArray(routing.compatibility));
  for(const item of routing.compatibility){
   assert.match(item.sourceHead,/^[a-f0-9]{40}$/);assert.equal(builds.has(item.sourceHead),false,'Duplicate retained build');
   assert.equal(item.root,'compatibility/'+item.sourceHead+'/app');assert.equal(item.version,8);assert.equal(item.workspace,'fusion-sketch-v1');
   builds.set(item.sourceHead,{...item,package:value});
  }
 }
 const legacy=routing?.unversionedSourceHead||manifest.sourceHead;
 assert.ok(builds.has(legacy),'Unversioned owner is absent from the package');
 for(const build of builds.values()){
  assert.ok(value.files.has(build.root+'/index.html'),'Retained entry is not hashed');
  const html=readFileSync(safeFile(value.base,build.root+'/index.html'),'utf8');
  const urls=[...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].flatMap(tag=>[...tag[0].matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi)].map(match=>match[2])).filter(url=>!url.startsWith('data:'));
  assert.ok(urls.length>0,'Entry has no script/style assets');
  build.versioned=urls.every(url=>url.startsWith(prefix(build.sourceHead)));
  if(!build.versioned){
   assert.equal(build.sourceHead,legacy,'Only the original owner may use unversioned entry assets');
   assert.ok(urls.every(url=>!url.startsWith('/__asa_builds/')&&!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)),'Mixed or external entry assets');
  }
 }
 return builds;
}
function packageProof(value){return {directory:value.base,sourceHead:value.manifest.sourceHead,manifestSha256:value.manifestSha256,verifiedFiles:value.files.size,version:value.manifest.version,workspace:value.manifest.workspace};}
function step(name,detail={}){report.phases.push({name,...detail});console.log(name,JSON.stringify(detail));}
function resolvedOutputDirectory(folder){
 let ancestor=folder;const tail=[];
 while(!existsSync(ancestor)){tail.unshift(basename(ancestor));ancestor=dirname(ancestor);}
 return resolve(realpathSync(ancestor),...tail);
}
async function stopServer(value){
 if(!value||value.child.exitCode!==null||value.child.signalCode!==null)return;
 await new Promise((done,reject)=>{
  let force;
  const deadline=setTimeout(()=>reject(Error('Owned server did not exit: '+value.child.pid)),7000);
  value.child.once('exit',()=>{clearTimeout(force);clearTimeout(deadline);done();});
  force=setTimeout(()=>value.child.kill('SIGKILL'),3000);value.child.kill('SIGTERM');
 });
 value.stoppedUTC=new Date().toISOString();
 if(value.proof)value.proof.stoppedUTC=value.stoppedUTC;
}
async function startServer(packageValue,requestedPort,selectedHead=null){
 assert.ok(requestedPort===0||requestedPort===port,'Only the first allocated ephemeral port can be reused');
 assert.notEqual(requestedPort,8099,'The installed origin is forbidden');
 // The candidate server supports port 0 even when the legacy package server does not.
 const args=[join(candidate.base,'serve.cjs'),'--root',join(packageValue.base,'app'),'--port',String(requestedPort)];
 if(selectedHead)args.push('--active-build',selectedHead);
 const child=spawn(process.execPath,args,{cwd:candidate.base,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const value={child,log:'',root:packageValue.base};ownedServers.add(value);
 child.once('exit',()=>ownedServers.delete(value));
 const listeningPort=await new Promise((done,reject)=>{
  const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Owned server startup timed out: '+value.log));},15000);
  const fail=message=>{clearTimeout(timeout);reject(Error(message));};
  const exited=(code,signal)=>fail('Owned server exited before listening ('+code+'/'+signal+'): '+value.log);
  child.once('error',error=>fail(error.message));child.once('exit',exited);
  child.stderr.on('data',bytes=>{value.log+=bytes.toString();});
  child.stdout.on('data',bytes=>{
   value.log+=bytes.toString();const match=/http:\/\/127\.0\.0\.1:(\d+)\//.exec(value.log);
   if(!match)return;clearTimeout(timeout);child.removeListener('exit',exited);done(Number(match[1]));
  });
 });
 assert.notEqual(listeningPort,8099,'OS returned the installed port; test refuses to continue');
 if(requestedPort!==0)assert.equal(listeningPort,requestedPort);
 if(port===null)port=listeningPort;origin='http://127.0.0.1:'+port;
 activeHead=selectedHead||packageValue.manifest.sourceHead;
 const health=await getHealth();
 assert.equal(health.port,port);assert.equal(health.sourceHead,activeHead);
 assert.equal(health.product,'ASA-CAD-Fusion-Live');assert.equal(health.version,8);
 assert.equal(health.workspace,'fusion-sketch-v1');assert.equal(health.localOnly,true);
 assert.equal(health.unversionedSourceHead,legacyHead);
 assert.equal(health.assetPrefix,prefix(activeHead));
 const knownHeads=[packageValue.manifest.sourceHead,...(packageValue.manifest.assetRouting?.compatibility||[]).map(item=>item.sourceHead)];
 assert.deepEqual([...health.retainedSourceHeads].sort(),knownHeads.filter(head=>head!==activeHead).sort());
 value.proof={phase,pid:child.pid,port,root:packageValue.base,activeBuild:selectedHead,health};report.servers.push(value.proof);
 return value;
}
function getHealth(){
 return new Promise((done,reject)=>{
  const req=httpRequest(origin+'/__asa_health',res=>{
   const data=[];res.on('data',chunk=>data.push(chunk));res.on('end',()=>{
    try{assert.equal(res.statusCode,200);done(JSON.parse(Buffer.concat(data).toString('utf8')));}catch(error){reject(error);}
   });
  });
  req.on('error',reject);req.setTimeout(5000,()=>req.destroy(Error('Owned health request timed out')));req.end();
 });
}
function expectedAsset(record){
 const pathname=decodeURIComponent(new URL(record.url).pathname),versioned=/^\/__asa_builds\/([a-f0-9]{40})\/(.*)$/.exec(pathname);
 const entry=!extname(pathname)||extname(pathname)==='.html';
 const owner=versioned?versioned[1]:entry?record.activeSourceHead:legacyHead;
 const source=assetSources.get(owner);assert.ok(source,'Unknown requested build: '+owner);
 const name=versioned?(versioned[2]||'index.html'):pathname==='/'?'index.html':pathname.slice(1);
 const item=source.package.files.get(source.root+'/'+name);assert.ok(item,'Browser requested an unmanifested asset: '+pathname);
 return {sourceHead:owner,item,versioned:!!versioned};
}
function streamAssetHash(url,expected){
 assert.equal(new URL(url).origin,origin);
 return new Promise((done,reject)=>{
  const req=httpRequest(url,res=>{
   const hash=createHash('sha256');let bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);});res.on('error',reject);
   res.on('end',()=>{
    try{assert.equal(res.statusCode,200);assert.equal(res.headers['x-asa-cad-asset-source'],expected.sourceHead);done({bytes,sha256:hash.digest('hex')});}catch(error){reject(error);}
   });
  });
  req.on('error',reject);req.setTimeout(30000,()=>req.destroy(Error('Owned asset verification timed out')));req.end();
 });
}
function observeNetwork(){
 context.on('request',request=>{
  if(!recordNetwork)return;
  let page='worker';try{page=pageNames.get(request.frame().page())||'unnamed';}catch{}
  const item={id:report.requests.length+1,phase,page,method:request.method(),url:request.url(),resourceType:request.resourceType(),activeSourceHead:activeHead};
  report.requests.push(item);requestRecords.set(request,item);
 });
 context.on('response',response=>{
  if(!recordNetwork)return;
  const item=requestRecords.get(response.request());if(!item)return;
  const work=(async()=>{
   try{
    const headers=await response.allHeaders();item.status=response.status();
    item.assetSourceHead=headers['x-asa-cad-asset-source']||null;item.cacheControl=headers['cache-control']||null;
    item.contentType=headers['content-type']||null;
    const expected=expectedAsset(item);item.expectedSourceHead=expected.sourceHead;item.expectedSha256=expected.item.sha256;
    assert.equal(item.status,200,'Unexpected HTTP status: '+item.url);
    assert.equal(item.assetSourceHead,expected.sourceHead,'Wrong asset owner: '+item.url);
    assert.equal(headers['cross-origin-opener-policy'],'same-origin');assert.equal(headers['cross-origin-embedder-policy'],'require-corp');
    if(expected.versioned)assert.match(item.cacheControl,/immutable/);
    assert.equal(Number(headers['content-length']),expected.item.bytes,'Browser response Content-Length: '+item.url);
    if(expected.item.bytes>4*1024*1024){
     // OCC WASM is about 50 MB; avoid Chromium inspector response-buffer eviction.
     // The browser must finish its real response; independently stream and hash the
     // identical immutable route on the still-running owned server, without buffering it.
     assert.equal(await response.finished(),null,'Browser response did not finish');
     Object.assign(item,await streamAssetHash(item.url,expected));item.bodyVerification='same-URL streaming GET after browser response finished';
    }else{
     const bytes=await response.body();item.bytes=bytes.length;item.sha256=digest(bytes);item.bodyVerification='browser response body';
    }
    assert.equal(item.bytes,expected.item.bytes,'Requested asset byte count: '+item.url);
    assert.equal(item.sha256,expected.item.sha256,'Browser response differs from the manifest: '+item.url);
    if(/\.wasm(?:\?|$)/i.test(item.url))assert.equal(item.contentType,'application/wasm');
    item.verified=true;
   }catch(error){item.verificationError=String(error);}
  })();responses.push(work);
 });
 context.on('requestfailed',request=>{
  if(!recordNetwork)return;
  const item=requestRecords.get(request);if(item)item.failure=request.failure()?.errorText;
  report.requestFailures.push({phase,page:item?.page,url:request.url(),error:request.failure()?.errorText});
 });
}
async function settleNetwork(){
 let index=0;
 while(index<responses.length){const batch=responses.slice(index);index=responses.length;await Promise.all(batch);}
 const invalid=report.requests.filter(item=>item.verificationError||item.failure);
 assert.deepEqual(invalid,[],'Browser transport failed verification');
 assert.deepEqual(report.requestFailures,[]);assert.deepEqual(report.pageErrors,[]);
}
async function newPage(name,url){
 const page=await context.newPage();pageNames.set(page,name);currentPage=page;page.setDefaultTimeout(20000);
 page.on('pageerror',error=>report.pageErrors.push({phase,page:name,error:error.message}));
 await page.goto(url,{waitUntil:'load',timeout:60000});await page.locator('.live-quickbar').waitFor();
 assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
 return page;
}
const quick=(page,id)=>page.locator('.live-quickbar [data-command-id="'+id+'"]');
const tool=(page,id)=>page.locator('.live-tool[data-command-id="'+id+'"]');
async function storage(page){return page.evaluate(keys=>Object.fromEntries(Object.entries(keys).map(([name,key])=>[name,localStorage.getItem(key)])),storageKeys);}
function storageProof(value){
 return Object.fromEntries(Object.entries(value).map(([key,raw])=>[key,raw===null?null:{bytes:Buffer.byteLength(raw),sha256:digest(raw)}]));
}
function unchangedStorage(name,before,after){
 for(const key of Object.keys(storageKeys)){
  assert.ok(before[key]!==null&&after[key]!==null,'Missing '+key+' storage at '+name);
  assert.ok(Buffer.from(before[key]).equals(Buffer.from(after[key])),'Raw '+key+' bytes changed at '+name);
 }
 report.storageChecks.push({name,byteIdentical:true,before:storageProof(before),after:storageProof(after)});
}
function savedDocument(value){
 assert.ok(value.canonical&&value.mirror,'Save must populate canonical and mirror keys');
 const envelope=JSON.parse(value.canonical);assert.equal(envelope.serializedDocument,value.mirror,'Mirror differs from canonical document');
 assert.ok(Number.isSafeInteger(envelope.revision)&&envelope.revision>0);return {document:JSON.parse(value.mirror),revision:envelope.revision};
}
async function saveUI(page){
 const before=await storage(page);await quick(page,'system.save').click();
 await page.waitForFunction(({key,before})=>localStorage.getItem(key)!==before,{key:storageKeys.canonical,before:before.canonical});
 await page.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Сохранено'));
 const value=await storage(page);savedDocument(value);return value;
}
function assertRectangle(document,features){
 assert.equal(document.kind,'part');assert.equal(document.sketches.length,1);assert.equal(document.features.length,features);
 const entities=document.sketches[0].entities;assert.equal(entities.length,4);assert.ok(entities.every(entity=>entity.type==='line'));
 const points=entities.flatMap(entity=>[entity.data.from,entity.data.to]);
 const extent=[0,1].map(axis=>Math.max(...points.map(point=>point[axis]))-Math.min(...points.map(point=>point[axis])));
 extent.forEach((value,index)=>assert.ok(Math.abs(value-[60,40][index])<.001,'Saved rectangle extent: '+extent));
 if(features){assert.equal(document.features[0].type,'extrude');assert.equal(document.features[0].parameters.distance,10);assert.equal(document.bodies.length,1);}
 else assert.equal(document.bodies.length,0);
 return {documentId:document.documentId,sketchId:document.sketches[0].id,entities:entities.length,rectangleExtent:extent,featureCount:features};
}
async function readBrep(page,expectedDocument=null){
 await page.waitForFunction(()=>{
  const app=document.querySelector('.cad-app'),viewport=document.querySelector('.cad-viewport');
  return app?.getAttribute('data-feature-count')==='1'&&app?.getAttribute('data-recompute-status')==='clean'&&app?.getAttribute('data-runtime-status')==='ready'&&!!viewport?.getAttribute('data-runtime-revision')&&!!viewport?.getAttribute('data-bounds')&&viewport.querySelectorAll('canvas').length===1;
 },null,{timeout:120000});
 const value=await page.locator('.cad-viewport').evaluate(element=>({bounds:element.getAttribute('data-bounds').split(',').map(Number),runtimeRevision:element.getAttribute('data-runtime-revision'),canvasCount:element.querySelectorAll('canvas').length}));
 assert.equal(value.bounds.length,6);assert.ok(value.bounds.every(Number.isFinite));assert.equal(value.canvasCount,1);
 value.extent=value.bounds.slice(3).map((number,index)=>number-value.bounds[index]);
 value.extent.forEach((number,index)=>assert.ok(Math.abs(number-[60,40,10][index])<.01,'Real BRep extent differs: '+value.extent));
 if(expectedDocument){
  assert.equal(await page.locator('[data-timeline-sketch="'+expectedDocument.sketches[0].id+'"]').count(),1);
  assert.equal(await page.locator('[data-timeline-feature="'+expectedDocument.features[0].id+'"]').count(),1);
 }
 assert.equal(await page.locator('.cad-viewport-error').count(),0);return value;
}
function sameBounds(actual,expected){
 assert.equal(actual.length,expected.length);
 actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-6,'Reopened BRep bounds differ: '+actual+' vs '+expected));
}
async function openUI(page,expectedStorage,document,label){
 const before=await storage(page);unchangedStorage(label+' before Open',expectedStorage,before);
 assert.equal(await page.locator('.cad-app').getAttribute('data-feature-count'),'0','A fresh page must load only through Open');
 await quick(page,'system.open').click();const brep=await readBrep(page,document);
 const after=await storage(page);unchangedStorage(label+' after Open',before,after);return brep;
}
function runtimeRequests(pageName,head,sincePhase){
 const requests=report.requests.filter(item=>item.page===pageName&&(!sincePhase||item.phase===sincePhase));
 for(const runtime of ['planegcs','opencascade']){
  assert.ok(requests.some(item=>item.verified&&item.assetSourceHead===head&&item.url.toLowerCase().includes(runtime)&&/\.wasm(?:\?|$)/i.test(item.url)),runtime+' WASM was not really loaded for '+pageName);
 }
 return requests.filter(item=>/\.wasm(?:\?|$)/i.test(item.url)).map(item=>item.id);
}
function deferredOccRequests(pageName,head,versioned){
 const requests=report.requests.filter(item=>item.page===pageName&&item.phase===phase&&/opencascade/i.test(item.url));
 assert.ok(requests.some(item=>/\.js(?:\?|$)/i.test(item.url))&&requests.some(item=>/\.wasm(?:\?|$)/i.test(item.url)),'Tab must fetch both OCC lazy JS and WASM after upgrade: '+pageName);
 assert.ok(requests.every(item=>item.verified&&item.assetSourceHead===head&&(versioned?new URL(item.url).pathname.startsWith(prefix(head)):!new URL(item.url).pathname.startsWith('/__asa_builds/'))));
 return requests.map(item=>item.id);
}
async function screenshot(page,label){
 const name='fusion-live-package-browser-upgrade-'+label+'.png';await page.screenshot({path:join(output,name)});report.screenshots.push(name);
}

try{
 assert.equal(process.argv.length,2,'Use environment variables; no URL/port override is accepted');
 previous=verifyPackage(required('ASA_FUSION_PREVIOUS_PACKAGE'));
 candidate=verifyPackage(required('ASA_FUSION_CANDIDATE_PACKAGE'));
 const executable=realpathSync(resolve(required('ASA_CAD_BROWSER_EXECUTABLE')));
 assert.ok(lstatSync(executable).isFile(),'Browser executable is not a file');
 assert.notEqual(previous.base,candidate.base);assert.notEqual(previous.manifest.sourceHead,candidate.manifest.sourceHead);
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
 assert.equal(candidate.manifest.sourceHead,head,'Candidate must match the exact checked-out final commit');
 assert.equal(candidate.manifest.fullFusionParity,false);
 assert.equal(candidate.manifest.previousManifestSha256,previous.manifestSha256,'Candidate retained a different previous package');
 assert.equal(candidate.manifest.assetRouting.prefix,prefix(head));
 const previousBuilds=packageBuilds(previous),candidateBuilds=packageBuilds(candidate);
 legacyHead=previous.manifest.assetRouting?.unversionedSourceHead||previous.manifest.sourceHead;
 assert.equal(candidate.manifest.assetRouting.unversionedSourceHead,legacyHead);
 assert.equal(candidate.manifest.assetRouting.previousSourceHead,previous.manifest.sourceHead);
 assert.deepEqual([...candidateBuilds.keys()].filter(value=>value!==head).sort(),[...previousBuilds.keys()].sort(),'Candidate must retain every previous generation exactly once');
 for(const build of previousBuilds.values()){
  const retained=candidateBuilds.get(build.sourceHead);
  assert.equal(retained.root,'compatibility/'+build.sourceHead+'/app');assert.equal(retained.version,build.version);assert.equal(retained.workspace,build.workspace);assert.equal(retained.versioned,build.versioned);
  for(const [name,item] of previous.files){
   if(!name.startsWith(build.root+'/'))continue;
   const copy=candidate.files.get(retained.root+name.slice(build.root.length));
   assert.ok(copy,'Retained old asset missing: '+name);assert.equal(copy.sha256,item.sha256);assert.equal(copy.bytes,item.bytes);
  }
  assetSources.set(build.sourceHead,build);
 }
 assetSources.set(head,candidateBuilds.get(head));
 const previousEntryVersioned=previousBuilds.get(previous.manifest.sourceHead).versioned;
 assert.equal(candidateBuilds.get(head).versioned,true,'New entry must use immutable versioned assets');
 const realOutput=resolvedOutputDirectory(output);
 for(const value of [previous,candidate])assert.equal(within(value.base,realOutput),false,'Evidence must not modify a package');
 outputAllowed=true;mkdirSync(output,{recursive:true});
 report.packages={previous:packageProof(previous),candidate:packageProof(candidate)};
 report.generations={unversionedSourceHead:legacyHead,previousEntryVersioned,verifiedSourceHeads:[...assetSources.keys()],retainedLegacyBrowserFlow:legacyHead!==previous.manifest.sourceHead};
 report.repositoryHead=head;report.serverScriptSha256=candidate.files.get('serve.cjs').sha256;
 report.testScriptSha256=digest(readFileSync(fileURLToPath(import.meta.url)));
 report.rollbackRequested=process.env.ASA_FUSION_UPGRADE_ROLLBACK!=='0';

 phase='old-sketch';server=await startServer(previous,0);report.origin=origin;
 browser=await chromium.launch({headless:true,executablePath:executable});report.browserVersion=browser.version();
 context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
 observeNetwork();
 // Routing disables Chromium's HTTP cache, so recorded bytes came from our server.
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
 report.browserIsolation={newBrowserProcess:true,newContext:true,persistentProfile:false,serviceWorkers:'blocked',httpCache:'disabled by context routing',externalRequests:'blocked'};
 const oldPage=await newPage('old-tab',origin+'/');assert.deepEqual(await storage(oldPage),{canonical:null,mirror:null});
 await tool(oldPage,'part.sketch.create').click();await oldPage.getByLabel('Плоскость эскиза',{exact:true}).selectOption('XY');await oldPage.locator('.live-commit').click();
 await oldPage.locator('[data-testid="cad-sketch-overlay"]').waitFor();
 await tool(oldPage,'sketch.rectangle').click();await oldPage.getByLabel('Ширина',{exact:true}).fill('60');await oldPage.getByLabel('Высота',{exact:true}).fill('40');await oldPage.locator('.live-commit').click();
 await oldPage.waitForFunction(()=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')==='4');
 await oldPage.waitForFunction(()=>document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status')==='solved',null,{timeout:90000});
 const sketchStorage=await saveUI(oldPage),sketchSave=savedDocument(sketchStorage);
 const sketchProof=assertRectangle(sketchSave.document,0);await settleNetwork();
 assert.ok(report.requests.some(item=>item.page==='old-tab'&&item.verified&&/planegcs.*\.wasm(?:\?|$)/i.test(item.url)),'Real PlaneGCS must run before upgrade');
 assert.equal(report.requests.some(item=>/opencascade/i.test(item.url)),false,'OCC must remain lazy until after server replacement');
 assert.equal(await oldPage.locator('.cad-app').getAttribute('data-runtime-status'),'idle');
 step('old UI rectangle saved before OCC load',{...sketchProof,revision:sketchSave.revision,storage:storageProof(sketchStorage)});

 let legacyPage=null;
 if(legacyHead!==previous.manifest.sourceHead){
  phase='legacy-sketch';legacyPage=await newPage('legacy-tab',origin+prefix(legacyHead)+'index.html');
  unchangedStorage('legacy entry before Open',sketchStorage,await storage(legacyPage));
  await quick(legacyPage,'system.open').click();
  await legacyPage.waitForFunction(()=>document.querySelector('.live-status')?.textContent?.includes('Локальный документ открыт'));
  await legacyPage.locator('[data-timeline-sketch="'+sketchSave.document.sketches[0].id+'"]').waitFor();
  const overlay=legacyPage.locator('[data-testid="cad-sketch-overlay"]');
  if(!await overlay.isVisible())await legacyPage.locator('[data-timeline-sketch="'+sketchSave.document.sketches[0].id+'"]').dblclick();
  await overlay.waitFor();
  await legacyPage.waitForFunction(()=>document.querySelector('[data-testid="cad-sketch-overlay"]')?.getAttribute('data-entity-count')==='4');
  await legacyPage.waitForFunction(()=>document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status')==='solved',null,{timeout:90000});
  unchangedStorage('legacy entry after Open',sketchStorage,await storage(legacyPage));await settleNetwork();
  assert.equal(await legacyPage.locator('.cad-app').getAttribute('data-runtime-status'),'idle');
  assert.equal(report.requests.some(item=>item.page==='legacy-tab'&&/opencascade/i.test(item.url)),false,'Legacy OCC must remain lazy until server replacement');
  step('retained legacy UI opened the same saved sketch before upgrade',{sourceHead:legacyHead,sketchId:sketchSave.document.sketches[0].id});
 }

 phase='upgrade-old-extrude';currentPage=oldPage;await stopServer(server);server=await startServer(candidate,port);
 assert.equal(oldPage.isClosed(),false);assert.equal(oldPage.url(),origin+'/');
 assert.equal(await oldPage.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'),'4');
 unchangedStorage('server upgrade before old-tab edit',sketchStorage,await storage(oldPage));
 await tool(oldPage,'sketch.finish').click();await tool(oldPage,'part.extrude').click();
 await oldPage.getByLabel('Расстояние',{exact:true}).fill('10');await oldPage.locator('.live-commit').click();
 const oldBrep=await readBrep(oldPage);const solidStorage=await saveUI(oldPage),solidSave=savedDocument(solidStorage);
 assert.equal(solidSave.revision,sketchSave.revision+1);assert.equal(solidSave.document.documentId,sketchSave.document.documentId);
 assertRectangle(solidSave.document,1);await settleNetwork();
 const deferredOcc=deferredOccRequests('old-tab',previous.manifest.sourceHead,previousEntryVersioned);
 assert.equal(report.requests.filter(item=>item.page==='old-tab'&&item.resourceType==='document').length,1,'The old tab was reloaded');
 await screenshot(oldPage,'old-after-upgrade');
 step('previous tab extruded through its retained OCC',{brep:oldBrep,revision:solidSave.revision,versionedAssets:previousEntryVersioned,deferredOccRequestIds:deferredOcc,runtimeRequestIds:runtimeRequests('old-tab',previous.manifest.sourceHead)});
 if(legacyPage){
  phase='upgrade-legacy-extrude';currentPage=legacyPage;
  assert.equal(await legacyPage.locator('[data-testid="cad-sketch-overlay"]').getAttribute('data-entity-count'),'4');
  unchangedStorage('legacy before deferred extrude',solidStorage,await storage(legacyPage));
  await tool(legacyPage,'sketch.finish').click();await tool(legacyPage,'part.extrude').click();
  await legacyPage.getByLabel('Расстояние',{exact:true}).fill('10');await legacyPage.locator('.live-commit').click();
  const legacyBrep=await readBrep(legacyPage);sameBounds(legacyBrep.bounds,oldBrep.bounds);await settleNetwork();
  const legacyDeferred=deferredOccRequests('legacy-tab',legacyHead,previousBuilds.get(legacyHead).versioned);
  unchangedStorage('legacy extrude without Save',solidStorage,await storage(legacyPage));
  assert.equal(report.requests.filter(item=>item.page==='legacy-tab'&&item.resourceType==='document').length,1,'Legacy tab was reloaded');
  await screenshot(legacyPage,'legacy-after-upgrade');
  step('original legacy tab fetched and used retained OCC after upgrade',{brep:legacyBrep,deferredOccRequestIds:legacyDeferred,runtimeRequestIds:runtimeRequests('legacy-tab',legacyHead)});
 }

 phase='current-open';const newPageCurrent=await newPage('current-tab',origin+'/');
 const currentBrep=await openUI(newPageCurrent,solidStorage,solidSave.document,'current entry');await settleNetwork();
 sameBounds(currentBrep.bounds,oldBrep.bounds);
 const currentAssets=report.requests.filter(item=>item.page==='current-tab'&&item.resourceType!=='document');
 assert.ok(currentAssets.length>0&&currentAssets.every(item=>new URL(item.url).pathname.startsWith(prefix(head))&&item.assetSourceHead===head&&item.verified));
 await screenshot(newPageCurrent,'current-open');
 step('current versioned UI opened unchanged saved document',{brep:currentBrep,runtimeRequestIds:runtimeRequests('current-tab',head)});

 if(report.rollbackRequested){
  phase='rollback';await stopServer(server);server=await startServer(candidate,port,previous.manifest.sourceHead);
  currentPage=newPageCurrent;
  const cameraBefore=await newPageCurrent.locator('.cad-viewport').getAttribute('data-camera-position');
  await newPageCurrent.locator('[data-cube-face="top"]').click();
  await newPageCurrent.waitForFunction(before=>document.querySelector('.cad-viewport')?.getAttribute('data-camera-position')!==before,cameraBefore);
  sameBounds((await readBrep(newPageCurrent,solidSave.document)).bounds,currentBrep.bounds);
  unchangedStorage('existing current tab after rollback',solidStorage,await storage(newPageCurrent));
  const rollbackPage=await newPage('rollback-old-entry',origin+'/');
  const rollbackBrep=await openUI(rollbackPage,solidStorage,solidSave.document,'rollback old entry');
  sameBounds(rollbackBrep.bounds,oldBrep.bounds);await settleNetwork();
  await screenshot(rollbackPage,'rollback-old-open');
  // A cold versioned entry also exercises deferred current kernels while root entry is old.
  const retainedCurrent=await newPage('retained-current-entry',origin+prefix(head)+'index.html');
  const retainedBrep=await openUI(retainedCurrent,solidStorage,solidSave.document,'retained current entry during rollback');
  sameBounds(retainedBrep.bounds,currentBrep.bounds);await settleNetwork();
  const rollbackRuntimeProof={previousEntryRuntimeRequestIds:runtimeRequests('rollback-old-entry',previous.manifest.sourceHead,'rollback'),retainedCurrentRuntimeRequestIds:runtimeRequests('retained-current-entry',head,'rollback'),existingCurrentTabCameraChanged:true};
  if(legacyPage){
   const retainedLegacy=await newPage('rollback-legacy-entry',origin+prefix(legacyHead)+'index.html');
   const legacyRollbackBrep=await openUI(retainedLegacy,solidStorage,solidSave.document,'original legacy entry during rollback');
   sameBounds(legacyRollbackBrep.bounds,currentBrep.bounds);await settleNetwork();
   rollbackRuntimeProof.originalLegacyRuntimeRequestIds=runtimeRequests('rollback-legacy-entry',legacyHead,'rollback');
   await screenshot(retainedLegacy,'rollback-legacy-open');
  }
  step('rollback preserves current tab and every tested cold generation',rollbackRuntimeProof);
 }

 phase='final-verification';await settleNetwork();
 assert.ok(report.requests.length>0&&report.requests.every(item=>item.verified),'Every browser response must match its source manifest');
 unchangedStorage('final old-tab storage',solidStorage,await storage(oldPage));
 unchangedStorage('final current-tab storage',solidStorage,await storage(newPageCurrent));
 if(legacyPage)unchangedStorage('final original legacy-tab storage',solidStorage,await storage(legacyPage));
 assert.equal(report.requests.filter(item=>item.page==='old-tab'&&item.resourceType==='document').length,1);
 assert.equal(report.requests.filter(item=>item.page==='current-tab'&&item.resourceType==='document').length,1);
 for(const value of [previous,candidate])assert.equal(verifyPackage(value.base).manifestSha256,value.manifestSha256,'A package changed during the test');
 report.packagesUnchanged=true;report.allRequestedAssetRoutesHashVerified=true;report.allAssetSourceHeadersVerified=true;report.no404=true;report.boundsComparisonTolerance=1e-6;report.status='PASS';
}catch(error){
 report.status='FAIL';report.failedPhase=phase;report.error=error.stack||String(error);process.exitCode=1;
 if(outputAllowed&&currentPage&&!currentPage.isClosed())await screenshot(currentPage,'debug').catch(cause=>{report.debugScreenshotError=String(cause);});
 console.error('PACKAGE_BROWSER_UPGRADE_FAILED',phase,report.error);
}finally{
 recordNetwork=false;
 for(const [name,close] of [['test context',()=>context?.close()],['test browser',()=>browser?.close()]]){
  try{await close();}catch(error){report.cleanupErrors.push({target:name,error:String(error)});}
 }
 for(const value of [...ownedServers]){
  try{await stopServer(value);}catch(error){report.cleanupErrors.push({target:'owned server '+value.child.pid,error:String(error)});}
 }
 report.ownServersClosed=ownedServers.size===0;report.finishedUTC=new Date().toISOString();
 if(report.cleanupErrors.length||!report.ownServersClosed){report.status='FAIL';process.exitCode=1;}
 if(outputAllowed)writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,phase,origin,report:outputAllowed?reportFile:null,requests:report.requests.length,ownServersClosed:report.ownServersClosed,cleanupErrors:report.cleanupErrors},null,2));
}
