import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { report: { type: 'string' }, out: { type: 'string' } },
});
assert.ok(values.report && values.out, 'Provide --report and --out for the actual ESLint JSON');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendor = fs.realpathSync(path.join(root, 'vendor/toubkal'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalized = (name) => name.replaceAll(path.sep, '/');
const relativeSource = (absolute) => {
  assert.ok(path.isAbsolute(absolute), 'ESLint must identify an absolute source path');
  const relative = path.relative(vendor, fs.realpathSync(absolute));
  assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative), 'ESLint result must stay inside the vendored source root');
  return normalized(relative);
};

// This independent inventory mirrors eslint.config.js without using minimatch:
// tracked TS/TSX in src and rspack.config.ts, excluding the explicit WASM prefix.
const tracked = execFileSync('git',
  ['ls-files', '-z', '--', 'vendor/toubkal/src', 'vendor/toubkal/rspack.config.ts'],
  { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const expected = tracked.map((name) => name.slice('vendor/toubkal/'.length))
  .filter((name) => /\.tsx?$/.test(name) && !name.startsWith('src/services/solver/wasm/'))
  .sort();
assert.ok(expected.length > 0, 'The independent source inventory must not be empty');

const raw = fs.readFileSync(values.report);
const results = JSON.parse(raw.toString('utf8'));
assert.ok(Array.isArray(results) && results.length > 0, 'ESLint report must contain actual file results');
const actual = [];
let warnings = 0;
for (const result of results) {
  const name = relativeSource(result.filePath);
  actual.push(name);
  assert.ok(Array.isArray(result.messages), 'Every lint result must contain diagnostics');
  assert.ok(Number.isInteger(result.warningCount) && result.warningCount >= 0);
  warnings += result.warningCount;
  for (const message of result.messages) {
    assert.equal(/file ignored|no matching configuration/i.test(message.message), false,
      name + ': an ignored-file record cannot prove lint coverage');
    console.warn(name + ':' + (message.line ?? 0) + ':' + (message.column ?? 0)
      + ' ' + (message.severity === 2 ? 'error' : 'warning') + ' ' + message.message
      + (message.ruleId ? ' (' + message.ruleId + ')' : ''));
  }
  assert.equal(result.errorCount, 0, name + ': lint errors must remain blocking');
  assert.equal(result.fatalErrorCount, 0, name + ': fatal lint errors must remain blocking');
  assert.equal(result.messages.some((message) => message.severity === 2), false,
    name + ': an error diagnostic cannot be hidden by counts');
}
assert.equal(new Set(actual).size, actual.length, 'Duplicate lint records cannot replace a missing file');
actual.sort();
assert.deepEqual(actual, expected, 'ESLint must check exactly the independently enumerated source files');
const filesSha256 = sha256(actual.join('\n') + '\n');
const report = {
  schemaVersion: 1, status: 'PASS', head: git('rev-parse', 'HEAD'),
  platform: process.platform, node: process.version,
  checkedFiles: actual.length, errors: 0, warnings, filesSha256, files: actual,
  actualLintReportSha256: sha256(raw),
  eslintConfigSha256: sha256(fs.readFileSync(path.join(vendor, 'eslint.config.js'))),
  packageSha256: sha256(fs.readFileSync(path.join(vendor, 'package.json'))),
  lockSha256: sha256(fs.readFileSync(path.join(vendor, 'package-lock.json'))),
  checkerSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.writeFileSync(values.out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log('Vendor lint coverage PASS: ' + actual.length + ' files, 0 errors, '
  + warnings + ' warnings; file-set SHA256 ' + filesSha256);
