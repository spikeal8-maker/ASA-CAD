const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,s)=>i%2===0?[...a,[v,s[i+1]]]:a,[]));
const repo=path.resolve(args['--repo']),out=path.resolve(args['--out']);
const git=(...a)=>cp.execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
const expected=args['--expected-head'];
if(git('rev-parse','HEAD')!==expected||git('status','--porcelain'))throw Error('Expected clean checkout');
if(fs.existsSync(out))throw Error('Output exists');
const ts=require(path.join(repo,'vendor/toubkal/node_modules/typescript'));
const cfg=path.join(repo,'tsconfig.web.json'),config=ts.readConfigFile(cfg,ts.sys.readFile);
if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,' '));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,repo);
const fixtures=git('ls-files','tests/m2/*-ui-fixture.tsx').split(/\r?\n/).filter(Boolean);
const roots=[...new Set([...parsed.fileNames,...fixtures.map(p=>path.join(repo,p))])];
const start=Date.now(),program=ts.createProgram(roots,{...parsed.options,noEmit:true});
const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)].map(d=>({
file:d.file?path.relative(repo,d.file.fileName).replaceAll('\\','/'):null,code:d.code,
category:ts.DiagnosticCategory[d.category],message:ts.flattenDiagnosticMessageText(d.messageText,' '),
line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null
}));
const result={schemaVersion:1,head:expected,typescript:ts.version,config:'tsconfig.web.json',fixtures,rootCount:roots.length,
configSha256:crypto.createHash('sha256').update(fs.readFileSync(cfg)).digest('hex'),durationMs:Date.now()-start,
diagnostics,errorCount:diagnostics.filter(d=>d.category==='Error').length,
sourceUnchanged:git('rev-parse','HEAD')===expected&&!git('status','--porcelain')};
result.status=result.errorCount?'TYPE_ERRORS_PRESENT':'PASS';
result.command=[process.execPath,__filename,...process.argv.slice(2)];
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({head:expected,status:result.status,errorCount:result.errorCount,diagnostics,sourceUnchanged:result.sourceUnchanged}));
process.exitCode=!result.sourceUnchanged?3:result.errorCount?2:0;
