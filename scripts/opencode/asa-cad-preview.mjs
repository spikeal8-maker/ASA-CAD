#!/usr/bin/env node
/** Local preview only. Receipts are controller inputs, not independent CI attestations. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const N = { stage: 'asa-cad-preview-stage', live: 'asa-cad-preview-live', previous: 'asa-cad-preview-previous' };
const STAGE_ORIGIN = 'http://127.0.0.1:18090';
const PREFIX = 'io.asa.cad.preview';
const SHA = /^[a-f0-9]{40}$/, IMAGE = /^sha256:[a-f0-9]{64}$/, CID = /^[a-f0-9]{64}$/;
const FORMAT = '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"ports":{{json .HostConfig.PortBindings}},"mountCount":{{len .Mounts}},"health":{{with index .State "Health"}}{{json .Status}}{{else}}null{{end}}}';
const need = (ok, message) => { if (!ok) throw new Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const parse = raw => JSON.parse(String(raw).replace(/^\uFEFF/, ''));
const json = file => parse(fs.readFileSync(file));
const exists = file => fs.existsSync(file);
const atomic = (file, value) => {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(tmp, file);
};
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
let c, state, stateFile, owner, lockFile;
function command(exe, args, log, allowFailure = false) {
  const fd = log ? fs.openSync(log, 'a') : undefined;
  let result;
  try { result = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true,
    stdio: log ? ['ignore', fd, fd] : ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60_000 }); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  if (!allowFailure) need(!result.error && result.status === 0,
    `${path.basename(exe)} ${args[0]} failed (exit ${result.status}); ${log ? `private log: ${log}` : String(result.stderr || result.error || '').slice(0, 1200)}`);
  return result;
}
const docker = (args, log) => command(c.dockerCommand, ['--context', c.dockerContext, ...args], log).stdout?.trim();
const git = (args, log) => command(c.gitCommand, args, log).stdout?.trim();
const save = () => atomic(stateFile, state);
function inspect(id) {
  const result = command(c.dockerCommand, ['--context', c.dockerContext, 'container', 'inspect', '--format', FORMAT, id], undefined, true);
  if (result.status !== 0 && /no such (object|container)/i.test(result.stderr || '')) return null;
  need(!result.error && result.status === 0, `Cannot inspect container ${id}: ${String(result.stderr || result.error).slice(0, 500)}`);
  const data = JSON.parse(result.stdout); data.name = data.name.replace(/^\//, ''); return data;
}
function owned(record) {
  need(record && CID.test(record.id) && IMAGE.test(record.imageId), 'Missing recorded container/image identity');
  const actual = inspect(record.id);
  need(actual && actual.image === record.imageId && actual.labels?.[`${PREFIX}.owner`] === owner
    && actual.labels?.[`${PREFIX}.managed`] === 'true' && actual.labels?.[`${PREFIX}.role`] === record.role
    && actual.labels?.[`${PREFIX}.source`] === record.sourceSha, `Refusing unowned or changed container ${record.id}`);
  const names = record.role === 'live' ? [N.live, N.previous] : [record.name || N.stage];
  need(names.includes(actual.name) && actual.mountCount === 0, `Unexpected name/mounts for ${record.id}`);
  if (record.role !== 'extract') {
    const bindings = actual.ports?.['8080/tcp'];
    need(Object.keys(actual.ports || {}).length === 1 && bindings?.length === 1
      && bindings[0].HostIp === '127.0.0.1' && bindings[0].HostPort === String(record.role === 'stage' ? 18090 : 8090), 'Unexpected preview port bindings');
  }
  return actual;
}
function slots() {
  for (const key of ['stage', 'live', 'previous']) {
    const actual = inspect(N[key]);
    need(!actual || state[key]?.id === actual.id, `Name ${N[key]} exists without its recorded ID; refusing takeover`);
    if (state[key]) owned(state[key]);
  }
}
function remove(record) {
  const actual = owned(record);
  if (actual.running) docker(['stop', '--time', '10', record.id]);
  docker(['rm', record.id]);
}
function create(name, role, imageId, sourceSha) {
  need(!inspect(name), `Container name already occupied: ${name}`);
  const args = ['create', '--pull', 'never', '--name', name,
    '--label', `${PREFIX}.managed=true`, '--label', `${PREFIX}.owner=${owner}`,
    '--label', `${PREFIX}.role=${role}`, '--label', `${PREFIX}.source=${sourceSha}`];
  if (role !== 'extract') args.push('--publish', `127.0.0.1:${role === 'stage' ? 18090 : 8090}:8080`, '--restart', role === 'stage' ? 'no' : 'unless-stopped');
  const id = docker([...args, imageId]); need(CID.test(id), 'Docker did not return a full container ID');
  return { id, imageId, sourceSha, role, name };
}
function approval() {
  const raw = fs.readFileSync(c.approvalFile), value = parse(raw);
  need(value.version === 1 && value.status === 'APPROVED' && value.scope === 'LOCAL_DEVELOPMENT_PREVIEW'
    && value.sourceSha === c.sourceSha && typeof value.approvedBy === 'string' && value.approvedBy.trim()
    && typeof value.reason === 'string' && value.reason.trim() && Array.isArray(value.evidence)
    && value.evidence.length && value.evidence.every(x => typeof x === 'string' && x.trim()), 'Missing exact controller deployment approval');
  return hash(raw);
}
function get(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: route }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 128 * 1024) req.destroy(new Error('Oversized health response')); else chunks.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(3000, () => req.destroy(new Error('HTTP health timeout'))); req.on('error', reject);
  });
}
async function ready(record, port) {
  const deadline = Date.now() + c.healthTimeoutMs; let reason = 'not ready';
  while (Date.now() < deadline) {
    const actual = owned(record); need(actual.running, `Container stopped: ${record.id}`);
    try {
      need(actual.health === 'healthy', `Docker health: ${actual.health}`);
      const [live, version, page] = await Promise.all([get(port, '/health/live'), get(port, '/asa-cad-preview.json'), get(port, '/')]);
      for (const response of [live, version, page]) need(response.status === 200
        && response.headers['cross-origin-opener-policy'] === 'same-origin'
        && response.headers['cross-origin-embedder-policy'] === 'require-corp', 'HTTP status/COOP/COEP mismatch');
      need(live.body.trim() === 'ok' && /application\/json/i.test(version.headers['content-type'] || '')
        && /text\/html/i.test(page.headers['content-type'] || ''), 'Wrong health/version/index response');
      const meta = JSON.parse(version.body);
      need(meta.product === 'ASA-CAD' && meta.channel === 'development-preview' && meta.sourceSha === record.sourceSha
        && meta.sourceTree === record.sourceTree && meta.publicOrigin === c.publicOrigin, 'Served artifact identity mismatch');
      return;
    } catch (error) { reason = error.message; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Readiness failed: ${reason}`);
}
function extract(imageId, dest, job, suffix) {
  fs.mkdirSync(dest, { recursive: true });
  const record = create(`asa-cad-preview-extract-${suffix}`, 'extract', imageId, c.sourceSha);
  atomic(path.join(job, `extract-${suffix}.json`), record);
  try { owned(record); docker(['cp', `${record.id}:/srv/.`, dest]); }
  finally { remove(record); }
}
async function stage() {
  const approvalHash = approval(); slots();
  if (state.stage) { remove(state.stage); state.stage = null; save(); }
  need(git(['-C', c.repoPath, 'rev-parse', '--verify', `${c.sourceSha}^{commit}`]) === c.sourceSha, 'Approved commit unavailable locally');
  const id = randomUUID().replaceAll('-', '').slice(0, 12), job = path.join(c.previewDir, 'jobs', `${c.sourceSha}-${id}`);
  const source = path.join(job, 'source'), context = path.join(job, 'runtime'), log = path.join(job, 'build.log');
  fs.mkdirSync(context, { recursive: true });
  const baseTag = `asa-cad-preview-build:${c.sourceSha}-${id}`, tag = `asa-cad-preview:${c.sourceSha}-${id}`;
  let added = false;
  try {
    git(['-C', c.repoPath, 'worktree', 'add', '--detach', source, c.sourceSha], log); added = true;
    need(git(['-C', source, 'rev-parse', 'HEAD']) === c.sourceSha && !git(['-C', source, 'status', '--porcelain']), 'Build worktree is not exact and clean');
    const sourceTree = git(['-C', source, 'rev-parse', 'HEAD^{tree}']); need(SHA.test(sourceTree), 'Invalid source tree');
    emit({ phase: 'building', sourceSha: c.sourceSha });
    docker(['build', '--file', path.join(source, 'Dockerfile'), '--tag', baseTag,
      '--label', `org.opencontainers.image.revision=${c.sourceSha}`, source], log);
    const baseImageId = docker(['image', 'inspect', '--format', '{{.Id}}', baseTag]); need(IMAGE.test(baseImageId), 'Invalid base image ID');
    const oldDir = path.join(context, 'old', 'srv'), newDir = path.join(context, 'new', 'srv');
    fs.mkdirSync(oldDir, { recursive: true });
    if (state.live) { owned(state.live); extract(state.live.imageId, oldDir, job, `${id}-old`); }
    extract(baseImageId, newDir, job, `${id}-new`);
    const meta = { version: 1, product: 'ASA-CAD', channel: 'development-preview', sourceSha: c.sourceSha,
      sourceTree, publicOrigin: c.publicOrigin, builtAtUtc: new Date().toISOString() };
    atomic(path.join(context, 'preview-version.json'), meta);
    fs.writeFileSync(path.join(context, 'Dockerfile'), `FROM ${baseTag}\nLABEL ${PREFIX}.managed="true" org.opencontainers.image.revision="${c.sourceSha}" org.opencontainers.image.version="${c.sourceSha}" org.opencontainers.image.source="https://github.com/spikeal8-maker/ASA-CAD"\nCOPY old/srv/ /srv/\nCOPY new/srv/ /srv/\nCOPY --chmod=0444 preview-version.json /srv/asa-cad-preview.json\n`);
    docker(['build', '--tag', tag, context], log);
    const imageId = docker(['image', 'inspect', '--format', '{{.Id}}', tag]); need(IMAGE.test(imageId), 'Invalid final image ID');
    state.stage = { ...create(N.stage, 'stage', imageId, c.sourceSha), sourceTree, approvalHash,
      baseImageId, retainedFrom: state.live?.imageId || null, publicOrigin: c.publicOrigin, scenario: c.scenario, log, published: false };
    save(); docker(['start', state.stage.id]); await ready(state.stage, 18090);
    emit({ action: 'stage', status: 'READY_FOR_BROWSER_PROOF', sourceSha: c.sourceSha, imageId, sourceTree, origin: STAGE_ORIGIN, scenario: c.scenario });
  } finally { if (added) git(['-C', c.repoPath, 'worktree', 'remove', source], log); }
}
async function restore() {
  need(state.previous?.published === true, 'No recorded previously published container to restore'); owned(state.previous);
  const occupant = inspect(N.live);
  need(!occupant || occupant.id === state.live?.id || occupant.id === state.previous.id, 'Live name occupied by an unrecorded container');
  if (state.live && state.live.id !== state.previous.id) { remove(state.live); state.live = null; save(); }
  const previous = owned(state.previous);
  if (previous.name !== N.live) docker(['rename', previous.id, N.live]);
  if (!previous.running) docker(['start', previous.id]);
  await ready(state.previous, 8090);
  state.live = { ...state.previous, name: N.live }; state.previous = null; state.phase = 'PUBLISHED'; save();
  emit({ action: 'rollback', status: 'RESTORED', sourceSha: state.live.sourceSha, imageId: state.live.imageId, origin: c.publicOrigin });
}
async function publish() {
  const approvalHash = approval(); slots(); const candidate = state.stage;
  need(candidate && candidate.sourceSha === c.sourceSha && candidate.approvalHash === approvalHash
    && candidate.scenario === c.scenario && candidate.publicOrigin === c.publicOrigin, 'Stage/approval/config mismatch');
  const proofRaw = fs.readFileSync(c.browserProofFile), proof = parse(proofRaw);
  need(proof.sourceSha === candidate.sourceSha && proof.imageId === candidate.imageId && proof.status === 'PASS'
    && String(proof.origin).replace(/\/$/, '') === STAGE_ORIGIN && proof.scenario === c.scenario, 'Missing exact staged browser PASS');
  await ready(candidate, 18090);
  need(candidate.retainedFrom === (state.live?.imageId || null), 'Live artifact changed after staging; restage to retain its assets');
  if (state.previous) { need(!owned(state.previous).running, 'Previous container unexpectedly running'); remove(state.previous); state.previous = null; save(); }
  remove(candidate); state.stage = null; save();
  try {
    if (state.live) {
      state.previous = state.live; state.live = null; state.phase = 'SWITCHING'; save();
      const old = owned(state.previous); if (old.running) docker(['stop', '--time', '10', old.id]);
      docker(['rename', old.id, N.previous]);
    }
    state.live = { ...candidate, ...create(N.live, 'live', candidate.imageId, candidate.sourceSha),
      browserProofHash: hash(proofRaw), published: false }; save();
    docker(['start', state.live.id]); await ready(state.live, 8090);
    state.live.published = true; state.phase = 'PUBLISHED'; save();
    emit({ action: 'publish', status: 'PUBLISHED', sourceSha: state.live.sourceSha, imageId: state.live.imageId, origin: c.publicOrigin });
  } catch (error) {
    state.lastFailure = { at: new Date().toISOString(), sourceSha: candidate.sourceSha, message: error.message }; save();
    if (state.previous) await restore();
    else if (state.live) { remove(state.live); state.live = null; state.phase = 'EMPTY'; save(); }
    throw error;
  }
}
function configure(file) {
  need(path.isAbsolute(file), 'Use an absolute config path'); const input = json(file);
  c = { dockerContext: 'desktop-linux', dockerCommand: 'docker', gitCommand: 'git', healthTimeoutMs: 120_000, ...input };
  need(c.version === 1 && SHA.test(c.sourceSha) && typeof c.scenario === 'string' && c.scenario.trim(), 'Invalid config version/sourceSha/scenario');
  for (const key of ['repoPath', 'previewDir', 'approvalFile', 'browserProofFile']) need(typeof c[key] === 'string' && path.isAbsolute(c[key]), `Absolute ${key} required`);
  const origin = new URL(c.publicOrigin);
  need(origin.protocol === 'http:' && origin.hostname.endsWith('.localhost') && origin.port === '8090'
    && origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password, 'Use the dedicated .localhost preview origin on port 8090');
  c.publicOrigin = origin.origin; c.repoPath = fs.realpathSync(c.repoPath); c.previewDir = path.resolve(c.previewDir);
  const relative = path.relative(c.repoPath, c.previewDir);
  need(relative && (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)), 'previewDir must be outside the repository');
  need(Number.isInteger(c.healthTimeoutMs) && c.healthTimeoutMs >= 5000 && c.healthTimeoutMs <= 300_000, 'Invalid health timeout');
  for (const key of ['dockerContext', 'dockerCommand', 'gitCommand']) need(typeof c[key] === 'string' && c[key].trim(), `Invalid ${key}`);
  owner = hash(`${c.repoPath}\n${c.previewDir}\n${c.dockerContext}`).slice(0, 24);
  stateFile = path.join(c.previewDir, 'state.json'); lockFile = path.join(c.previewDir, 'deploy.lock');
  readState();
}
function readState() {
  state = exists(stateFile) ? json(stateFile) : { version: 1, owner, publicOrigin: c.publicOrigin, phase: 'EMPTY', stage: null, live: null, previous: null };
  need(state.version === 1 && state.owner === owner && state.publicOrigin === c.publicOrigin, 'Private state ownership/origin mismatch');
}
function lock() {
  fs.mkdirSync(c.previewDir, { recursive: true });
  if (exists(lockFile)) {
    const holder = json(lockFile); need(holder.owner === owner && Number.isInteger(holder.pid) && holder.pid > 0, 'Unrecognized lock; refusing removal');
    let alive = true; try { process.kill(holder.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    need(!alive, `Preview helper already active: PID ${holder.pid}`); fs.unlinkSync(lockFile);
  }
  const fd = fs.openSync(lockFile, 'wx', 0o600);
  fs.writeFileSync(fd, JSON.stringify({ owner, pid: process.pid, at: new Date().toISOString() })); fs.closeSync(fd);
}
async function main() {
  const [action, flag, file, ...extra] = process.argv.slice(2);
  if (action === '--help') { emit({ usage: 'asa-cad-preview.mjs stage|publish|rollback|status --config ABSOLUTE_JSON_PATH',
    requiredConfig: ['version:1', 'repoPath', 'previewDir', 'sourceSha', 'publicOrigin', 'approvalFile', 'browserProofFile', 'scenario'],
    approval: { version: 1, status: 'APPROVED', scope: 'LOCAL_DEVELOPMENT_PREVIEW', fields: ['sourceSha', 'approvedBy', 'reason', 'evidence[]'] },
    browserProof: { status: 'PASS', origin: STAGE_ORIGIN, fields: ['sourceSha', 'imageId', 'scenario'] } }); return; }
  need(['stage', 'publish', 'rollback', 'status'].includes(action) && flag === '--config' && file && !extra.length, 'Use --help for the exact command/config contract');
  configure(file);
  if (action === 'status') { slots(); emit({ ...state, stageOrigin: STAGE_ORIGIN }); return; }
  lock();
  try { readState(); if (action === 'stage') await stage(); else if (action === 'publish') await publish(); else await restore(); }
  finally { if (exists(lockFile) && json(lockFile).pid === process.pid) fs.unlinkSync(lockFile); }
}
main().catch(error => { emit({ status: 'FAILED', error: error.message }); process.exitCode = 1; });
