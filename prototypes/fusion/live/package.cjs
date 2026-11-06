/* Offline package. Versioned assets keep an existing unsaved browser tab usable during an update. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),args=process.argv.slice(2);
const option=(key,fallback)=>{const i=args.indexOf(key);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing argument '+key);return args[i+1];};
const source=path.resolve(option('--source',path.join(repo,'dist/fusion-live')));
const output=path.resolve(option('--out',path.join(os.homedir(),'Downloads','ASA-CAD-Fusion-Sketch-v1')));
const previousPath=option('--previous-package',null);
const shaPattern=/^[a-f0-9]{40}$/,assetPrefix=sha=>'/__asa_builds/'+sha+'/';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function safeRelative(value){
 if(typeof value!=='string'||!value||value.includes('\\')||value.includes(':')||value.includes('\0')||value.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe package path: '+value);
 return value;
}
function inside(base,file){return file===base||file.startsWith(base+path.sep);}
function verifyPrevious(folder){
 const base=fs.realpathSync(path.resolve(folder)),raw=fs.readFileSync(path.join(base,'delivery-manifest.json'));
 const manifest=JSON.parse(raw);
 if(manifest.product!=='ASA-CAD-Fusion-Live'||manifest.launchPort!==8099||!shaPattern.test(manifest.sourceHead)||!Array.isArray(manifest.files))throw Error('Previous package is not a verified Sketch package for port 8099');
 const seen=new Set();
 for(const item of manifest.files){
  const name=safeRelative(item.path),file=path.join(base,name);
  if(seen.has(name))throw Error('Duplicate previous manifest path: '+name);seen.add(name);
  if(!inside(base,fs.realpathSync(file))||!fs.lstatSync(file).isFile())throw Error('Previous package file is not a regular contained file: '+name);
  const bytes=fs.readFileSync(file);
  if(bytes.length!==item.bytes||digest(bytes)!==item.sha256)throw Error('Previous package checksum changed: '+name);
 }
 if(!seen.has('app/index.html'))throw Error('Previous package has no app/index.html');
 return {base,manifest,manifestSha256:digest(raw)};
}
function copyVerifiedApp(previous,from,to){
 const prefix=safeRelative(from)+'/';
 const entries=previous.manifest.files.filter(item=>item.path.startsWith(prefix));
 if(!entries.some(item=>item.path===prefix+'index.html'))throw Error('Previous app is missing its hashed index: '+from);
 for(const item of entries){
  const destination=path.join(to,item.path.slice(prefix.length));
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(previous.base,item.path),destination);
 }
}
function copyBuild(from,to){
 fs.mkdirSync(to,{recursive:true});
 for(const entry of fs.readdirSync(from,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Build contains a symbolic link: '+entry.name);
  if(entry.name.endsWith('.map'))continue;
  const input=path.join(from,entry.name),destination=path.join(to,entry.name);
  if(entry.isDirectory())copyBuild(input,destination);
  else if(entry.isFile())fs.copyFileSync(input,destination);
  else throw Error('Build contains a non-regular entry: '+entry.name);
 }
}
function versionEntry(html,head){
 return html.replace(/<(?:script|link)\b[^>]*>/gi,tag=>tag.replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi,(all,key,quote,url)=>{
  if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))return all;
  if(url.startsWith('/__asa_builds/'))throw Error('Use a fresh build, not an already versioned package as --source');
  const relative=url.replace(/^\.?\//,''),fileName=decodeURIComponent(relative.split(/[?#]/)[0]);
  safeRelative(fileName);
  if(!fs.statSync(path.join(source,fileName)).isFile())throw Error('Entry asset is not a file: '+url);
  return key+'='+quote+assetPrefix(head)+relative+quote;
 }));
}
if(!fs.existsSync(path.join(source,'index.html')))throw Error('Build is missing. Run node prototypes/fusion/live/run.cjs first.');
if(fs.existsSync(output))throw Error('Refusing to overwrite existing package: '+output);
if(inside(source,output))throw Error('Package output must be outside the build directory');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
if(!shaPattern.test(head))throw Error('Expected a full Git SHA');
const html=versionEntry(fs.readFileSync(path.join(source,'index.html'),'utf8'),head);
const previous=previousPath?verifyPrevious(previousPath):null;
const compatibility=[];
if(previous){
 const previousManifest=previous.manifest,routing=previousManifest.assetRouting;
 const candidates=[{sourceHead:previousManifest.sourceHead,version:previousManifest.version,workspace:previousManifest.workspace,from:'app'}];
 if(routing){
  if(routing.prefix!==assetPrefix(previousManifest.sourceHead)||!Array.isArray(routing.compatibility))throw Error('Invalid previous asset routing');
  for(const item of routing.compatibility)candidates.push({...item,from:item.root});
 }
 const seen=new Set([head]);
 for(const item of candidates){
  if(!shaPattern.test(item.sourceHead)||seen.has(item.sourceHead))throw Error('An immutable asset SHA cannot be reused: '+item.sourceHead);
  if(item.from!=='app'&&item.from!=='compatibility/'+item.sourceHead+'/app')throw Error('Invalid previous compatibility root');
  if(!Number.isInteger(item.version)||typeof item.workspace!=='string')throw Error('Invalid previous build metadata');
  seen.add(item.sourceHead);
  compatibility.push({sourceHead:item.sourceHead,version:item.version,workspace:item.workspace,root:'compatibility/'+item.sourceHead+'/app',from:item.from});
 }
 const legacy=routing?.unversionedSourceHead??previousManifest.sourceHead;
 if(!compatibility.some(item=>item.sourceHead===legacy))throw Error('Previous unversioned asset owner is missing');
}
const assetRouting={prefix:assetPrefix(head),unversionedSourceHead:previous?.manifest.assetRouting?.unversionedSourceHead??previous?.manifest.sourceHead??head,previousSourceHead:previous?.manifest.sourceHead??null,compatibility:compatibility.map(({from,...item})=>item)};
fs.mkdirSync(output,{recursive:true});copyBuild(source,path.join(output,'app'));
fs.writeFileSync(path.join(output,'app/index.html'),html,'utf8');
for(const item of compatibility)copyVerifiedApp(previous,item.from,path.join(output,item.root));
fs.copyFileSync(path.join(__dirname,'serve.cjs'),path.join(output,'serve.cjs'));
fs.copyFileSync(path.join(__dirname,'README.md'),path.join(output,'README.md'));
const licenses=path.join(output,'licenses');fs.mkdirSync(licenses);
for(const name of ['react','react-dom','scheduler','three','opencascade.js','@salusoft89/planegcs']){
 const dir=path.join(repo,'vendor/toubkal/node_modules',name),safe=name.replaceAll('/','-').replace('@','');
 for(const file of fs.readdirSync(dir))if(/^(license|notice|copying)/i.test(file)&&fs.statSync(path.join(dir,file)).isFile())fs.copyFileSync(path.join(dir,file),path.join(licenses,safe+'-'+file));
}
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(path.join(repo,'vendor/toubkal',file),path.join(licenses,'upstream-'+file));
function launcher(name,activeHead){
 const select=activeHead?' --active-build '+activeHead:'';
 const start=['@echo off','setlocal','cd /d "%~dp0"','where node.exe >nul 2>nul','if errorlevel 1 (','  echo Node.js 20 or newer is required. No network is needed after installation.','  pause','  exit /b 1',')','node.exe "%~dp0serve.cjs" --root "%~dp0app"'+select+' --port 8099 --open','if errorlevel 1 pause'];
 fs.writeFileSync(path.join(output,name+'.cmd'),start.join('\r\n')+'\r\n','utf8');
 fs.writeFileSync(path.join(output,name.toLowerCase()+'.sh'),'#!/bin/sh\nset -eu\ncd -- "$(dirname -- "$0")"\nexec node ./serve.cjs --root ./app'+select+' --port 8099 --open\n','utf8');
}
launcher('Start',null);if(previous)launcher('Rollback',previous.manifest.sourceHead);
const files=[];
function inventory(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())inventory(file);
  else{const bytes=fs.readFileSync(file);files.push({path:path.relative(output,file).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)});}
 }
}
inventory(output);
const manifest={schemaVersion:1,product:'ASA-CAD-Fusion-Live',version:8,workspace:'fusion-sketch-v1',launchPort:8099,sourceHead:head,createdUTC:new Date().toISOString(),kernel:'existing ASA-CAD / OpenCascade / PlaneGCS',localOnly:true,fullFusionParity:false,assetRouting,previousManifestSha256:previous?.manifestSha256??null,files};
fs.writeFileSync(path.join(output,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,sourceHead:head,assetPrefix:assetRouting.prefix,unversionedSourceHead:assetRouting.unversionedSourceHead,retainedSourceHeads:compatibility.map(item=>item.sourceHead),files:files.length,totalBytes:files.reduce((sum,file)=>sum+file.bytes,0)},null,2));
