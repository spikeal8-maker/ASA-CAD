import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const SCHEMA = 'asa.health-evidence-archive.v1';
export const SPLIT_AT = 1_800_000;
export const HARD_LIMIT = 2_097_152;
const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const PINNED = {
  'performance-runner.mjs': '53224b6ec0fcfb835650890fdea12e2a5216182c4288047ea5a7960e025e2add',
  'performance-worker.mjs': '44bf82d8151885ee3d8fcb700562837e0a1075327a2fc6a888c1cdb39ac08254',
  'performance-fixtures.mjs': '3d16d60df721021fe803493ad2f4e3da4eb007286fd0a0374698a60a9eb83967',
  'performance-common.mjs': '8870a27525937d03fd4f1bad79ca7869d2b4ad27985988e9b6e40e5bf0c49ba9',
  'dependency-classifier.mjs': '9b8f10b02a82d90086f6ee2378d2b57b714d09631e6c6bd6bb58e0068c8806fe',
};
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function relativeName(name) {
  assert.equal(typeof name, 'string');
  assert.ok(name && !/[\\:\0]/.test(name) && !name.startsWith('/'), 'Unsafe archive-relative path: ' + name);
  assert.ok(name.split('/').every((part) => part && part !== '.' && part !== '..'), 'Unsafe relative component');
  return name;
}
function under(root, name) { return path.join(root, relativeName(name)); }
function inventory(root) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), 'Symlinks are not archive evidence');
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else { assert.ok(entry.isFile(), 'Only regular evidence files are allowed'); files.push(path.relative(root, file).replaceAll('\\', '/')); }
    }
  }
  walk(root);
  return files.sort();
}
function externalFresh(output) {
  const requested = path.resolve(output);
  assert.ok(!fs.existsSync(requested), 'Output must be fresh; never overwrite evidence');
  let ancestor = path.dirname(requested);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const canonical = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, requested));
  for (let current = path.dirname(canonical); ; current = path.dirname(current)) {
    assert.ok(!fs.existsSync(path.join(current, '.git')), 'Archiver writes only outside Git worktrees');
    if (path.dirname(current) === current) break;
  }
  return canonical;
}
function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function writeExact(root, name, bytes, artifacts) {
  relativeName(name);
  assert.ok(!name.toLowerCase().endsWith('.log'), 'Raw logs must be wrapped in JSON');
  assert.ok(bytes.length <= HARD_LIMIT, 'Archive file exceeds 2 MiB');
  const output = under(root, name);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  const entry = { file: name, bytes: bytes.length, sha256: hash(bytes) };
  artifacts.push(entry);
  return entry;
}
export function storePayload(root, name, bytes, artifacts) {
  if (bytes.length <= SPLIT_AT) return { kind: 'file', ...writeExact(root, name, bytes, artifacts) };
  const chunkBytes = Math.floor((SPLIT_AT - 4096) * 3 / 4);
  const total = Math.ceil(bytes.length / chunkBytes);
  const parts = [];
  for (let offset = 0, index = 0; offset < bytes.length; offset += chunkBytes, index++) {
    const part = bytes.subarray(offset, offset + chunkBytes);
    const payload = jsonBytes({ schema: 'asa.health-evidence-byte-part.v1', originalFile: name, index, total, offset, bytes: part.length, sha256: hash(part), encoding: 'base64', data: part.toString('base64') });
    parts.push(writeExact(root, name + '.part-' + String(index + 1).padStart(3, '0') + '.json', payload, artifacts));
  }
  return { kind: 'chunks', originalFile: name, bytes: bytes.length, sha256: hash(bytes), parts };
}
export function readPayload(root, descriptor) {
  let bytes;
  if (descriptor.kind === 'file') bytes = fs.readFileSync(under(root, descriptor.file));
  else {
    assert.equal(descriptor.kind, 'chunks', 'Unknown payload kind');
    let offset = 0;
    const chunks = descriptor.parts.map((entry, index) => {
      const encoded = fs.readFileSync(under(root, entry.file));
      assert.equal(encoded.length, entry.bytes); assert.equal(hash(encoded), entry.sha256);
      const part = JSON.parse(encoded);
      assert.equal(part.schema, 'asa.health-evidence-byte-part.v1');
      assert.equal(part.originalFile, descriptor.originalFile);
      assert.equal(part.index, index); assert.equal(part.total, descriptor.parts.length); assert.equal(part.offset, offset);
      assert.equal(part.encoding, 'base64');
      const chunk = Buffer.from(part.data, 'base64');
      assert.equal(chunk.toString('base64'), part.data); assert.equal(chunk.length, part.bytes); assert.equal(hash(chunk), part.sha256);
      offset += chunk.length;
      return chunk;
    });
    bytes = Buffer.concat(chunks);
  }
  assert.equal(bytes.length, descriptor.bytes); assert.equal(hash(bytes), descriptor.sha256);
  return bytes;
}
function pointer(value, tokens) {
  for (const token of tokens) { assert.ok(value != null && Object.hasOwn(value, token), 'Missing JSON pointer'); value = value[token]; }
  return value;
}
function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const required = mode === 'pack' ? ['performance', 'dependency', 'audit', 'tools', 'expected-head', 'out'] : mode === 'unpack' ? ['archive', 'out'] : mode === 'verify' ? ['archive'] : null;
  assert.ok(required, 'Use pack, verify or unpack');
  const allowed = new Set([...required, ...(mode === 'pack' ? ['pilot-check'] : ['manifest-sha'])]);
  const values = {};
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index].replace(/^--/, '');
    assert.equal(rest[index], '--' + key); assert.ok(allowed.has(key), 'Unknown argument ' + key); assert.ok(!Object.hasOwn(values, key), 'Duplicate argument');
    if (key === 'pilot-check') values[key] = true;
    else { values[key] = rest[++index]; assert.ok(values[key] && !values[key].startsWith('--'), 'Missing value for ' + key); }
  }
  for (const key of required) assert.ok(values[key], 'Required --' + key);
  return { mode, values };
}
function normalizeOrigin(value) {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}
function pack(args) {
  const expectedHead = args['expected-head'];
  assert.match(expectedHead, /^[a-f0-9]{40}$/, 'Expected exact full HEAD required');
  const performanceRoot = fs.realpathSync(args.performance);
  const toolsRoot = fs.realpathSync(args.tools);
  const dependencyPath = fs.realpathSync(args.dependency);
  const auditPath = fs.realpathSync(args.audit);
  const output = externalFresh(args.out);
  for (const root of [performanceRoot, toolsRoot]) assert.ok(!isInside(root, output) && !isInside(output, root), 'Output and inputs must be disjoint');
  const roots = { performance: performanceRoot, tools: toolsRoot, dependency: path.dirname(dependencyPath), audit: path.dirname(auditPath), archiver: path.dirname(SELF) };
  const inputs = [];
  let inputBytes = 0;
  function add(root, relative) {
    relativeName(relative);
    const file = under(roots[root], relative);
    inputBytes += fs.statSync(file).size;
    assert.ok(inputBytes <= MAX_INPUT_BYTES, 'Bounded evidence input budget exceeded');
    const bytes = fs.readFileSync(file);
    inputs.push({ id: root + '/' + relative, origin: file, bytes, sha256: hash(bytes) });
  }
  for (const name of inventory(performanceRoot)) add('performance', name);
  for (const name of inventory(toolsRoot)) add('tools', name);
  add('dependency', path.basename(dependencyPath)); add('audit', path.basename(auditPath)); add('archiver', path.basename(SELF));
  assert.ok(inputs.reduce((sum, item) => sum + item.bytes.length, 0) <= MAX_INPUT_BYTES, 'Bounded evidence input budget exceeded');
  const byId = new Map(inputs.map((item) => [item.id, item]));
  assert.equal(byId.size, inputs.length, 'Duplicate source IDs');
  const get = (id) => { const item = byId.get(id); assert.ok(item, 'Missing input ' + id); return item; };
  const perfInput = get('performance/performance-report.json');
  const depInput = get('dependency/' + path.basename(dependencyPath));
  const auditInput = get('audit/' + path.basename(auditPath));
  const performance = JSON.parse(perfInput.bytes), dependency = JSON.parse(depInput.bytes);
  assert.equal(performance.expectedHead, expectedHead); assert.equal(dependency.sourceHead, expectedHead);
  assert.equal(performance.acceptedBaseline, false, 'Archiver never confers baseline acceptance');
  assert.ok(['PASS', 'FAIL'].includes(performance.status) && typeof performance.endedAt === 'string', 'Only completed measurements may be archived; failed completed runs are retained');
  const pilot = performance.mode === 'pilot-tool-validation-not-accepted-baseline';
  assert.equal(Boolean(args['pilot-check']), pilot, 'Pilot requires explicit --pilot-check; it cannot become final evidence');
  if (!pilot) assert.equal(performance.mode, 'measurement-awaiting-audit-acceptance');
  assert.equal(dependency.capturedAudit.sha256, auditInput.sha256, 'Captured npm audit identity mismatch');
  assert.equal(dependency.capturedAudit.bytes, auditInput.bytes.length);
  assert.equal(performance.sourceBefore.lock.sha256, dependency.lock.sha256, 'Performance/dependency lock mismatch');
  const issues = [];
  const references = [];
  const byOrigin = new Map(inputs.map((item) => [normalizeOrigin(item.origin), item]));
  function reference(label, originalPath, sha256) {
    if (!originalPath) return;
    const item = byOrigin.get(normalizeOrigin(originalPath));
    assert.ok(item, 'Referenced receipt is absent: ' + label + ' / ' + originalPath);
    if (sha256) assert.equal(item.sha256, sha256, 'Referenced receipt hash mismatch: ' + label);
    references.push({ label, sourceId: item.id });
    return item;
  }
  for (const [label, source] of [['sourceBefore', performance.sourceBefore], ['sourceAfter', performance.sourceAfter]]) {
    if (!source) { issues.push(label + ' missing'); continue; }
    assert.equal(source.head, expectedHead);
    const item = reference(label, source.manifest, source.manifestSha256);
    const identity = JSON.parse(item.bytes);
    assert.equal(identity.head, expectedHead); assert.equal(identity.fingerprint, source.fingerprint); assert.equal(identity.lock.sha256, source.lock.sha256);
    if (!identity.checkoutClean) issues.push(label + ' checkout was not clean');
  }
  if (performance.status !== 'PASS') issues.push('Performance status is ' + performance.status + '; failures retained');
  if (performance.sourceBefore?.fingerprint !== performance.sourceAfter?.fingerprint) issues.push('Source fingerprint changed or postflight identity is missing');
  if (dependency.sourceFingerprintBefore !== dependency.sourceFingerprintAfter || dependency.sourceFingerprintBefore !== performance.sourceBefore.fingerprint) issues.push('Dependency graph/source fingerprint differs from performance source');
  if (!dependency.checkoutCleanBeforeAndAfter) issues.push('Dependency source was not clean');
  for (const [name, value] of Object.entries(performance.guards ?? {})) if (value !== true) issues.push('Performance guard not PASS: ' + name);
  for (const [name, sha256] of Object.entries(PINNED)) assert.equal(get('tools/' + name).sha256, sha256, 'Frozen tool changed: ' + name);
  for (const item of performance.tools) {
    assert.equal(item.sha256, PINNED[item.name]); assert.equal(item.bytes, get('tools/' + item.name).bytes.length);
    assert.equal(get('performance/tool-source/' + item.name).sha256, item.sha256);
  }
  for (const [index, phase] of performance.phases.entries()) {
    reference('phases/' + index + '/config', phase.configPath, phase.configSha256);
    reference('phases/' + index + '/stdout', phase.stdout?.path, phase.stdout?.sha256);
    reference('phases/' + index + '/stderr', phase.stderr?.path, phase.stderr?.sha256);
    reference('phases/' + index + '/report', phase.reportPath, phase.reportSha256);
  }
  fs.mkdirSync(output, { recursive: true });
  const artifacts = [], payloads = {}, storageByHash = new Map(), sources = [], blobs = {};
  function direct(id, name, input) {
    payloads[id] = storePayload(output, name, input.bytes, artifacts);
    storageByHash.set(input.sha256, { kind: 'payload', payload: id });
  }
  direct('performance', 'performance-report.json', perfInput);
  direct('dependency', 'dependency-report.json', depInput);
  direct('audit', 'dependency-audit-input.json', auditInput);
  for (const name of Object.keys(PINNED)) direct('tool:' + name, 'harness/' + name, get('tools/' + name));
  direct('archiver', 'harness/evidence-archiver.mjs', get('archiver/' + path.basename(SELF)));
  for (const [index, phase] of performance.phases.entries()) {
    if (!phase.worker) continue;
    const serialized = jsonBytes(phase.worker);
    const item = byOrigin.get(normalizeOrigin(phase.reportPath ?? ''));
    if (item && serialized.equals(item.bytes)) storageByHash.set(item.sha256, { kind: 'json-pointer', payload: 'performance', pointer: ['phases', index, 'worker'], serialization: 'json-indent-2-lf' });
  }
  for (const item of inputs) {
    let storage = storageByHash.get(item.sha256);
    if (!storage) {
      const text = item.bytes.toString('utf8');
      const utf8 = Buffer.from(text).equals(item.bytes);
      blobs[item.sha256] = { bytes: item.bytes.length, sha256: item.sha256, encoding: utf8 ? 'utf8' : 'base64', data: utf8 ? text : item.bytes.toString('base64') };
      storage = { kind: 'receipt', key: item.sha256 };
      storageByHash.set(item.sha256, storage);
    }
    sources.push({ id: item.id, bytes: item.bytes.length, sha256: item.sha256, storage });
  }
  payloads.receipts = storePayload(output, 'raw-receipts.json', jsonBytes({ schema: 'asa.health-evidence-raw-receipts.v1', blobs }), artifacts);
  const cases = performance.phases.flatMap((phase) => phase.worker?.cases ?? []);
  const samples = cases.flatMap((entry) => entry.samples ?? []), warmups = cases.flatMap((entry) => entry.warmups ?? []);
  const manifest = {
    schema: SCHEMA, expectedHead, acceptedBaseline: false,
    purpose: pilot ? 'PACK_UNPACK_VALIDATION_ONLY_NOT_ACCEPTED_BASELINE' : 'MEASUREMENT_EVIDENCE_AWAITING_AUDIT_ACCEPTANCE',
    sourceOutcome: performance.status, dependencyOutcome: dependency.status,
    archiveEligibility: { status: issues.length ? 'BLOCKED_FOR_ACCEPTANCE' : 'IDENTITY_CHECKS_PASS_ACCEPTANCE_NOT_GRANTED', issues },
    originals: { roots, totalFiles: inputs.length, totalBytes: inputs.reduce((sum, item) => sum + item.bytes.length, 0) },
    rawCounts: { phases: performance.phases.length, cases: cases.length, samples: samples.length, warmups: warmups.length, failedSamples: samples.filter((sample) => sample.status !== 'PASS').length, failedWarmups: warmups.filter((sample) => sample.status !== 'PASS').length },
    payloads, sources, references, artifacts: artifacts.sort((a, b) => a.file.localeCompare(b.file)),
    packaging: { lossless: true, splitOnlyAboveBytes: SPLIT_AT, hardFileLimitBytes: HARD_LIMIT, logsWrappedAsJson: true, originalAbsolutePathsAreProvenanceOnly: true, lookup: 'Every original file is addressed by sources[].id and storage; references[] resolves report receipt paths. Unpack restores all bytes under root aliases without original locations.' },
    reproduction: {
      prerequisite: 'Clean repository checkout at expectedHead with the recorded lock/runtime asset identity and installed dependencies; copy harness outside the checkout.',
      performance: { sourceId: 'tools/performance-runner.mjs', requiredArguments: ['--repo', '--expected-head', '--out'], expectedHead, pilotFlagRequired: pilot },
      dependency: { sourceId: 'tools/dependency-classifier.mjs', requiredArguments: ['--repo', '--expected-head', '--audit', '--out'], auditSourceId: auditInput.id, expectedHead },
      archivedInputs: 'All original configs, corpus documents, stdout/stderr, worker reports and source-before/after manifests are included; no Temp-only evidence dependency.',
      readerGuide: 'Full report: phases[].worker.cases[].samples / warmups / summary and coldSummary. Nothing is filtered by PASS status.',
    },
    limitations: [
      'No benchmark, npm audit, browser, server or product operation is executed by this archiver.',
      'Fresh Node process WASM timing is not browser cold-start and not OS disk-cache cold. Browser cold-start remains NOT_RUN.',
      'No product performance SLO is inferred from this host.',
      'Known vendor P2 leak findings remain OPEN. Dispose bookkeeping and process exit are not proof of native/WASM heap cleanliness.',
      'Source reports remain byte-identical and retain their original acceptance/status fields; packaging never grants acceptance.',
    ],
  };
  for (const item of inputs) assert.equal(hash(fs.readFileSync(item.origin)), item.sha256, 'Input changed while packaging: ' + item.id);
  assert.deepEqual(inventory(performanceRoot), inputs.filter((item) => item.id.startsWith('performance/')).map((item) => item.id.slice('performance/'.length)).sort(), 'Performance input file set changed while packaging');
  assert.deepEqual(inventory(toolsRoot), inputs.filter((item) => item.id.startsWith('tools/')).map((item) => item.id.slice('tools/'.length)).sort(), 'Tool input file set changed while packaging');
  const manifestBytes = jsonBytes(manifest);
  assert.ok(manifestBytes.length <= HARD_LIMIT, 'Manifest exceeds 2 MiB');
  fs.writeFileSync(path.join(output, 'manifest.json'), manifestBytes, { flag: 'wx' });
  const checked = verify(output, hash(manifestBytes));
  console.log(JSON.stringify({ operation: 'pack', result: 'LOSSLESS_VERIFIED', acceptedBaseline: false, expectedHead, sourceOutcome: performance.status, purpose: manifest.purpose, archiveEligibility: manifest.archiveEligibility, archive: output, archiveFiles: artifacts.length + 1, originalFiles: inputs.length, largestArchiveFileBytes: Math.max(manifestBytes.length, ...artifacts.map((item) => item.bytes)), manifestSha256: checked.manifestSha256, restoredInputBytesVerified: checked.totalBytes }, null, 2));
}
function verify(archive, expectedManifestSha) {
  archive = fs.realpathSync(archive);
  const manifestBytes = fs.readFileSync(path.join(archive, 'manifest.json'));
  if (expectedManifestSha) { assert.match(expectedManifestSha, /^[a-f0-9]{64}$/); assert.equal(hash(manifestBytes), expectedManifestSha, 'Manifest trust hash mismatch'); }
  assert.ok(manifestBytes.length <= HARD_LIMIT);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema, SCHEMA); assert.equal(manifest.acceptedBaseline, false);
  assert.match(manifest.expectedHead, /^[a-f0-9]{40}$/);
  const expectedFiles = ['manifest.json', ...manifest.artifacts.map((item) => relativeName(item.file))].sort();
  assert.deepEqual(inventory(archive), expectedFiles, 'Unexpected or missing archive files');
  for (const artifact of manifest.artifacts) {
    const bytes = fs.readFileSync(under(archive, artifact.file));
    assert.ok(!artifact.file.toLowerCase().endsWith('.log')); assert.ok(bytes.length <= HARD_LIMIT);
    assert.equal(bytes.length, artifact.bytes); assert.equal(hash(bytes), artifact.sha256, 'Archive payload hash mismatch: ' + artifact.file);
  }
  const payloadCache = new Map();
  const payload = (name) => { if (!payloadCache.has(name)) { assert.ok(Object.hasOwn(manifest.payloads, name)); payloadCache.set(name, readPayload(archive, manifest.payloads[name])); } return payloadCache.get(name); };
  const receipts = JSON.parse(payload('receipts')).blobs;
  const inputs = new Map(), portableIds = new Set();
  for (const source of manifest.sources) {
    relativeName(source.id); assert.ok(!portableIds.has(source.id.toLowerCase()), 'Duplicate/case-colliding source ID'); portableIds.add(source.id.toLowerCase());
    let bytes;
    const storage = source.storage;
    if (storage.kind === 'payload') bytes = payload(storage.payload);
    else if (storage.kind === 'json-pointer') {
      assert.equal(storage.serialization, 'json-indent-2-lf');
      bytes = jsonBytes(pointer(JSON.parse(payload(storage.payload)), storage.pointer));
    } else {
      assert.equal(storage.kind, 'receipt');
      const receipt = receipts[storage.key]; assert.ok(receipt);
      assert.ok(['utf8', 'base64'].includes(receipt.encoding));
      bytes = Buffer.from(receipt.data, receipt.encoding);
      assert.equal(bytes.length, receipt.bytes); assert.equal(hash(bytes), receipt.sha256);
    }
    assert.equal(bytes.length, source.bytes); assert.equal(hash(bytes), source.sha256, 'Original input reconstruction mismatch: ' + source.id);
    inputs.set(source.id, bytes);
  }
  const performance = JSON.parse(payload('performance')), dependency = JSON.parse(payload('dependency'));
  assert.equal(performance.expectedHead, manifest.expectedHead); assert.equal(dependency.sourceHead, manifest.expectedHead);
  assert.equal(performance.acceptedBaseline, false); assert.equal(hash(payload('audit')), dependency.capturedAudit.sha256);
  for (const [name, sha256] of Object.entries(PINNED)) assert.equal(hash(payload('tool:' + name)), sha256);
  assert.equal(inputs.size, manifest.originals.totalFiles);
  const totalBytes = [...inputs.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  assert.equal(totalBytes, manifest.originals.totalBytes);
  return { archive, manifest, manifestSha256: hash(manifestBytes), inputs, totalBytes };
}
export function main(argv = process.argv.slice(2)) {
  const { mode, values } = parseArgs(argv);
  if (mode === 'pack') return pack(values);
  const checked = verify(values.archive, values['manifest-sha']);
  if (mode === 'unpack') {
    const output = externalFresh(values.out);
    assert.ok(!isInside(checked.archive, output) && !isInside(output, checked.archive), 'Archive/unpack locations must be disjoint');
    fs.mkdirSync(output, { recursive: true });
    for (const [id, bytes] of checked.inputs) {
      const target = under(output, id);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: 'wx' });
      assert.ok(fs.readFileSync(target).equals(bytes), 'Restored file mismatch');
    }
    assert.deepEqual(inventory(output), [...checked.inputs.keys()].sort());
    console.log(JSON.stringify({ operation: mode, result: 'LOSSLESS_RESTORED', acceptedBaseline: false, expectedHead: checked.manifest.expectedHead, output, originalFiles: checked.inputs.size, totalBytes: checked.totalBytes, manifestSha256: checked.manifestSha256 }, null, 2));
  } else console.log(JSON.stringify({ operation: mode, result: 'LOSSLESS_VERIFIED', acceptedBaseline: false, expectedHead: checked.manifest.expectedHead, originalFiles: checked.inputs.size, totalBytes: checked.totalBytes, manifestSha256: checked.manifestSha256 }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  try { main(); } catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}
