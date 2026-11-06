import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const folder=process.argv[2];
assert.ok(folder,'Usage: node live-package-smoke.mjs <package-directory>');
const base=resolve(folder);
const manifest=JSON.parse(readFileSync(join(base,'delivery-manifest.json'),'utf8'));
const root=resolve(import.meta.dirname,'../../..');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(manifest.version,8);
assert.equal(manifest.workspace,'fusion-sketch-v1');
assert.equal(manifest.launchPort,8099);
assert.equal(manifest.sourceHead,sha,'Package must be built from the exact checked-out commit');
assert.equal(manifest.localOnly,true);
assert.equal(manifest.fullFusionParity,false,'Do not claim unsupported native parity');
const win=readFileSync(join(base,'Start.cmd'),'utf8');
const unix=readFileSync(join(base,'start.sh'),'utf8');
assert.ok(win.includes('--port 8099 --open'),'Windows launcher must use the separate Sketch origin');
assert.ok(unix.includes('--port 8099 --open'),'Unix launcher must use the separate Sketch origin');
const serve=readFileSync(join(base,'serve.cjs'),'utf8');
assert.ok(serve.includes("server.listen(port,'127.0.0.1'"),'Package server must bind loopback only');
assert.ok(!win.includes('npm install')&&!unix.includes('npm install'),'Launch must not download dependencies');
const prefix='/__asa_builds/'+sha+'/';
assert.equal(manifest.assetRouting.prefix,prefix,'Entry assets must be immutable by source SHA');
const entry=readFileSync(join(base,'app/index.html'),'utf8');
const urls=[...entry.matchAll(/<(?:script|link)\b[^>]*>/gi)].flatMap(tag=>[...tag[0].matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi)].map(match=>match[2])).filter(url=>!url.startsWith('data:'));
assert.ok(urls.length>0,'Packaged entry has no script/style assets');
assert.ok(urls.every(url=>url.startsWith(prefix)),'Every packaged entry asset must use the versioned base URL');
const fileSet=new Set(manifest.files.map(e=>e.path));
assert.equal(fileSet.size,manifest.files.length,'Duplicate file paths in the hash manifest');
assert.ok(fileSet.has('app/index.html'),'Compiled app missing');
assert.ok([...fileSet].some(x=>x.endsWith('.wasm')),'WASM runtime absent');
assert.ok([...fileSet].some(x=>x.startsWith('licenses/')),'Licenses missing');
for(const item of manifest.files){
 assert.ok(!item.path.includes('\\')&&!item.path.includes(':')&&item.path.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe manifest path');
 const path=join(base,item.path),data=readFileSync(path);
 assert.equal(data.length,item.bytes,'Byte count changed: '+item.path);
 assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256,'Checksum changed: '+item.path);
}
const retained=manifest.assetRouting.compatibility;
assert.ok(Array.isArray(retained));
for(const item of retained){
 assert.match(item.sourceHead,/^[a-f0-9]{40}$/);
 assert.equal(item.root,'compatibility/'+item.sourceHead+'/app');
 assert.ok(fileSet.has(item.root+'/index.html'),'Retained app missing from the package hash manifest');
}
assert.ok([sha,...retained.map(item=>item.sourceHead)].includes(manifest.assetRouting.unversionedSourceHead));
if(manifest.assetRouting.previousSourceHead){
 const rollback=readFileSync(join(base,'Rollback.cmd'),'utf8');
 assert.ok(rollback.includes('--active-build '+manifest.assetRouting.previousSourceHead+' --port 8099 --open'));
 assert.ok(fileSet.has('rollback.sh'),'Portable rollback launcher missing');
}
const report={status:'PASS',version:8,sha,verifiedFiles:manifest.files.length,launchPort:8099,wasmBundled:true,licensesBundled:true,networkInstallRequired:false,versionedAssetPrefix:prefix,unversionedSourceHead:manifest.assetRouting.unversionedSourceHead,retainedSourceHeads:retained.map(item=>item.sourceHead)};
console.log(JSON.stringify(report,null,2));
// The existing exact-HEAD package gate also exercises a real old/new HTTP upgrade.
await import('./live-server-upgrade.mjs');
