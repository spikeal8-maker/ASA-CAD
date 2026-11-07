import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const hashFile = (file) => hash(fs.readFileSync(file));
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
export const errorData = (error) => ({ name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null });

export function flags(args, required, booleanKeys = []) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    assert.ok(key.startsWith('--'), 'Expected named flag: ' + key);
    assert.equal(result[key], undefined, 'Duplicate flag ' + key);
    if (booleanKeys.includes(key)) result[key] = true;
    else {
      assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing value for ' + key);
      result[key] = args[++i];
    }
  }
  for (const key of required) assert.ok(result[key], 'Required flag ' + key);
  const allowed = new Set([...required, ...booleanKeys]);
  for (const key of Object.keys(result)) assert.ok(allowed.has(key), 'Unknown flag ' + key);
  return result;
}

export function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, 'git ' + args.join(' ') + ': ' + (result.stderr || result.error?.message));
  return result.stdout;
}

export function outsideRepo(repo, target) {
  const resolved = path.resolve(target);
  let existing = resolved;
  const missing = [];
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    assert.notEqual(parent, existing, 'Cannot resolve target ancestor');
    existing = parent;
  }
  const actual = path.join(fs.realpathSync(existing), ...missing);
  const relative = path.relative(fs.realpathSync(repo), actual);
  assert.ok(relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative), 'Evidence/tool output must stay outside repository');
  return actual;
}

function entries(repo, paths) {
  return [...new Set(paths)].sort().map((relative) => {
    const absolute = path.join(repo, relative);
    const bytes = fs.readFileSync(absolute);
    return { path: relative.replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) };
  });
}
function distFiles(repo, relative) {
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(path.join(repo, directory), { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, 'Runtime dist symlink is not supported');
      const next = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (/\.(?:wasm|js|mjs|cjs|json)$/.test(entry.name)) result.push(next);
      assert.ok(result.length <= 256, 'Unexpected runtime asset count');
    }
  };
  visit(relative);
  return result;
}

export function sourceIdentity(repo, expectedHead) {
  assert.match(expectedHead, /^[0-9a-f]{40}$/);
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), expectedHead, 'Exact HEAD changed');
  assert.equal(git(repo, ['status', '--porcelain=v1', '--untracked-files=all']).trim(), '', 'Repository must be clean, including untracked files');
  const lockPath = 'vendor/toubkal/package-lock.json';
  const lockBytes = fs.readFileSync(path.join(repo, lockPath));
  const lock = JSON.parse(lockBytes);
  assert.deepEqual(lock, JSON.parse(git(repo, ['show', expectedHead + ':' + lockPath])), 'Lock content differs from committed HEAD');
  const installed = ['@salusoft89/planegcs', 'opencascade.js', 'tsx', 'esbuild', 'typescript'].map((name) => {
    const relative = 'vendor/toubkal/node_modules/' + name + '/package.json';
    const bytes = fs.readFileSync(path.join(repo, relative));
    const pkg = JSON.parse(bytes);
    assert.equal(pkg.version, lock.packages['node_modules/' + name]?.version, 'Installed version differs from lock: ' + name);
    return { name, version: pkg.version, packageJsonSha256: hash(bytes) };
  });
  const tracked = git(repo, ['ls-files', '-z', '--', 'src', 'vendor/toubkal/src', 'build', 'tests/m1', 'tests/m1b', 'tests/m2o', 'tests/fixtures', 'package.json', 'vendor/toubkal/package.json', lockPath])
    .split('\0').filter(Boolean);
  assert.ok(tracked.length > 100 && tracked.length < 5000, 'Unexpected tracked source count');
  const assets = [
    ...distFiles(repo, 'vendor/toubkal/node_modules/@salusoft89/planegcs/dist'),
    ...distFiles(repo, 'vendor/toubkal/node_modules/opencascade.js/dist'),
    'vendor/toubkal/node_modules/tsx/dist/loader.mjs',
  ];
  const identity = {
    head: expectedHead,
    branch: git(repo, ['branch', '--show-current']).trim(),
    checkoutClean: true,
    lock: { path: lockPath, bytes: lockBytes.length, sha256: hash(lockBytes), lockfileVersion: lock.lockfileVersion },
    installed,
    sourceFiles: entries(repo, tracked),
    runtimeAssets: entries(repo, assets),
  };
  return { ...identity, fingerprint: hash(JSON.stringify(identity)) };
}

export function environment() {
  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(), nodeExecutable: process.execPath, node: process.version,
    versions: process.versions, platform: process.platform, arch: process.arch,
    osRelease: os.release(), cpuModel: cpus[0]?.model ?? null, logicalCpuCount: cpus.length,
    totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(),
    notes: ['No CPU affinity or frequency lock', 'No forced GC', 'No OS page/disk cache reset', 'No production latency SLO inferred'],
  };
}

export function summarize(samples) {
  const keys = new Set(samples.flatMap((sample) => Object.keys(sample.metrics ?? {})));
  const result = {};
  for (const key of keys) {
    const measured = samples.map((sample) => sample.metrics?.[key]).filter(Number.isFinite).sort((a, b) => a - b);
    const n = measured.length;
    result[key] = {
      recorded: n, attempted: samples.length, includesFailedAttempts: true,
      min: n ? measured[0] : null, max: n ? measured[n - 1] : null,
      median: n ? (measured[Math.floor((n - 1) / 2)] + measured[Math.floor(n / 2)]) / 2 : null,
    };
  }
  return result;
}
