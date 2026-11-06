import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,relative,dirname} from 'node:path';

// Small transport fixtures deliberately contain no CAD model or browser storage.
const repo=resolve(import.meta.dirname,'../../..'),temporary=mkdtempSync(join(tmpdir(),'asa-fusion-upgrade-'));
const packageScript=join(repo,'prototypes/fusion/live/package.cjs');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const legacySha='1'.repeat(40),priorSha='2'.repeat(40);
const prefix=head=>'/__asa_builds/'+head+'/';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[];
function put(file,contents){mkdirSync(dirname(file),{recursive:true});writeFileSync(file,contents);}
function appFixture(folder,label,assetBase=''){
 put(join(folder,'index.html'),'<!doctype html><html><head><base href="/"><link rel="icon" href="data:,"><link rel="stylesheet" href="'+assetBase+'main.css"></head><body><script src="'+assetBase+'main.js"></script></body></html>');
 put(join(folder,'main.js'),'// '+label+' entry; lazy URL is relative to this script\nexport const lazy = new URL("lazy.js", import.meta.url);\n');
 put(join(folder,'main.css'),'/* '+label+' css */');
 put(join(folder,'lazy.js'),'export const build = "'+label+' lazy";\n');
 put(join(folder,'wasm/kernel.wasm'),Buffer.from(label+' wasm'));
 put(join(folder,label+'-only.js'),'// '+label+' only');
}
function inventory(base){
 const files=[];
 function walk(folder){
  for(const entry of readdirSync(folder,{withFileTypes:true})){
   const file=join(folder,entry.name);
   if(entry.isDirectory())walk(file);
   else if(entry.name!=='delivery-manifest.json'){
    const bytes=readFileSync(file);
    files.push({path:relative(base,file).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)});
   }
  }
 }
 walk(base);return files;
}
function previousFixture(folder,head,label,retained=false){
 appFixture(join(folder,'app'),label,retained?prefix(head):'');
 const compatibility=retained?[{sourceHead:legacySha,version:8,workspace:'fusion-sketch-v1',root:'compatibility/'+legacySha+'/app'}]:[];
 if(retained)appFixture(join(folder,compatibility[0].root),'legacy');
 const manifest={schemaVersion:1,product:'ASA-CAD-Fusion-Live',version:8,workspace:'fusion-sketch-v1',sourceHead:head,launchPort:8099,files:inventory(folder)};
 if(retained)manifest.assetRouting={prefix:prefix(head),unversionedSourceHead:legacySha,previousSourceHead:legacySha,compatibility};
 put(join(folder,'delivery-manifest.json'),JSON.stringify(manifest));
}
function packageFixture(source,out,previous){
 const args=[packageScript,'--source',source,'--out',out];
 if(previous)args.push('--previous-package',previous);
 execFileSync(process.execPath,args,{cwd:repo,stdio:'pipe'});
 return JSON.parse(readFileSync(join(out,'delivery-manifest.json'),'utf8'));
}
async function startServer(folder,activeBuild){
 const args=[join(folder,'serve.cjs'),'--root',join(folder,'app'),'--port','0'];
 if(activeBuild)args.push('--active-build',activeBuild);
 const child=spawn(process.execPath,args,{cwd:folder,stdio:['ignore','pipe','pipe']});
 let output='';
 return await new Promise((resolveServer,reject)=>{
  const timeout=setTimeout(()=>{child.kill();reject(Error('Server did not start: '+output));},8000);
  const failed=()=>{clearTimeout(timeout);reject(Error('Server exited before listening: '+output));};
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('exit',failed);
  child.stderr.on('data',bytes=>{output+=bytes.toString();});
  child.stdout.on('data',bytes=>{
   output+=bytes.toString();
   const match=/http:\/\/127\.0\.0\.1:(\d+)\//.exec(output);
   if(!match)return;
   clearTimeout(timeout);child.removeListener('exit',failed);
   resolveServer({child,port:Number(match[1])});
  });
 });
}
async function stopServer(server){
 if(server.child.exitCode!==null)return;
 await new Promise(resolveStop=>{
  const timeout=setTimeout(()=>server.child.kill('SIGKILL'),3000);
  server.child.once('exit',()=>{clearTimeout(timeout);resolveStop();});
  server.child.kill('SIGTERM');
 });
}
function get(server,path,method='GET'){
 return new Promise((resolveResponse,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port:server.port,path,method},res=>{
   const chunks=[];
   res.on('data',chunk=>chunks.push(chunk));
   res.on('end',()=>resolveResponse({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
  });
  req.on('error',reject);req.setTimeout(5000,()=>req.destroy(Error('HTTP timeout')));req.end();
 });
}
async function withServer(folder,active,run){
 const server=await startServer(folder,active);
 try{await run(server);}finally{await stopServer(server);}
}
try{
 const source=join(temporary,'source');appFixture(source,'current');
 const previous=join(temporary,'legacy');previousFixture(previous,legacySha,'legacy');
 const fresh=join(temporary,'fresh'),freshManifest=packageFixture(source,fresh);
 assert.equal(freshManifest.sourceHead,sha);assert.equal(freshManifest.assetRouting.unversionedSourceHead,sha);
 await withServer(fresh,null,async server=>{
  const entry=await get(server,'/');assert.equal(entry.status,200);assert.ok(entry.body.includes(prefix(sha)+'main.js'));
  const lazy=await get(server,prefix(sha)+'lazy.js');assert.equal(lazy.body,'export const build = "current lazy";\n');
  assert.match(lazy.headers['cache-control'],/immutable/);
  const health=JSON.parse((await get(server,'/__asa_health')).body);
  assert.equal(health.sourceHead,sha);assert.equal(health.port,server.port);assert.equal(health.version,8);
 });
 checks.push('fresh package: versioned entry, lazy route and exact health');
 const upgrade=join(temporary,'upgrade'),manifest=packageFixture(source,upgrade,previous);
 assert.equal(manifest.assetRouting.unversionedSourceHead,legacySha);
 assert.equal(manifest.previousManifestSha256,digest(readFileSync(join(previous,'delivery-manifest.json'))));
 const originalLazy=readFileSync(join(previous,'app/lazy.js'));
 const retainedLazy=readFileSync(join(upgrade,'compatibility',legacySha,'app/lazy.js'));
 assert.deepEqual(retainedLazy,originalLazy);
 assert.ok(manifest.files.some(file=>file.path==='compatibility/'+legacySha+'/app/lazy.js'&&file.sha256===digest(originalLazy)));
 await withServer(upgrade,null,async server=>{
  const entry=await get(server,'/');assert.ok(entry.body.includes(prefix(sha)+'main.js'));
  assert.equal((await get(server,'/lazy.js')).body,'export const build = "legacy lazy";\n');
  assert.equal((await get(server,prefix(sha)+'lazy.js')).body,'export const build = "current lazy";\n');
  assert.equal((await get(server,prefix(legacySha)+'lazy.js')).body,'export const build = "legacy lazy";\n');
  assert.equal((await get(server,'/wasm/kernel.wasm')).body,'legacy wasm');
  assert.equal((await get(server,prefix(sha)+'wasm/kernel.wasm')).body,'current wasm');
  assert.equal((await get(server,'/current-only.js')).status,404,'Old lazy URLs must not fall through to a new asset');
  assert.equal((await get(server,prefix(sha)+'legacy-only.js')).status,404,'New lazy URLs must not fall through to an old asset');
  const head=await get(server,prefix(sha)+'lazy.js','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
  assert.equal(head.headers['cross-origin-opener-policy'],'same-origin');
  assert.equal(head.headers['cross-origin-embedder-policy'],'require-corp');
  assert.equal((await get(server,'/__asa_health','POST')).status,405);
  for(const url of ['/%2e%2e/delivery-manifest.json',prefix(sha)+'%2e%2e/%2e%2e/delivery-manifest.json','/%5c..%5cdelivery-manifest.json',prefix(sha)+'../main.js']){
   assert.equal((await get(server,url)).status,403,'Traversal must be rejected: '+url);
  }
  assert.equal((await get(server,'/%zz')).status,400);
  assert.equal((await get(server,prefix('f'.repeat(40))+'main.js')).status,404);
  const health=JSON.parse((await get(server,'/__asa_health')).body);
  assert.equal(health.sourceHead,sha);assert.equal(health.unversionedSourceHead,legacySha);
  assert.deepEqual(health.retainedSourceHeads,[legacySha]);
 });
 checks.push('upgrade: old/new colliding lazy and WASM routes, hash retention, no cross-build fallback');
 checks.push('HTTP: HEAD, isolation headers, malformed paths, traversal, unknown SHA and method rejection');
 await withServer(upgrade,legacySha,async server=>{
  assert.ok(!(await get(server,'/')).body.includes(prefix(sha)));
  const health=JSON.parse((await get(server,'/__asa_health')).body);assert.equal(health.sourceHead,legacySha);
  assert.equal((await get(server,prefix(sha)+'lazy.js')).body,'export const build = "current lazy";\n','Rollback must keep already-open newer tabs supplied');
  assert.equal((await get(server,'/lazy.js')).body,'export const build = "legacy lazy";\n');
 });
 assert.ok(readFileSync(join(upgrade,'Rollback.cmd'),'utf8').includes('--active-build '+legacySha+' --port 8099 --open'));
 checks.push('rollback: previous entry/health with both versions still served on the same listener');
 const prior=join(temporary,'prior');previousFixture(prior,priorSha,'prior',true);
 const next=join(temporary,'next'),nextManifest=packageFixture(source,next,prior);
 assert.equal(nextManifest.assetRouting.unversionedSourceHead,legacySha);
 await withServer(next,null,async server=>{
  assert.equal((await get(server,'/lazy.js')).body,'export const build = "legacy lazy";\n');
  assert.equal((await get(server,prefix(priorSha)+'lazy.js')).body,'export const build = "prior lazy";\n');
  assert.equal((await get(server,prefix(sha)+'lazy.js')).body,'export const build = "current lazy";\n');
 });
 checks.push('successive update retains the original unversioned owner and prior versioned assets');
 put(join(previous,'app/lazy.js'),'tampered');
 const failedOut=join(temporary,'must-not-exist');
 const rejected=spawnSync(process.execPath,[packageScript,'--source',source,'--out',failedOut,'--previous-package',previous],{cwd:repo,encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/checksum changed/);assert.equal(existsSync(failedOut),false);
 const reused=spawnSync(process.execPath,[packageScript,'--source',source,'--out',failedOut,'--previous-package',fresh],{cwd:repo,encoding:'utf8'});
 assert.notEqual(reused.status,0);assert.match(reused.stderr,/immutable asset SHA cannot be reused/);assert.equal(existsSync(failedOut),false);
 checks.push('packaging refuses altered previous assets and reuse of an immutable SHA before creating output');
 console.log(JSON.stringify({status:'PASS',scope:'Offline package and HTTP upgrade transport; no CAD model or user browser storage touched',checks},null,2));
}finally{
 rmSync(temporary,{recursive:true,force:true});
}
