import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { environment, errorData, flags, git, hashFile, outsideRepo, sourceIdentity, summarize, writeJson } from './performance-common.mjs';

const args = flags(process.argv.slice(2), ['--repo', '--expected-head', '--out'], ['--pilot']);
const repo = fs.realpathSync(args['--repo']);
const expectedHead = args['--expected-head'];
const directory = outsideRepo(repo, args['--out']);
assert.equal(fs.existsSync(directory), false, 'Output must be a new directory; receipts are never overwritten');
const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
outsideRepo(repo, toolDirectory);
const sourceBefore = sourceIdentity(repo, expectedHead);
const mode = args['--pilot'] ? 'pilot-tool-validation-not-accepted-baseline' : 'measurement-awaiting-audit-acceptance';
const samples = args['--pilot'] ? 2 : 10;
const warmups = args['--pilot'] ? 1 : 2;
const sizes = args['--pilot'] ? [4, 16] : [8, 32, 128];
const toolNames = ['performance-runner.mjs', 'performance-worker.mjs', 'performance-fixtures.mjs', 'performance-common.mjs'];
const toolBefore = toolNames.map((name) => ({ name, sha256: hashFile(path.join(toolDirectory, name)), bytes: fs.statSync(path.join(toolDirectory, name)).size }));
fs.mkdirSync(directory, { recursive: false });
fs.mkdirSync(path.join(directory, 'tool-source'));
for (const name of toolNames) fs.copyFileSync(path.join(toolDirectory, name), path.join(directory, 'tool-source', name), fs.constants.COPYFILE_EXCL);
writeJson(path.join(directory, 'source-before.json'), sourceBefore);
const started = performance.now();
const report = {
  schemaVersion: 1, tool: 'ASA bounded performance audit', mode, acceptedBaseline: false,
  repo, expectedHead, startedAt: new Date().toISOString(), status: 'RUNNING', environment: environment(),
  parameters: { samples, warmups, sizes, coldFreshProcessesPerBackend: 3 },
  protocol: {
    clock: 'node:perf_hooks performance.now, milliseconds',
    warmupPolicy: 'Explicit, bounded, recorded separately; correctness checked',
    failures: 'Failed attempts retained; statistics include every finite recorded metric, including failures',
    startup: 'Fresh Node processes, not browser startup and not OS disk-cache cold',
    solveCache: 'Direct PlaneGCSSketchSolverRuntime; no BrowserSketchSolverAdapter LRU',
    scope: 'No browser, network, server, product changes or installation',
    thresholds: 'No performance SLO or pass/fail latency threshold; only correctness/identity/cleanup gates',
    sampling: 'Sequential workers; CPU/memory/OS cache state uncontrolled and recorded as limitations',
  },
  sourceBefore: { fingerprint: sourceBefore.fingerprint, head: sourceBefore.head, lock: sourceBefore.lock, manifest: path.join(directory, 'source-before.json'), manifestSha256: hashFile(path.join(directory, 'source-before.json')) },
  families: ['solve', 'history', 'serialization', 'wasm-cold-init', 'protected-part'],
  tools: toolBefore, phases: [], coldSummary: {}, guards: {},
};
const reportFile = path.join(directory, 'performance-report.json');
const flush = () => writeJson(reportFile, report);
const phases = [
  ...['solve', 'history', 'serialization', 'protected-part'].map((family) => ({ family, name: family, samples, warmups, sizes })),
  ...['cold-planegcs', 'cold-occ'].flatMap((family) => [1, 2, 3].map((index) => ({ family, name: family + '-' + index, samples: 1, warmups: 0, sizes: [1] }))),
];
flush();

try {
  for (const phase of phases) {
    assert.ok(performance.now() - started < 8 * 60_000, 'Bounded total execution budget exhausted');
    assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), expectedHead);
    assert.equal(git(repo, ['status', '--porcelain=v1', '--untracked-files=all']).trim(), '', 'Source changed between phases');
    const phaseDirectory = path.join(directory, phase.name);
    fs.mkdirSync(phaseDirectory);
    const config = {
      repo, expectedHead, sourceFingerprint: sourceBefore.fingerprint, mode, ...phase,
      directory: phaseDirectory, reportPath: path.join(phaseDirectory, 'worker-report.json'),
    };
    const configPath = path.join(phaseDirectory, 'config.json');
    writeJson(configPath, config);
    console.log('START ' + phase.name);
    const start = performance.now();
    const child = spawnSync(process.execPath, [
      '--import', pathToFileURL(path.join(repo, 'vendor/toubkal/node_modules/tsx/dist/loader.mjs')).href,
      path.join(toolDirectory, 'performance-worker.mjs'), configPath,
    ], {
      cwd: repo, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      timeout: phase.family === 'protected-part' ? 120_000 : 90_000,
      env: { ...process.env, NO_COLOR: '1', TSX_DISABLE_CACHE: '1' },
    });
    const stdoutPath = path.join(phaseDirectory, 'stdout.log');
    const stderrPath = path.join(phaseDirectory, 'stderr.log');
    fs.writeFileSync(stdoutPath, child.stdout ?? '');
    fs.writeFileSync(stderrPath, child.stderr ?? '');
    const result = {
      name: phase.name, family: phase.family, pid: child.pid, exitCode: child.status, signal: child.signal,
      elapsedMs: performance.now() - start, status: 'FAIL', processReturned: true,
      timedOut: child.error?.code === 'ETIMEDOUT', spawnError: child.error ? errorData(child.error) : null,
      configPath, configSha256: hashFile(configPath),
      stdout: { path: stdoutPath, sha256: hashFile(stdoutPath) },
      stderr: { path: stderrPath, sha256: hashFile(stderrPath) },
    };
    if (fs.existsSync(config.reportPath)) {
      result.reportPath = config.reportPath;
      result.reportSha256 = hashFile(config.reportPath);
      try {
        const worker = JSON.parse(fs.readFileSync(config.reportPath, 'utf8'));
        result.worker = worker;
        assert.equal(worker.sourceHead, expectedHead);
        assert.equal(worker.sourceFingerprint, sourceBefore.fingerprint);
        assert.equal(worker.pid, child.pid, 'Worker identity mismatch');
        assert.equal(worker.status, 'PASS');
        assert.equal(worker.resources.remaining, 0);
        assert.deepEqual(worker.resources.disposalErrors, []);
        const expectedCases = ['solve', 'history', 'serialization'].includes(phase.family) ? sizes.length : 1;
        assert.equal(worker.cases.length, expectedCases);
        for (const entry of worker.cases) {
          assert.equal(entry.status, 'PASS');
          assert.equal(entry.samples.length, phase.samples);
          assert.equal(entry.warmups.length, phase.warmups);
          assert.equal(entry.unattemptedSamples, 0);
          assert.ok([...entry.samples, ...entry.warmups].every((sample) => sample.status === 'PASS'));
        }
        assert.equal(child.status, 0);
        assert.equal(child.error, undefined);
        assert.equal(child.signal, null);
        result.status = 'PASS';
      } catch (error) { result.validationError = errorData(error); }
    }
    report.phases.push(result);
    flush();
    console.log('END ' + phase.name + ' ' + result.status + ' ' + result.elapsedMs.toFixed(1) + ' ms');
  }
} catch (error) {
  report.executionError = errorData(error);
} finally {
  try {
    const after = sourceIdentity(repo, expectedHead);
    writeJson(path.join(directory, 'source-after.json'), after);
    report.sourceAfter = { fingerprint: after.fingerprint, head: after.head, lock: after.lock, manifest: path.join(directory, 'source-after.json'), manifestSha256: hashFile(path.join(directory, 'source-after.json')) };
    report.guards.sourceUnchanged = after.fingerprint === sourceBefore.fingerprint;
    report.guards.checkoutClean = after.checkoutClean;
    assert.equal(after.fingerprint, sourceBefore.fingerprint, 'Source/lock/runtime assets changed during measurement');
    const toolAfter = toolNames.map((name) => ({ name, sha256: hashFile(path.join(toolDirectory, name)), bytes: fs.statSync(path.join(toolDirectory, name)).size }));
    assert.deepEqual(toolAfter, toolBefore, 'Audit tool changed during measurement');
    report.guards.toolUnchanged = true;
  } catch (error) { report.postflightError = errorData(error); }
  for (const family of ['cold-planegcs', 'cold-occ']) {
    const familyPhases = report.phases.filter((phase) => phase.family === family);
    const raw = familyPhases.flatMap((phase) => phase.worker?.cases?.flatMap((entry) => entry.samples) ?? []);
    const pids = familyPhases.map((phase) => phase.pid);
    report.coldSummary[family] = { requiredProcesses: 3, observedProcesses: pids, distinctProcesses: new Set(pids).size, samples: raw, summary: summarize(raw) };
  }
  report.familyResults = Object.fromEntries(report.families.map((family) => {
    const members = report.phases.filter((phase) => family === 'wasm-cold-init' ? phase.family.startsWith('cold-') : phase.family === family);
    const expected = family === 'wasm-cold-init' ? 6 : 1;
    return [family, { status: members.length === expected && members.every((phase) => phase.status === 'PASS') ? 'PASS' : 'FAIL', expectedPhases: expected, observedPhases: members.length }];
  }));
  const coldPids = report.phases.filter((phase) => phase.family.startsWith('cold-')).map((phase) => phase.pid);
  report.guards.sixDistinctFreshColdProcesses = coldPids.length === 6 && new Set(coldPids).size === 6;
  report.guards.allOwnedWorkersExitedSuccessfully = report.phases.length === phases.length && report.phases.every((phase) => phase.exitCode === 0 && !phase.signal && !phase.timedOut);
  report.guards.noOwnedBrowserOrServer = true;
  report.status = !report.executionError && !report.postflightError
    && report.phases.length === phases.length && report.phases.every((phase) => phase.status === 'PASS')
    && Object.values(report.guards).every((value) => value === true) ? 'PASS' : 'FAIL';
  report.endedAt = new Date().toISOString();
  report.elapsedMs = performance.now() - started;
  flush();
}
console.log(JSON.stringify({ status: report.status, mode, acceptedBaseline: false, reportPath: reportFile, reportSha256: hashFile(reportFile), guards: report.guards, phases: report.phases.map(({ name, status, pid, elapsedMs }) => ({ name, status, pid, elapsedMs })) }, null, 2));
process.exitCode = report.status === 'PASS' ? 0 : 1;
