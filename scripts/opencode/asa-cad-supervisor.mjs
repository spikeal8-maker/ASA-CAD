import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The model coordinates work. This process only observes, checkpoints and resumes
// the assigned contract. It never edits product files, approves a task or merges.
export function chooseAction({ enabled, manualStop, active, pending, guard, issueStatus,
  handoff, candidate, taskId, issue, dispatchKey, contractVersion, baseSha, dispatchAt,
  reviewVerified = false, attempts, idleMs, idleDelayMs }) {
  if (!enabled || manualStop) return 'PAUSED';
  if (!guard) return 'BLOCKED_GUARD';
  if (pending) return 'WAIT_PERMISSION_OR_INBOX';
  if (active) return 'RUNNING';
  if (issueStatus === 'BLOCKED') return 'WAIT_CONTROLLER';
  if (!['READY', 'IN_PROGRESS', 'REVIEW'].includes(issueStatus)) return 'WAIT_CONTROLLER';
  const current = matchesDispatch(handoff, { taskId, issue, dispatchKey, contractVersion, baseSha, dispatchAt });
  if (current && handoff.status === 'BLOCKED') return 'WAIT_CONTROLLER';
  if (current && handoff.candidate === candidate && ['APPROVE', 'REQUEST_CHANGES'].includes(handoff.reviewVerdict)) {
    return reviewVerified ? 'WAIT_CONTROLLER' : 'WAIT_CONTROLLER_REVIEW_PROVENANCE';
  }
  if (idleMs < idleDelayMs) return 'IDLE_GRACE';
  if (attempts >= 2) return 'WAIT_CONTROLLER_NO_PROGRESS';
  return 'RESUME';
}

export function taskDispatchKey(task) { return `${task.id}:${task.contractVersion}:${task.baseSha}`; }

export function matchesDispatch(handoff, dispatch) {
  return Boolean(handoff && handoff.task === dispatch.taskId && handoff.issue === dispatch.issue &&
    handoff.dispatchKey === dispatch.dispatchKey && handoff.contractVersion === dispatch.contractVersion &&
    handoff.baseSha === dispatch.baseSha && Number.isFinite(handoff.messageCreatedAt) &&
    Number.isFinite(dispatch.dispatchAt) && handoff.messageCreatedAt >= dispatch.dispatchAt);
}

export function readTaskMetadata(body) {
  const match = body.match(/<!--\s*asa-fusion-task:\s*(\{[^]*?\})\s*-->/);
  if (!match) throw new Error('Live issue has no asa-fusion-task metadata');
  return JSON.parse(match[1]);
}

function messageText(item) {
  return item.text ?? (Array.isArray(item.content) ?
    item.content.filter(x => x.type === 'text').map(x => x.text).join('\n') : item.content) ?? '';
}

export function extractHandoff(messages, dispatch) {
  for (const item of [...messages].reverse()) {
    const text = messageText(item);
    if (typeof text !== 'string') continue;
    for (const line of text.split('\n').reverse()) {
      const match = line.match(/^\s*ASA_HANDOFF\s+(\{.*\})\s*$/);
      if (match) {
        try {
          const handoff = { ...JSON.parse(match[1]), messageId: item.id ?? null,
            messageCreatedAt: item.time?.created ?? null };
          if (!dispatch || matchesDispatch(handoff, dispatch)) return handoff;
        } catch { /* incomplete text */ }
      }
    }
  }
  return null;
}

export function independentReviewVerified(handoff, parent, children, dispatchAt, reviewerMessages) {
  if (!handoff || !handoff.workerSessionId || !handoff.reviewerSessionId ||
      handoff.workerSessionId === handoff.reviewerSessionId ||
      [handoff.workerSessionId, handoff.reviewerSessionId].includes(parent.id)) return false;
  const child = (id, agent) => children.find(x => x.id === id && x.parentID === parent.id &&
    x.agent === agent && x.outcome === 'succeeded' && x.time?.created >= dispatchAt);
  const worker = child(handoff.workerSessionId, 'asa-cad-worker');
  const reviewer = child(handoff.reviewerSessionId, 'asa-cad-reviewer');
  if (!worker || !reviewer) return false;
  return [...reviewerMessages].reverse().some(item => {
    const text = messageText(item);
    return item.time?.created >= reviewer.time.created && typeof text === 'string' &&
      text.match(/^\s*(?:#{1,6}[ \t]+)?VERDICT:[ \t]*(?:\*\*)?(APPROVE|REQUEST_CHANGES|BLOCKED)(?:\*\*)?[ \t]*(?:\r?\n|$)/)?.[1] === handoff.reviewVerdict &&
      text.includes(handoff.baseSha) && text.includes(handoff.candidate);
  });
}

function normalizedDirectory(value) {
  if (typeof value !== 'string' || !value) return null;
  return /^[a-z]:[\\/]|^\\\\/i.test(value)
    ? path.win32.normalize(value).replace(/[\\/]$/, '').toLowerCase() : path.resolve(value);
}

export function coordinatorMatches(parent, config, expectedId) {
  return parent?.id === expectedId && parent.agent === 'asa-cad-coordinator' &&
    normalizedDirectory(parent.location?.directory) !== null &&
    normalizedDirectory(parent.location.directory) === normalizedDirectory(config.repositoryPath);
}

export function taskGuard({ task, metadata, snap, canonical, remoteHead, initial }) {
  const assignment = task.assignment ?? task.executor;
  return Boolean(typeof assignment === 'string' && assignment && metadata.executor === assignment &&
    canonical === task.canonicalSha && snap.branch === task.workBranch && snap.baseIsAncestor &&
    metadata.id === task.id && metadata.contract_version === task.contractVersion &&
    metadata.base_sha === task.baseSha && metadata.canonical_base_sha === task.canonicalSha &&
    metadata.canonical_base_branch === task.canonicalBranch && metadata.work_branch === task.workBranch &&
    snap.scopePass && (!initial || (snap.head === task.baseSha && !snap.status && remoteHead === task.baseSha)));
}

function save(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

export function withLock(directory, operation) {
  const lock = path.join(directory, 'supervisor.lock');
  fs.mkdirSync(directory, { recursive: true });
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A stale lock is reported, never removed over a possibly active writer.
    return { status: 'LOCKED', lock };
  }
  fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  try { return operation(); } finally { fs.rmSync(lock, { recursive: true }); }
}

function command(executable, args, cwd, raw = false) {
  const result = execFileSync(executable, args, { cwd, encoding: 'utf8', input: '',
    timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' } });
  return raw ? result : result.trim();
}

function api(config, method, route, data) {
  const args = ['api', method, route];
  if (data !== undefined) args.push('--data', JSON.stringify(data));
  return JSON.parse(command(config.cliPath, args, config.repositoryPath));
}

export function collection(result) {
  let value = result;
  for (let depth = 0; depth < 3 && value && !Array.isArray(value) && 'data' in value; depth++) value = value.data;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.messages)) return value.messages;
  throw new Error('Unexpected API collection response; pending work cannot be assumed empty');
}

export function snapshot(config, directory, dispatchAt) {
  const gitRaw = (...args) => command('git', ['-C', config.repositoryPath, ...args], config.repositoryPath, true);
  const git = (...args) => gitRaw(...args).trim();
  const names = (...args) => gitRaw(...args).split('\0').filter(Boolean);
  const head = git('rev-parse', 'HEAD');
  const branch = git('branch', '--show-current');
  const status = gitRaw('status', '--porcelain=v1', '-z');
  const dirtyDiff = gitRaw('--no-pager', 'diff', '--binary', '--no-renames', '--no-ext-diff', '--no-textconv', 'HEAD');
  const indexDiff = gitRaw('--no-pager', 'diff', '--cached', '--binary', '--no-renames', '--no-ext-diff', '--no-textconv', 'HEAD');
  const paths = names('diff', '--no-renames', '--name-only', '-z', config.task.baseSha, head);
  const untracked = names('ls-files', '--others', '--exclude-standard', '-z').sort();
  const pendingPaths = [...new Set([...names('diff', '--no-renames', '--name-only', '-z', config.task.baseSha),
    ...names('diff', '--cached', '--no-renames', '--name-only', '-z', 'HEAD'), ...untracked])];
  const patch = gitRaw('--no-pager', 'diff', '--no-renames', '--no-ext-diff', '--no-textconv', config.task.baseSha, head);
  let baseIsAncestor = true;
  try { git('merge-base', '--is-ancestor', config.task.baseSha, head); }
  catch (error) { if (error.status !== 1) throw error; baseIsAncestor = false; }
  const untrackedHashes = untracked.map(name => {
    const file = path.join(config.repositoryPath, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return [name, 'symlink', fs.readlinkSync(file)];
    if (!stat.isFile()) throw new Error(`Unsupported untracked file type: ${name}`);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try { return [name, 'file', crypto.createHash('sha256').update(fs.readFileSync(fd)).digest('hex')]; }
    finally { fs.closeSync(fd); }
  });
  const saved = path.join(directory, 'review-files');
  fs.mkdirSync(saved, { recursive: true });
  const capture = (ref, name) => {
    if (!gitRaw('ls-tree', '-r', '--name-only', '-z', ref, '--', name)) return null;
    const text = command('git', ['-C', config.repositoryPath, 'show', `${ref}:${name}`], config.repositoryPath, true);
    const pathHash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 16);
    const destination = path.join(saved, `${ref}-${pathHash}-${path.basename(name).replace(/[^a-zA-Z0-9_.-]/g,'_')}`);
    fs.writeFileSync(destination, text, 'utf8');
    return { file: destination, gitBlob: git('rev-parse', `${ref}:${name}`),
      hashObject: 'UTF-8 bytes returned by git show', sha256: crypto.createHash('sha256').update(text).digest('hex') };
  };
  const files = paths.map(name => ({ path: name,
    before: capture(config.task.baseSha, name), after: capture(head, name) }));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([head, status, dirtyDiff, indexDiff, untrackedHashes])).digest('hex');
  const packet = { schemaVersion: 1, task: config.task.id, issue: config.task.issue,
    dispatchKey: taskDispatchKey(config.task), contractVersion: config.task.contractVersion, dispatchAt,
    baseSha: config.task.baseSha, candidate: head, branch, clean: !status,
    allowedFiles: config.task.allowedFiles, changedFiles: paths, pendingPaths, baseIsAncestor,
    scopePass: [...paths,...pendingPaths].every(name => config.task.allowedFiles.includes(name)),
    capturedAt: new Date().toISOString(), contract: config.task,
    liveContractPath: path.join(directory, 'live-contract.json'),
    checkoutHeadVerifiedBySupervisor: true, patch, files };
  save(path.join(directory, 'review-packet.json'), packet);
  return { head, branch, status, fingerprint, scopePass: packet.scopePass, baseIsAncestor, packet };
}

function bootstrap(config, directory) {
  return `Ты координатор длительной разработки ASA-CAD. Используй native subagent и только локальную модель.\n` +
    `configPath: ${path.join(directory, 'campaign.json')}; reviewPacketPath: ${path.join(directory, 'review-packet.json')}. ` +
    `Прочитай configPath. Repo: ${config.repositoryPath}. ` +
    `Текущая карточка: FUS/${config.task.id}, https://github.com/${config.repository}/issues/${config.task.issue}, ` +
    `контракт v${config.task.contractVersion}, exact start ${config.task.baseSha}, canonical ${config.task.canonicalSha}.\n` +
    `В ASA_HANDOFF скопируй dispatchKey=${taskDispatchKey(config.task)}, baseSha=${config.task.baseSha}, ` +
    `contractVersion=${config.task.contractVersion} из свежего packet.\n` +
    `Делегируй asa-cad-worker полное самостоятельное задание: прочитать live Issue и обязательные документы, ` +
    `исполнить только разрешённую карточку, провести проверки, опубликовать обычный commit и восьмипунктный REVIEW. ` +
    `Назначение разрешено контролёром #${config.controllerIssue}. Фактический child session ID записать в отчёте.\n` +
    `Один ребёнок за раз; после delegation закончи ход и жди callback. Сам исходники не меняй. ` +
    `После рабочего результата свежий asa-cad-reviewer проверяет actual candidate и trusted packet ` +
    `${path.join(directory, 'review-packet.json')}. Если packet ещё старый, сообщи WAIT_SNAPSHOT и закончи ход; ` +
    `supervisor обновит его и продолжит тебя. Не выдавай старый packet за новый SHA.\n` +
    `REVIEW запускает review, а не вопрос пользователю. Новый READY, work_verified и merge выдаёт внешний контролёр. ` +
    `Сохрани child IDs. Итог отдельной строкой ASA_HANDOFF JSON по своему профилю. ` +
    `Для уточнений используй действующий контракт; не запрашивай повторное разрешение на уже порученную работу.`;
}

export function run(configPath, mode = 'tick') {
  const directory = path.dirname(path.resolve(configPath));
  return withLock(directory, () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const statePath = path.join(directory, 'state.json');
    const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) :
      { schemaVersion: 1, attempts: 0, phase: 'NEW', task: config.task.id };
    const record = (phase, extra = {}) => {
      Object.assign(state, extra, { phase, checkedAt: new Date().toISOString() });
      save(statePath, state);
      return state;
    };
    if (mode === 'pause') { config.enabled = false; save(configPath, config); return record('PAUSED'); }
    if (!config.enabled || state.manualStop) return record('PAUSED');
    const dispatchKey = taskDispatchKey(config.task);
    if (state.dispatchKey !== dispatchKey) Object.assign(state, { dispatchKey, task: config.task.id,
      attempts: 0, lastPromptAt: 0, pendingPrompt: null, dispatchAt: Date.now(), handoff: null });
    const dispatch = { dispatchKey, taskId: config.task.id, issue: config.task.issue,
      contractVersion: config.task.contractVersion, baseSha: config.task.baseSha, dispatchAt: state.dispatchAt };
    try {
      if (process.platform === 'win32' && config.requireDesktop !== false &&
          !command('tasklist.exe', ['/FI', 'IMAGENAME eq OpenCode.exe', '/FO', 'CSV', '/NH'], directory).includes('OpenCode.exe')) {
        return record('WAIT_DESKTOP');
      }
      const snap = snapshot(config, directory, state.dispatchAt);
      const refs = command('git', ['-C', config.repositoryPath, 'ls-remote', 'origin',
        `refs/heads/${config.task.canonicalBranch}`, `refs/heads/${config.task.workBranch}`], config.repositoryPath);
      const remote = new Map(refs.split('\n').filter(Boolean).map(line => line.split(/\s+/)).map(([sha, ref]) => [ref, sha]));
      const canonical = remote.get(`refs/heads/${config.task.canonicalBranch}`);
      const remoteHead = remote.get(`refs/heads/${config.task.workBranch}`);
      const issue = JSON.parse(command('gh', ['issue', 'view', String(config.task.issue),
        '--repo', config.repository, '--json', 'title,body,comments'], config.repositoryPath));
      const metadata = readTaskMetadata(issue.body);
      const initial = !state.lastPromptAt && !state.pendingPrompt;
      const guard = taskGuard({ task: config.task, metadata, snap, canonical, remoteHead, initial });
      save(path.join(directory, 'live-contract.json'), { title: issue.title, body: issue.body, metadata });
      snap.packet.evidenceComments = (issue.comments ?? []).filter(x => x.body?.includes(snap.head)).slice(-2)
        .map(x => ({ provenance: 'AUTHOR_CLAIM_NOT_VERIFIED_TEST_RECEIPT', url: x.url,
          author: x.author?.login, createdAt: x.createdAt, body: x.body }));
      save(path.join(directory, 'review-packet.json'), snap.packet);
      if (!guard) return record('BLOCKED_GUARD', { head: snap.head, canonical, remoteHead, initial, metadata });
      if (snap.fingerprint !== state.fingerprint) {
        state.attempts = 0; state.fingerprint = snap.fingerprint; state.progressAt = Date.now();
      }
      state.head = snap.head;
      const active = api(config, 'get', '/api/session/active').data ?? {};
      state.activeSessions = Object.keys(active);
      if (state.activeSessions.length) return record('RUNNING');
      if (!state.coordinatorCreated) {
        if (!state.coordinatorSessionId && mode !== 'start') return record('AWAITING_START');
        state.coordinatorSessionId ??= `ses_${crypto.randomBytes(13).toString('hex')}`;
        save(statePath, state);
        const created = api(config, 'post', '/api/session', { id: state.coordinatorSessionId,
          title: config.title, agent: 'asa-cad-coordinator', location: { directory: config.repositoryPath },
          model: { providerID: config.modelProvider, id: config.modelId } }).data;
        if (!coordinatorMatches(created, config, state.coordinatorSessionId)) throw new Error('Created/recovered coordinator identity, agent or location mismatch');
        state.coordinatorCreated = true;
        state.createdAt = Date.now();
        save(statePath, state);
      }
      const parent = api(config, 'get', `/api/session/${state.coordinatorSessionId}`).data;
      if (!coordinatorMatches(parent, config, state.coordinatorSessionId)) throw new Error('Coordinator identity, agent or location mismatch');
      const children = collection(api(config, 'get', `/api/session?parentID=${state.coordinatorSessionId}&limit=50`))
        .filter(x => x.parentID === parent.id && (x.time?.created ?? 0) >= state.dispatchAt);
      state.children = children.map(x => ({ id: x.id, parentID: x.parentID, agent: x.agent, outcome: x.outcome }));
      if ([parent, ...children].some(x => x.outcome === 'interrupted')) return record('PAUSED', { manualStop: true });
      const jobs = collection(api(config, 'get', `/api/experimental/job?sessionID=${parent.id}&descendants=true&status=running`));
      if (jobs.length) return record('RUNNING', { runningJobs: jobs.map(x => x.id) });
      let pending = false;
      for (const session of [parent, ...children]) {
        for (const endpoint of ['permission', 'form', 'inbox']) {
          if (collection(api(config, 'get', `/api/session/${session.id}/${endpoint}`)).length) pending = true;
        }
      }
      const messages = collection(api(config, 'get', `/api/session/${parent.id}/message?order=desc&limit=30&type=assistant`)).reverse();
      const handoff = extractHandoff(messages, dispatch);
      let reviewVerified = false;
      if (handoff?.reviewerSessionId && !snap.status && handoff.candidate === snap.head &&
          children.some(x => x.id === handoff.reviewerSessionId && x.agent === 'asa-cad-reviewer')) {
        const replies = collection(api(config, 'get', `/api/session/${handoff.reviewerSessionId}/message?order=desc&limit=10&type=assistant`)).reverse();
        reviewVerified = independentReviewVerified(handoff, parent, children, state.dispatchAt, replies);
      }
      save(path.join(directory, 'handoff.json'), { ...handoff, dispatchKey, current: Boolean(handoff), reviewVerified,
        observedHead: snap.head, observedClean: !snap.status });
      const action = chooseAction({ enabled: true, manualStop: false, active: false, pending, guard,
        ...dispatch, issueStatus: metadata.status, handoff, candidate: snap.head, reviewVerified, attempts: state.attempts,
        idleMs: mode === 'start' ? Infinity : Date.now() - Math.max(state.lastPromptAt ?? state.createdAt ?? 0, parent.time?.updated ?? 0),
        idleDelayMs: config.idleDelayMs ?? 90000 });
      if (action !== 'RESUME') return record(action, { handoff, reviewVerified });
      // Save the id before submitting. Repeating the same request is idempotent.
      const text = state.lastPromptAt ?
        `Продолжи текущую FUS/${config.task.id} без нового writer и без новой карточки. ` +
        `Сначала прочитай ${path.join(directory, 'live-contract.json')} и ${path.join(directory, 'review-packet.json')}. ` +
        `Candidate ${snap.head}; issue ${metadata.status}. Сохрани существующие child IDs. ` +
        `В ASA_HANDOFF скопируй dispatchKey=${dispatchKey}, baseSha=${config.task.baseSha}, contractVersion=${config.task.contractVersion}. ` +
        `Если worker ещё не закончил порученную работу, продолжи того же worker; если REVIEW — вызови свежий readonly reviewer ` +
        `для актуального packet, затем ASA_HANDOFF. Не задавай вопрос о продолжении уже разрешённого. ` +
        `При реальном препятствии сохрани BLOCKED с причиной, не обходи permissions/guards.` : bootstrap(config, directory);
      const request = state.pendingPrompt ?? { id: `msg_${crypto.randomBytes(13).toString('hex')}`, text, resume: true };
      state.pendingPrompt = request;
      save(statePath, state);
      api(config, 'post', `/api/session/${parent.id}/prompt`, request);
      return record('DISPATCHED', { attempts: state.attempts + 1, lastPromptAt: Date.now(), pendingPrompt: null });
    } catch (error) {
      return record('ERROR', { error: String(error.message).slice(0,3000) });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode = 'tick', configPath] = process.argv.slice(2);
  if (!configPath) throw new Error('Usage: asa-cad-supervisor.mjs start|tick|pause campaign.json');
  const result = run(configPath, mode);
  console.log(JSON.stringify({ phase: result.phase ?? result.status, task: result.task,
    coordinatorSessionId: result.coordinatorSessionId, head: result.head, error: result.error }));
  if (result.phase === 'ERROR' || result.phase === 'BLOCKED_GUARD') process.exitCode = 1;
}
