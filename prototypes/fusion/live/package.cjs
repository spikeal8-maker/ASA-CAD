/* Package the already-built candidate for offline use. No dependency installation or global changes. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),args=process.argv.slice(2);
const option=(k,d)=>{const i=args.indexOf(k);if(i<0)return d;if(!args[i+1])throw Error('Missing argument '+k);return args[i+1];};
const source=path.resolve(option('--source',path.join(repo,'dist/fusion-live')));
const output=path.resolve(option('--out',path.join(os.homedir(),'Downloads','ASA-CAD-Fusion-Live-v7')));
if(!fs.existsSync(path.join(source,'index.html')))throw Error('Build is missing. Run node prototypes/fusion/live/run.cjs first.');
if(fs.existsSync(output))throw Error('Refusing to overwrite existing package: '+output);
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
fs.mkdirSync(output,{recursive:true});fs.cpSync(source,path.join(output,'app'),{recursive:true,filter:p=>!p.endsWith('.map')});
fs.copyFileSync(path.join(__dirname,'serve.cjs'),path.join(output,'serve.cjs'));
fs.copyFileSync(path.join(__dirname,'README.md'),path.join(output,'README.md'));
const licenses=path.join(output,'licenses');fs.mkdirSync(licenses);
for(const name of ['react','react-dom','scheduler','three','opencascade.js','@salusoft89/planegcs']){
 const dir=path.join(repo,'vendor/toubkal/node_modules',name),safe=name.replaceAll('/','-').replace('@','');
 for(const f of fs.readdirSync(dir)){if(/^(license|notice|copying)/i.test(f)&&fs.statSync(path.join(dir,f)).isFile())fs.copyFileSync(path.join(dir,f),path.join(licenses,safe+'-'+f));}
}
for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(path.join(repo,'vendor/toubkal',f),path.join(licenses,'upstream-'+f));
const start=['@echo off','setlocal','cd /d "%~dp0"','where node.exe >nul 2>nul','if errorlevel 1 (','  echo Node.js 20 or newer is required. No network is needed after installation.','  pause','  exit /b 1',')','node.exe "%~dp0serve.cjs" --root "%~dp0app" --port 8094 --open','if errorlevel 1 pause'];
fs.writeFileSync(path.join(output,'Start.cmd'),start.join('\r\n')+'\r\n','utf8');
fs.writeFileSync(path.join(output,'start.sh'),'#!/bin/sh\nset -eu\ncd -- "$(dirname -- "$0")"\nexec node ./serve.cjs --root ./app --port 8094 --open\n','utf8');
const files=[];function inventory(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())inventory(p);else{const bytes=fs.readFileSync(p);files.push({path:path.relative(output,p).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}inventory(output);
const manifest={schemaVersion:1,product:'ASA-CAD-Fusion-Live',version:7,sourceHead:head,createdUTC:new Date().toISOString(),kernel:'existing ASA-CAD / OpenCascade / PlaneGCS',localOnly:true,fullFusionParity:false,files};
fs.writeFileSync(path.join(output,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,sourceHead:head,files:files.length,totalBytes:files.reduce((s,f)=>s+f.bytes,0)},null,2));
