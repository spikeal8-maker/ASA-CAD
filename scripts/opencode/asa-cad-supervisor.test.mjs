import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chooseAction, readTaskMetadata, extractHandoff, withLock, snapshot, taskGuard,
  coordinatorMatches, independentReviewVerified, collection, inspectLock, observeIdleSessions } from './asa-cad-supervisor.mjs';

const ready = { enabled:true, manualStop:false, active:false, pending:false, guard:true,
  issueStatus:'IN_PROGRESS', handoff:null, taskId:'R01', issue:239, candidate:'b'.repeat(40),
  baseSha:'a'.repeat(40), dispatchKey:'R01:3:' + 'a'.repeat(40), contractVersion:3, dispatchAt:100,
  attempts:0, idleMs:100000, idleDelayMs:90000 };
const currentHandoff = { task:'R01', issue:239, candidate:ready.candidate, baseSha:ready.baseSha,
  dispatchKey:ready.dispatchKey, contractVersion:3, messageCreatedAt:200,
  workerSessionId:'worker', reviewerSessionId:'reviewer', reviewVerdict:'APPROVE', status:'WAIT_CONTROLLER' };

test('only idle assigned work resumes; busy model and pending permission are preserved', () => {
  assert.equal(chooseAction(ready), 'RESUME');
  assert.equal(chooseAction({...ready, active:true}), 'RUNNING');
  assert.equal(chooseAction({...ready, pending:true}), 'WAIT_PERMISSION_OR_INBOX');
  assert.equal(chooseAction({...ready, idleMs:1000}), 'IDLE_GRACE');
});
test('manual stop, moved base, BLOCKED and no progress never cause blind continuation', () => {
  assert.equal(chooseAction({...ready, manualStop:true}), 'PAUSED');
  assert.equal(chooseAction({...ready, guard:false}), 'BLOCKED_GUARD');
  assert.equal(chooseAction({...ready, issueStatus:'BLOCKED'}), 'WAIT_CONTROLLER');
  assert.equal(chooseAction({...ready, issueStatus:'ACCEPTED'}), 'WAIT_CONTROLLER');
  assert.equal(chooseAction({...ready, attempts:2}), 'WAIT_CONTROLLER_NO_PROGRESS');
});
test('REVIEW requires a separate current reviewer; a stale handoff cannot end a new candidate', () => {
  assert.equal(chooseAction({...ready, issueStatus:'REVIEW'}), 'RESUME');
  assert.equal(chooseAction({...ready, handoff:currentHandoff, reviewVerified:true}), 'WAIT_CONTROLLER');
  assert.equal(chooseAction({...ready, handoff:currentHandoff}), 'WAIT_CONTROLLER_REVIEW_PROVENANCE');
  assert.equal(chooseAction({...ready, handoff:currentHandoff, candidate:'c'.repeat(40)}), 'RESUME');
  assert.equal(chooseAction({...ready, handoff:currentHandoff, taskId:'R02'}), 'RESUME');
});
test('new dispatch cannot inherit an old same-task review or BLOCKED handoff', () => {
  for (const patch of [{ dispatchKey:'R01:2:old' }, { contractVersion:2 }, { baseSha:'old' },
    { messageCreatedAt:99 }, { messageCreatedAt:null }, { issue:240 }, { task:'R02' }]) {
    for (const status of ['WAIT_CONTROLLER', 'BLOCKED']) {
      assert.equal(chooseAction({...ready, issueStatus:'READY', reviewVerified:true,
        handoff:{...currentHandoff, status, ...patch}}), 'RESUME');
    }
  }
  assert.equal(chooseAction({...ready, handoff:{...currentHandoff, status:'BLOCKED'}}), 'WAIT_CONTROLLER');
});
test('issue metadata and terminal handoff must be explicit structured records', () => {
  assert.equal(readTaskMetadata('<!-- asa-fusion-task: {"id":"R01","status":"READY"} -->').id,'R01');
  assert.throws(()=>readTaskMetadata('READY somewhere in a historical report'));
  assert.equal(extractHandoff([{text:'I think APPROVE'}]),null);
  assert.equal(extractHandoff([{text:'ASA_HANDOFF {"status":"WAIT_CONTROLLER"}'}]).status,'WAIT_CONTROLLER');
  assert.equal(extractHandoff([{type:'assistant',content:[{type:'reasoning',text:'private'},
    {type:'text',text:'ASA_HANDOFF {"status":"WAIT_CONTROLLER"}'}]}]).status,'WAIT_CONTROLLER');
});
test('handoff freshness comes from API message time, never model JSON', () => {
  const msg = {id:'message', time:{created:90}, content:[{type:'text',text:'ASA_HANDOFF ' + JSON.stringify(currentHandoff)}]};
  assert.equal(extractHandoff([msg],ready),null);
  const fresh = {...msg,time:{created:201}};
  assert.equal(extractHandoff([fresh],ready).messageCreatedAt,201);
  assert.equal(extractHandoff([fresh,{...msg,time:{created:202},content:[{type:'text',
    text:'ASA_HANDOFF ' + JSON.stringify({...currentHandoff,task:'R02'})}]}],ready).messageId,'message');
});
test('review requires actual distinct children, exact roles, successful outcomes and a matching reviewer reply', () => {
  const parent={id:'parent'}, children=[
    {id:'worker',parentID:'parent',agent:'asa-cad-worker',outcome:'succeeded',time:{created:110}},
    {id:'reviewer',parentID:'parent',agent:'asa-cad-reviewer',outcome:'succeeded',time:{created:120}},
  ];
  const replies=[{time:{created:150},content:[{type:'text',text:`VERDICT: APPROVE\nR01 #239 ${ready.baseSha} ${ready.candidate}`}]}];
  const verify=(h=currentHandoff,c=children,r=replies)=>independentReviewVerified(h,parent,c,100,r);
  assert.equal(verify(),true);
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`VERDICT: **APPROVE**\n${ready.baseSha} ${ready.candidate}`}]),true);
  for (const verdict of ['APPROVE','REQUEST_CHANGES','BLOCKED']) {
    assert.equal(verify({...currentHandoff,reviewVerdict:verdict},children,
      [{time:{created:150},text:`## VERDICT: **${verdict}**\n${ready.baseSha} ${ready.candidate}`}]),true);
  }
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`## VERDICT: APPROVE\n${ready.baseSha} old-head`}]),false);
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`> ## VERDICT: APPROVE\n${ready.baseSha} ${ready.candidate}`}]),false);
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`Quoted source:\n## VERDICT: APPROVE\n${ready.baseSha} ${ready.candidate}`}]),false);
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`Quoted source: VERDICT: APPROVE\n${ready.baseSha} ${ready.candidate}`}]),false);
  assert.equal(verify({...currentHandoff,reviewerSessionId:'worker'}),false);
  assert.equal(verify({...currentHandoff,workerSessionId:'parent'}),false);
  assert.equal(verify({...currentHandoff,reviewVerdict:'REQUEST_CHANGES'}),false);
  for (const patch of [{parentID:'another-parent'},{agent:'asa-cad-worker'},{outcome:'failed'},
    {outcome:null},{time:{created:99}},{id:'different-reviewer'}]) {
    assert.equal(verify(currentHandoff,[children[0],{...children[1],...patch}]),false);
  }
  assert.equal(verify(currentHandoff,children,[{time:{created:150},text:`VERDICT: APPROVE\n${ready.baseSha} old-head`}]),false);
  assert.equal(verify(currentHandoff,children,[]),false);
});
test('API recovery checks coordinator identity, agent and Windows location; collection errors fail closed', () => {
  const config={repositoryPath:'C:\\Work\\ASA-CAD'}, parent={id:'parent',agent:'asa-cad-coordinator',location:{directory:'c:/work/asa-cad/'}};
  assert.equal(coordinatorMatches(parent,config,'parent'),true);
  assert.equal(coordinatorMatches({...parent,agent:'asa-cad-worker'},config,'parent'),false);
  assert.equal(coordinatorMatches({...parent,location:{directory:'C:\\Other'}},config,'parent'),false);
  assert.equal(coordinatorMatches(parent,config,'different'),false);
  assert.deepEqual(collection({data:{data:[{id:'child'}],cursor:{}}}),[{id:'child'}]);
  assert.deepEqual(collection({data:[]}),[]);
  assert.throws(()=>collection({error:'permission endpoint unavailable'}),/cannot be assumed empty/);
});

function idleServerFixture({ jobs, permission = [], candidate = 'c'.repeat(40) } = {}) {
  const parent = { id:'parent' }, children = [
    { id:'worker', parentID:'parent', agent:'asa-cad-worker', outcome:'succeeded', time:{created:110} },
    { id:'reviewer', parentID:'parent', agent:'asa-cad-reviewer', outcome:'succeeded', time:{created:120} },
  ];
  const server = { kind:'shell', id:'static-server', sessionID:'worker', status:'running',
    title:'node a05-static-18190.cjs', time:{started:130} };
  const handoffMessage = { id:'latest-handoff', time:{created:200}, content:[
    { type:'text', text:'ASA_HANDOFF ' + JSON.stringify(currentHandoff) },
  ] };
  const responses = new Map([
    ['/api/experimental/job?sessionID=parent&descendants=true&status=running', jobs ?? [server]],
    ['/api/session/parent/message?order=desc&limit=30&type=assistant', [handoffMessage]],
    ['/api/session/reviewer/message?order=desc&limit=10&type=assistant', [{time:{created:150},
      text:`VERDICT: APPROVE\n${ready.baseSha} ${ready.candidate}`}]],
  ]);
  for (const session of [parent,...children]) {
    for (const endpoint of ['permission','form','inbox']) responses.set(`/api/session/${session.id}/${endpoint}`, []);
  }
  responses.set('/api/session/worker/permission', permission);
  const calls = [];
  const observe = () => observeIdleSessions({parent,children,dispatch:ready,head:candidate,clean:true}, route => {
    calls.push(route);
    assert.ok(responses.has(route), `Unexpected API route ${route}`);
    return {data:responses.get(route)};
  });
  return {observe,calls,responses};
}

test('idle native worker with a static server refreshes handoff without calling it model progress', () => {
  const fixture = idleServerFixture(), observed = fixture.observe();
  assert.deepEqual(observed.runningJobs,['static-server']);
  assert.equal(observed.handoff.messageId,'latest-handoff');
  assert.equal(observed.handoff.candidate,ready.candidate);
  assert.equal(observed.reviewVerified,false); // Current checkout has moved; old APPROVE is not reused.
  assert.ok(fixture.calls.includes('/api/session/parent/message?order=desc&limit=30&type=assistant'));
  assert.ok(!fixture.calls.includes('/api/session/reviewer/message?order=desc&limit=10&type=assistant'));
  assert.equal(chooseAction({...ready,...observed,candidate:'c'.repeat(40)}),'WAIT_BACKGROUND_JOB');
  assert.equal(chooseAction({...ready,...observed,candidate:'c'.repeat(40),active:true}),'RUNNING');
});

test('permissions and controller/manual guards take precedence over background jobs', () => {
  const observed = idleServerFixture({permission:[{id:'pending-permission'}]}).observe();
  assert.equal(observed.pending,true);
  assert.equal(chooseAction({...ready,...observed}),'WAIT_PERMISSION_OR_INBOX');
  assert.equal(chooseAction({...ready,...observed,manualStop:true}),'PAUSED');
  assert.equal(chooseAction({...ready,...observed,guard:false}),'BLOCKED_GUARD');
  assert.equal(chooseAction({...ready,...observed,pending:false,issueStatus:'BLOCKED'}),'WAIT_CONTROLLER');
});

test('a current independently verified handoff is observed even while a support server remains', () => {
  const fixture = idleServerFixture({candidate:ready.candidate}), observed = fixture.observe();
  assert.equal(observed.reviewVerified,true);
  assert.equal(chooseAction({...ready,...observed}),'WAIT_CONTROLLER');
  assert.ok(fixture.calls.includes('/api/session/reviewer/message?order=desc&limit=10&type=assistant'));
});

test('completed jobs clear the observation and unknown job collections never permit resume', () => {
  const fixture = idleServerFixture(), state = fixture.observe();
  fixture.responses.set('/api/experimental/job?sessionID=parent&descendants=true&status=running', []);
  Object.assign(state,fixture.observe());
  assert.deepEqual(state.runningJobs,[]);
  assert.equal(chooseAction({...ready,...state,candidate:'c'.repeat(40)}),'RESUME');
  fixture.responses.set('/api/experimental/job?sessionID=parent&descendants=true&status=running', {error:'unavailable'});
  assert.throws(fixture.observe,/cannot be assumed empty/);
});

function gitFixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asa-supervisor-git-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'repo'), evidence=path.join(root,'evidence'); fs.mkdirSync(repo);
  const git=(...args)=>execFileSync('git',['-c','user.name=ASA supervisor test','-c','user.email=supervisor@example.invalid',
    '-c','core.autocrlf=false',...args],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(name,text)=>fs.writeFileSync(path.join(repo,name),text);
  git('init','-q','-b','work'); write('allowed.txt','initial\n'); write('old-owner.txt','owner data\n');
  git('add','.'); git('commit','-qm','baseline'); const base=git('rev-parse','HEAD');
  const task={id:'R01',issue:239,contractVersion:3,baseSha:base,workBranch:'work',canonicalBranch:'integration',
    canonicalSha:base,assignment:'Qwen-27B-single-worker',allowedFiles:['allowed.txt','new path.txt']};
  const config={repositoryPath:repo,task};
  const take=()=>snapshot(config,evidence,100);
  return {root,repo,git,write,base,task,config,take};
}
test('rename scope includes deleted old owner and new path, with honest before/after snapshots', t => {
  const f=gitFixture(t);
  fs.renameSync(path.join(f.repo,'old-owner.txt'),path.join(f.repo,'new path.txt'));
  f.git('add','-A'); f.git('commit','-qm','rename outside owner');
  const s=f.take();
  assert.equal(s.scopePass,false);
  assert.deepEqual(s.packet.changedFiles.sort(),['new path.txt','old-owner.txt']);
  const old=s.packet.files.find(x=>x.path==='old-owner.txt'), added=s.packet.files.find(x=>x.path==='new path.txt');
  assert.equal(old.after,null); assert.equal(added.before,null);
  assert.equal(fs.readFileSync(old.before.file,'utf8'),'owner data\n');
  assert.equal(fs.readFileSync(added.after.file,'utf8'),'owner data\n');
  assert.match(s.packet.patch,/deleted file mode/); assert.match(s.packet.patch,/new file mode/);
});
test('staged-new, staged-tracked and untracked content changes are all progress with unchanged status', t => {
  const f=gitFixture(t);
  f.write('new path.txt','first\n'); let a=f.take();
  f.write('new path.txt','second\n'); let b=f.take();
  assert.equal(a.status,b.status); assert.notEqual(a.fingerprint,b.fingerprint);
  f.git('add','new path.txt'); a=f.take();
  f.write('new path.txt','third\n'); f.git('add','new path.txt'); b=f.take();
  assert.equal(a.status,b.status); assert.notEqual(a.fingerprint,b.fingerprint);
  f.write('allowed.txt','tracked first\n'); f.git('add','allowed.txt'); a=f.take();
  f.write('allowed.txt','tracked second\n'); f.git('add','allowed.txt'); b=f.take();
  assert.equal(a.status,b.status); assert.notEqual(a.fingerprint,b.fingerprint);
});
test('an index-only outside-owner edit cannot hide behind a compensating working-tree edit', t => {
  const f=gitFixture(t);
  f.write('old-owner.txt','index first\n'); f.git('add','old-owner.txt');
  f.write('old-owner.txt','owner data\n'); const a=f.take();
  assert.equal(f.git('diff','HEAD'), '');
  assert.match(a.status,/MM old-owner\.txt/); assert.equal(a.scopePass,false);
  assert.ok(a.packet.pendingPaths.includes('old-owner.txt'));
  f.write('old-owner.txt','index second\n'); f.git('add','old-owner.txt');
  f.write('old-owner.txt','owner data\n'); const b=f.take();
  assert.equal(f.git('diff','HEAD'), ''); assert.equal(a.status,b.status);
  assert.equal(b.scopePass,false); assert.notEqual(a.fingerprint,b.fingerprint);
});
test('untracked symlink fingerprints its link text and never follows the target', t => {
  const f=gitFixture(t), target=path.join(f.root,'external.txt'), link=path.join(f.repo,'new path.txt');
  fs.writeFileSync(target,'outside one');
  try { fs.symlinkSync(target,link); }
  catch (error) { if (process.platform==='win32' && error.code==='EPERM') return t.skip('Windows symlink privilege unavailable'); throw error; }
  const a=f.take(); fs.writeFileSync(target,'outside two'); const b=f.take();
  assert.equal(a.fingerprint,b.fingerprint);
  fs.unlinkSync(link); fs.symlinkSync(path.join(f.root,'absent-target'),link);
  assert.notEqual(f.take().fingerprint,b.fingerprint);
});
test('first dispatch requires exact clean local and remote base; resumed work still needs assignment and ancestry', t => {
  const f=gitFixture(t), metadata={id:'R01',contract_version:3,base_sha:f.base,canonical_base_sha:f.base,
    canonical_base_branch:'integration',work_branch:'work',executor:f.task.assignment};
  const check=(snap,extra={})=>taskGuard({task:f.task,metadata,snap,canonical:f.base,remoteHead:f.base,initial:true,...extra});
  assert.equal(check(f.take()),true);
  f.write('allowed.txt','uncommitted\n'); assert.equal(check(f.take()),false);
  assert.equal(check(f.take(),{initial:false}),true);
  f.git('add','allowed.txt'); f.git('commit','-qm','candidate'); const s=f.take();
  assert.equal(check(s),false); assert.equal(check(s,{initial:false}),true);
  assert.equal(check(s,{initial:false,metadata:{...metadata,executor:'other-worker'}}),false);
  assert.equal(check(s,{initial:false,snap:{...s,baseIsAncestor:false}}),false);
  assert.equal(check({...s,head:f.base},{remoteHead:'another-head'}),false);
});
test('snapshot detects an unrelated same-tree HEAD rather than inferring ancestry from the diff', t => {
  const f=gitFixture(t);
  f.git('checkout','--orphan','other'); f.git('add','.'); f.git('commit','-qm','unrelated same tree');
  const s=f.take(); assert.equal(s.scopePass,true); assert.deepEqual(s.packet.changedFiles,[]);
  assert.equal(s.baseIsAncestor,false);
});
test('an overlapping tick cannot run or remove the existing lock', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asa-supervisor-'));
  try {
    withLock(dir,()=>{
      const blocked=withLock(dir,()=>assert.fail('overlap'));
      assert.equal(blocked.status,'LOCKED');
      assert.equal(blocked.owner.pid,process.pid);
      assert.equal(blocked.owner.liveness,'EXISTS');
      assert.equal(blocked.owner.status,'VALID');
      assert.ok(fs.existsSync(path.join(dir,'supervisor.lock')));
    });
    assert.ok(!fs.existsSync(path.join(dir,'supervisor.lock')));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

function lockFixture(t, owner={pid:process.pid,at:new Date().toISOString()}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asa-lock-diagnostics-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const lock=path.join(dir,'supervisor.lock'), state=path.join(dir,'state.json');
  fs.mkdirSync(lock);
  if (owner !== null) fs.writeFileSync(path.join(lock,'owner.json'),typeof owner==='string' ? owner : JSON.stringify(owner));
  fs.writeFileSync(state,JSON.stringify({checkedAt:new Date(Date.now()-900000).toISOString(),
    phase:'RUNNING',head:'a'.repeat(40),privateField:'must-not-be-printed'}));
  const bytes=()=>[state,path.join(lock,'owner.json')].map(file=>fs.existsSync(file) ? fs.readFileSync(file,'utf8') : null);
  const cli=mode=>spawnSync(process.execPath,[fileURLToPath(new URL('./asa-cad-supervisor.mjs',import.meta.url)),
    mode,path.join(dir,'campaign.json')],{encoding:'utf8',timeout:10000});
  return {dir,lock,state,bytes,cli};
}

test('a blocked CLI tick exits 2 with bounded diagnostics, without overwriting the checkpoint', t => {
  const f=lockFixture(t), before=f.bytes(), child=f.cli('tick');
  assert.equal(child.status,2,child.stderr);
  const report=JSON.parse(child.stdout);
  assert.equal(report.phase,'LOCKED'); assert.equal(report.owner.liveness,'EXISTS');
  assert.equal(report.owner.pid,process.pid); assert.equal(report.checkpoint.stale,true);
  assert.equal(report.checkpoint.head,'a'.repeat(40));
  assert.ok(report.checkpoint.ageMs>=900000);
  assert.ok(!child.stdout.includes('must-not-be-printed'));
  assert.deepEqual(f.bytes(),before); assert.ok(fs.existsSync(f.lock));
});

test('dead and uninspectable PIDs remain locked; only ESRCH establishes NOT_FOUND', t => {
  const f=lockFixture(t), before=f.bytes();
  for (const [code,liveness] of [['ESRCH','NOT_FOUND'],['EPERM','UNKNOWN'],['EINVAL','UNKNOWN']]) {
    const probe=t.mock.method(process,'kill',(pid,signal)=>{
      assert.equal(pid,process.pid); assert.equal(signal,0);
      throw Object.assign(new Error('private error text'),{code});
    });
    try {
      const report=withLock(f.dir,()=>assert.fail('must not reclaim'));
      assert.equal(report.status,'LOCKED'); assert.equal(report.owner.liveness,liveness);
      assert.equal(probe.mock.callCount(),1);
      assert.deepEqual(f.bytes(),before); assert.ok(fs.existsSync(f.lock));
      assert.ok(!JSON.stringify(report).includes('private error text'));
    } finally { probe.mock.restore(); }
  }
});

test('missing, malformed and invalid owner records never authorize work or probe an unsafe PID', t => {
  t.mock.method(process,'kill',()=>assert.fail('invalid PID must not be probed'));
  for (const owner of [null,'','{broken','[]','null',{},
    {pid:0},{pid:-1},{pid:1.5},{pid:'123'},{pid:2147483648}]) {
    const f=lockFixture(t,owner), before=f.bytes();
    const report=withLock(f.dir,()=>assert.fail('unknown owner must stay locked'));
    assert.equal(report.status,'LOCKED'); assert.equal(report.owner.liveness,'UNKNOWN');
    assert.equal(report.owner.pid,null); assert.notEqual(report.owner.status,'VALID');
    assert.deepEqual(f.bytes(),before); assert.ok(fs.existsSync(f.lock));
  }
});

test('freshness uses the checkpoint timestamp and reports unknown for invalid or future time', t => {
  const f=lockFixture(t), now=Date.parse('2026-11-27T16:40:00.000Z');
  for (const [offset,stale] of [[599999,false],[600000,true],[600001,true]]) {
    fs.writeFileSync(f.state,JSON.stringify({checkedAt:new Date(now-offset).toISOString(),phase:'RUNNING'}));
    const report=inspectLock(f.dir,now);
    assert.equal(report.checkpoint.ageMs,offset); assert.equal(report.checkpoint.stale,stale);
  }
  for (const at of ['invalid',new Date(now+1).toISOString()]) {
    fs.writeFileSync(f.state,JSON.stringify({checkedAt:at}));
    fs.writeFileSync(path.join(f.lock,'owner.json'),JSON.stringify({pid:process.pid,at}));
    const report=inspectLock(f.dir,now);
    assert.equal(report.checkpoint.stale,null); assert.equal(report.checkpoint.status,'INVALID');
    assert.equal(report.owner.ageMs,null); assert.equal(report.owner.status,'INVALID');
  }
  fs.writeFileSync(f.state,'{broken'); assert.equal(inspectLock(f.dir,now).checkpoint.status,'INVALID');
  fs.unlinkSync(f.state); assert.equal(inspectLock(f.dir,now).checkpoint.status,'MISSING');
});

test('diagnose cannot start work, write state or even create an absent directory', t => {
  const f=lockFixture(t), before=f.bytes();
  assert.equal(f.cli('diagnose').status,2); assert.deepEqual(f.bytes(),before);
  fs.rmSync(f.lock,{recursive:true});
  const config=path.join(f.dir,'campaign.json'), configBytes=JSON.stringify({enabled:true,cliPath:'must-not-run'});
  fs.writeFileSync(config,configBytes);
  const child=f.cli('diagnose');
  assert.equal(child.status,0,child.stderr); assert.equal(JSON.parse(child.stdout).phase,'UNLOCKED');
  assert.equal(fs.readFileSync(config,'utf8'),configBytes); assert.equal(f.bytes()[0],before[0]);
  assert.deepEqual(fs.readdirSync(f.dir).sort(),['campaign.json','state.json']);
  fs.rmSync(f.dir,{recursive:true});
  const absent=f.cli('diagnose');
  assert.equal(absent.status,0,absent.stderr); assert.equal(JSON.parse(absent.stdout).checkpoint.status,'MISSING');
  assert.ok(!fs.existsSync(f.dir));
});

test('a disappearing or non-directory lock still blocks the attempted tick', t => {
  const f=lockFixture(t), before=f.bytes(), stat=fs.lstatSync;
  const probe=t.mock.method(fs,'lstatSync',(file,...args)=>{
    if (file===f.lock) throw Object.assign(new Error('gone during inspection'),{code:'ENOENT'});
    return stat(file,...args);
  });
  const raced=withLock(f.dir,()=>assert.fail('must not retry acquisition'));
  assert.equal(raced.status,'LOCKED'); assert.equal(raced.lockType,'MISSING');
  assert.deepEqual(f.bytes(),before); probe.mock.restore();
  fs.rmSync(f.lock,{recursive:true}); fs.writeFileSync(f.lock,'preserve invalid lock');
  assert.equal(withLock(f.dir,()=>assert.fail('invalid lock')).lockType,'OTHER');
  assert.equal(fs.readFileSync(f.lock,'utf8'),'preserve invalid lock');
});
