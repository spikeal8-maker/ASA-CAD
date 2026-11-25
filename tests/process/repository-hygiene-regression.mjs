import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const check = resolve('tests/process/repository-hygiene.mjs');
const policy = resolve('spec/process/repository-health.v1.json');
const temp = mkdtempSync(join(tmpdir(), 'asa-hygiene-'));
const git = (...args) => execFileSync('git', args, { cwd: temp, stdio: 'pipe' });
const run = () => spawnSync(process.execPath, [check], { cwd: temp, encoding: 'utf8' });
try {
  git('init');
  mkdirSync(join(temp, 'spec/process'), { recursive: true });
  copyFileSync(policy, join(temp, 'spec/process/repository-health.v1.json'));
  writeFileSync(join(temp, '.gitignore'), 'dist/\n*.log\n');
  mkdirSync(join(temp, 'dist'));
  writeFileSync(join(temp, 'dist/runtime.wasm'), Buffer.alloc(3 * 1024 * 1024));
  assert.equal(run().status, 0, 'ignored local build must not block source hygiene');
  writeFileSync(join(temp, 'source.tmp'), 'temporary source artifact');
  const untracked = run();
  assert.notEqual(untracked.status, 0);
  assert.match(untracked.stderr, /source\.tmp: forbidden temporary/);
  rmSync(join(temp, 'source.tmp'));
  writeFileSync(join(temp, 'dist/small.js'), 'export const generated = true;');
  git('add', '-f', 'dist/small.js');
  const trackedBuild = run();
  assert.notEqual(trackedBuild.status, 0);
  assert.match(trackedBuild.stderr, /tracked generated-output directory dist/);
  git('reset');
  writeFileSync(join(temp, 'debug.log'), 'tracked log');
  git('add', '-f', 'debug.log');
  const trackedLog = run();
  assert.notEqual(trackedLog.status, 0);
  assert.match(trackedLog.stderr, /debug\.log: forbidden temporary/);
  console.log('Repository hygiene regression PASS (ignored build allowed; new junk and forced tracked artifacts rejected)');
} finally { rmSync(temp, { recursive: true, force: true }); }
