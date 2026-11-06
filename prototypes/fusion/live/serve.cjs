/* One loopback origin. Old tabs keep their immutable assets, including deferred WASM/runtime chunks. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing argument '+name);return args[i+1];};
const root=fs.realpathSync(path.resolve(option('--root',path.join(__dirname,'../../../dist/fusion-live'))));
const port=Number(option('--port','8099')),selectedHead=option('--active-build',null);
// Port 0 is a short-lived isolated test listener. Installed launchers always use 8099.
if(!Number.isInteger(port)||(port!==0&&port<1024)||port>65535)throw Error('Invalid local port');
if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build not found: '+root);
const packageRoot=path.dirname(root),manifestFile=path.join(packageRoot,'delivery-manifest.json');
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):null;
const shaPattern=/^[a-f0-9]{40}$/,prefix=sha=>'/__asa_builds/'+sha+'/';
const inside=(base,file)=>file===base||file.startsWith(base+path.sep);
const current={root,sourceHead:manifest?.sourceHead??null,version:manifest?.version??8,workspace:manifest?.workspace??'fusion-sketch-v1'};
if(manifest&&(!shaPattern.test(current.sourceHead)||manifest.product!=='ASA-CAD-Fusion-Live'))throw Error('Invalid delivery manifest');
const builds=new Map(current.sourceHead?[[current.sourceHead,current]]:[]);
const routing=manifest?.assetRouting;
if(routing){
 if(routing.prefix!==prefix(current.sourceHead)||!Array.isArray(routing.compatibility))throw Error('Invalid versioned asset routing');
 for(const item of routing.compatibility){
  if(!shaPattern.test(item.sourceHead)||builds.has(item.sourceHead)||item.root!=='compatibility/'+item.sourceHead+'/app')throw Error('Invalid retained build');
  const retainedRoot=fs.realpathSync(path.join(packageRoot,item.root));
  if(!inside(packageRoot,retainedRoot)||!fs.statSync(path.join(retainedRoot,'index.html')).isFile())throw Error('Retained app is outside the package or incomplete');
  builds.set(item.sourceHead,{root:retainedRoot,sourceHead:item.sourceHead,version:item.version,workspace:item.workspace});
 }
}
for(const build of [current,...builds.values()]){
 if(!Number.isInteger(build.version)||typeof build.workspace!=='string'||!/^[a-z0-9-]+$/.test(build.workspace))throw Error('Invalid build metadata');
}
const active=selectedHead?builds.get(selectedHead):current;
if(!active)throw Error('Requested build is not retained in this package: '+selectedHead);
const legacy=routing?builds.get(routing.unversionedSourceHead):current;
if(!legacy)throw Error('Unversioned asset owner is not retained in this package');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function findFile(build,pathname){
 const file=path.resolve(build.root,'.'+pathname);
 if(!inside(build.root,file))return {status:403};
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())return {status:404};
 if(!inside(build.root,fs.realpathSync(file)))return {status:403};
 return {file};
}
const server=http.createServer((req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');res.setHeader('X-ASA-CAD-Shell',active.workspace);
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');res.writeHead(405);res.end();return;}
 let pathname;
 try{
  if(!req.url.startsWith('/'))throw Error('An origin-relative path is required');
  pathname=decodeURIComponent(req.url.split(/[?#]/)[0]);
 }catch{res.writeHead(400);res.end();return;}
 if(pathname.includes('\0')){res.writeHead(400);res.end();return;}
 if(pathname.includes('\\')||pathname.split('/').some(part=>part==='.'||part==='..')){res.writeHead(403);res.end();return;}
 if(pathname==='/__asa_health'){
  const body=JSON.stringify({product:'ASA-CAD-Fusion-Live',version:active.version,localOnly:true,workspace:active.workspace,sourceHead:active.sourceHead,port:server.address().port,assetPrefix:active.sourceHead?prefix(active.sourceHead):null,unversionedSourceHead:legacy.sourceHead,retainedSourceHeads:[...builds.keys()].filter(sha=>sha!==active.sourceHead)});
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Length',Buffer.byteLength(body));res.end(req.method==='HEAD'?undefined:body);return;
 }
 let build=legacy,requestPath=pathname,versioned=false,entry=false;
 if(pathname.startsWith('/__asa_builds/')){
  const match=/^\/__asa_builds\/([a-f0-9]{40})\/(.*)$/.exec(pathname);
  build=match?builds.get(match[1]):null;
  if(!build){res.writeHead(404);res.end();return;}
  requestPath='/'+(match[2]||'index.html');versioned=true;
 }else if(!path.extname(pathname)||path.extname(pathname)==='.html'){
  // Only entry/navigation routes switch builds. Unversioned lazy asset names remain owned by v8.
  build=active;entry=true;
 }
 let found=findFile(build,requestPath);
 if(entry&&found.status===404)found=findFile(active,'/index.html');
 if(found.status){res.writeHead(found.status);res.end();return;}
 const file=found.file;
 if(versioned)res.setHeader('Cache-Control','public, max-age=31536000, immutable');
 if(build.sourceHead)res.setHeader('X-ASA-CAD-Asset-Source',build.sourceHead);
 res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);
 if(req.method==='HEAD'){res.end();return;}
 const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent){res.writeHead(500);res.end();}else res.destroy();});stream.pipe(res);
});
function openBrowser(url){
 const platform=process.platform;let child;
 if(platform==='win32')child=cp.spawn('cmd.exe',['/d','/s','/c','start','""',url],{windowsHide:true,stdio:'ignore'});
 else child=cp.spawn(platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
 child.on('error',e=>console.error('Open this address in a browser: '+url+' ('+e.message+')'));child.unref();
}
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port '+port+' is already in use. Stop the previous local server before switching builds.':e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url='http://127.0.0.1:'+server.address().port+'/';console.log('ASA CAD Fusion: '+url+'\nLocal-only. Stop: Ctrl+C.');if(args.includes('--open'))openBrowser(url);});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
