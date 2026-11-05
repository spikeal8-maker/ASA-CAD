/* Check the candidate and unchanged original UI using identical compiler options. */
const path=require('node:path'),fs=require('node:fs'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.join(root,'vendor/toubkal/node_modules/typescript'));
const configPath=path.join(__dirname,'tsconfig.json');
const read=ts.readConfigFile(configPath,ts.sys.readFile);
if(read.error)throw Error(ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
const cfg=ts.parseJsonConfigFileContent(read.config,ts.sys,__dirname);
const candidate=ts.createProgram(cfg.fileNames,cfg.options);
const baseline=ts.createProgram([path.join(root,'src/web/index.tsx'),path.join(root,'src/types/opencascade-js.d.ts'),path.join(root,'src/types/assets.d.ts')],cfg.options);
const key=d=>`${d.file?path.relative(root,d.file.fileName).replaceAll('\\','/'):'config'}:${d.start}:${d.code}:${ts.flattenDiagnosticMessageText(d.messageText,' ')}`;
const known=ts.getPreEmitDiagnostics(baseline),current=ts.getPreEmitDiagnostics(candidate),set=new Set(known.map(key));
const introduced=current.filter(d=>!set.has(key(d)));
const productDiff=cp.execFileSync('git',['diff','HEAD','--','src','vendor/toubkal/src'],{cwd:root,encoding:'utf8'});
if(productDiff)throw Error('Original sources changed: baseline diagnostic comparison is invalid');
const report={status:introduced.length?'FAIL':'NO_NEW_DIAGNOSTICS',fullTypecheck:current.length?'BASELINE_ERRORS_REMAIN':'PASS',baselineDiagnosticCount:known.length,candidateDiagnosticCount:current.length,introduced:introduced.map(key),baseline:known.map(key)};
fs.writeFileSync(path.join(__dirname,'../evidence/fusion-live-typecheck.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exitCode=introduced.length?1:0;
