import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const policyPath = 'spec/process/repository-health.v1.json';
assert.ok(fs.existsSync(policyPath), `${policyPath} must remain present`);

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const hygiene = policy.repositoryHygiene;
assert.ok(hygiene, 'repositoryHygiene policy must be defined');

const excludedPrefixes = hygiene.excludedPrefixes ?? [];
const forbiddenBasenames = new Set(hygiene.forbiddenBasenames ?? []);
const forbiddenSuffixes = hygiene.forbiddenSuffixes ?? [];
const forbiddenDirectoryNames = new Set(hygiene.forbiddenDirectoryNames ?? []);
const temporaryToolName = new RegExp(hygiene.temporaryToolNamePattern, 'i');
const largeReviewBytes = Number(hygiene.firstPartyLargeFileReviewBytes);
const hardFileBytes = Number(hygiene.firstPartyHardFileBytes);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.css', '.html']);

const offenders = [];
const warnings = [];
let checked = 0;

walk('.', (file) => {
  const normalized = normalize(file).replace(/^\.\//, '');
  if (!normalized || isExcluded(normalized)) return;

  checked += 1;
  const basename = path.basename(normalized);
  const segments = normalized.split('/');

  if (forbiddenBasenames.has(basename)) {
    offenders.push(`${normalized}: forbidden system/editor artifact`);
  }

  const suffix = forbiddenSuffixes.find((candidate) => basename.endsWith(candidate));
  if (suffix) {
    offenders.push(`${normalized}: forbidden temporary/output suffix ${suffix}`);
  }

  const forbiddenDirectory = segments.slice(0, -1).find((segment) => forbiddenDirectoryNames.has(segment));
  if (forbiddenDirectory) {
    offenders.push(`${normalized}: tracked generated-output directory ${forbiddenDirectory}`);
  }

  const temporaryToolRoot =
    normalized.startsWith('.github/workflows/') ||
    normalized.startsWith('scripts/') ||
    normalized.startsWith('tools/');
  if (temporaryToolRoot && temporaryToolName.test(normalized)) {
    offenders.push(`${normalized}: temporary codemod/review-fix artifact must not remain in review`);
  }

  if (textExtensions.has(path.extname(normalized).toLowerCase())) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('\uFFFD') || hasLikelyCyrillicMojibake(text)) {
      offenders.push(`${normalized}: invalid UTF-8 or likely Cyrillic mojibake`);
    }
  }

  const size = fs.statSync(file).size;
  if (size > hardFileBytes) {
    offenders.push(
      `${normalized}: ${size} bytes exceeds first-party hard file size ${hardFileBytes}; use an explicit external/fixture strategy instead of committing a large artifact`,
    );
  } else if (size > largeReviewBytes) {
    warnings.push(
      `${normalized}: ${size} bytes exceeds ${largeReviewBytes}-byte first-party large-file review threshold`,
    );
  }
});

assert.deepEqual(
  offenders,
  [],
  `Repository hygiene violations must be removed before review:\n${offenders.join('\n')}`,
);

for (const warning of warnings) console.warn(`Repository hygiene warning: ${warning}`);
console.log(`ASA-CAD repository hygiene PASS (${checked} first-party files checked).`);

function isExcluded(file) {
  return excludedPrefixes.some((prefix) => file === prefix.replace(/\/$/, '') || file.startsWith(prefix));
}

function normalize(file) {
  return file.replaceAll('\\', '/');
}

function hasLikelyCyrillicMojibake(text) {
  for (let index = 0; index + 3 < text.length; index += 1) {
    const a = text.charCodeAt(index), b = text.charCodeAt(index + 1);
    const c = text.charCodeAt(index + 2), d = text.charCodeAt(index + 3);
    if ((a === 0x420 || a === 0x421) && b > 0x7f && (c === 0x420 || c === 0x421) && d > 0x7f) return true;
  }
  return false;
}

function walk(root, visit) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    const normalized = normalize(full).replace(/^\.\//, '');
    if (entry.isDirectory()) {
      if (isExcluded(`${normalized}/`)) continue;
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}
