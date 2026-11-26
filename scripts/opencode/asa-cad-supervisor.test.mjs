import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { chooseAction, readTaskMetadata, extractHandoff, withLock, snapshot, taskGuard,
  coordinatorMatches, independentReviewVerified, collection } from './asa-cad-supervisor.mjs';

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
      assert.equal(withLock(dir,()=>assert.fail('overlap')).status,'LOCKED');
      assert.ok(fs.existsSync(path.join(dir,'supervisor.lock')));
    });
    assert.ok(!fs.existsSync(path.join(dir,'supervisor.lock')));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
