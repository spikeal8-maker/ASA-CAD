/* Local-only release server. Keep the same origin/port to retain browser-local saved documents. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const root=path.resolve(option('--root',path.join(__dirname,'../../../dist/fusion-live')));
const port=Number(option('--port','8094'));
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build not found: '+root);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');res.setHeader('X-ASA-CAD-Shell','fusion-live-v6');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/__asa_health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({product:'ASA-CAD-Fusion-Live',version:6,localOnly:true}));return;}
 let file=path.resolve(root,'.'+pathname);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){
  if(path.extname(pathname)&&path.extname(pathname)!=='.html'){res.writeHead(404);res.end();return;}
  file=path.join(root,'index.html');
 }
 res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);
 if(req.method==='HEAD'){res.end();return;}
 const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end();});stream.pipe(res);
});
function openBrowser(url){
 const platform=process.platform;let child;
 if(platform==='win32')child=cp.spawn('cmd.exe',['/d','/s','/c','start','""',url],{windowsHide:true,stdio:'ignore'});
 else child=cp.spawn(platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
 child.on('error',e=>console.error('Open this address in a browser: '+url+' ('+e.message+')'));child.unref();
}
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port '+port+' is already in use. Close the previous local server or choose --port.':e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url='http://127.0.0.1:'+port+'/';console.log('ASA CAD Fusion: '+url+'\nLocal-only. Stop: Ctrl+C.');if(args.includes('--open'))openBrowser(url);});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
