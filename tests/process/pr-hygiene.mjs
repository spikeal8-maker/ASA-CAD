import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const policyPath = 'spec/process/repository-health.v1.json';
assert.ok(fs.existsSync(policyPath), `${policyPath} must remain present`);
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

const footprint = policy.changeFootprint ?? {};
const hygiene = policy.repositoryHygiene ?? {};
const maxReviewCommits = Number(footprint.maxReviewCommits ?? 6);

const commitCount = Number(process.env.ASA_PR_COMMIT_COUNT ?? '0');
const changedFiles = Number(process.env.ASA_PR_CHANGED_FILES ?? '0');
const additions = Number(process.env.ASA_PR_ADDITIONS ?? '0');
const deletions = Number(process.env.ASA_PR_DELETIONS ?? '0');
const changedLines = additions + deletions;

if (commitCount > 0) {
  assert.ok(
    commitCount <= maxReviewCommits,
    `PR has ${commitCount} commits. Review limit is ${maxReviewCommits}. Rebuild/squash the review branch from current main before review.`,
  );
}

if (changedFiles > Number(footprint.targetHandwrittenFiles ?? Infinity)) {
  console.warn(
    `PR footprint warning: ${changedFiles} changed files exceeds ${footprint.targetHandwrittenFiles} target. Split unrelated ownership or document why this is focused architecture/vendor work.`,
  );
}
if (changedFiles > Number(footprint.architectureReviewAboveHandwrittenFiles ?? Infinity)) {
  console.warn(
    `PR architecture-review warning: ${changedFiles} changed files exceeds ${footprint.architectureReviewAboveHandwrittenFiles} review threshold.`,
  );
}
if (changedLines > Number(footprint.targetChangedLines ?? Infinity)) {
  console.warn(
    `PR footprint warning: ${changedLines} changed lines exceeds ${footprint.targetChangedLines} target.`,
  );
}
if (changedLines > Number(footprint.architectureReviewAboveChangedLines ?? Infinity)) {
  console.warn(
    `PR architecture-review warning: ${changedLines} changed lines exceeds ${footprint.architectureReviewAboveChangedLines} review threshold.`,
  );
}

const temporaryName = new RegExp(
  `(^|/)([^/]*${hygiene.temporaryToolNamePattern ?? '(codemod|one[-_]?shot|review[-_]?fix|temporary[-_]?workflow)'}[^/]*)(/|$)`,
  'i',
);
const roots = ['.github/workflows', 'scripts', 'tools'];
const offenders = [];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  walk(root, (file) => {
    const relative = file.replaceAll('\\', '/');
    if (temporaryName.test(relative)) offenders.push(relative);
  });
}

assert.deepEqual(
  offenders,
  [],
  `Temporary review/codemod artifacts must be removed before PR review:\n${offenders.join('\n')}`,
);

assert.ok(fs.existsSync('.github/PULL_REQUEST_TEMPLATE.md'), 'PR template must remain present');

console.log(
  `ASA-CAD PR hygiene PASS${commitCount ? ` (${commitCount} commits` : ''}${changedFiles ? `${commitCount ? '; ' : ' ('}${changedFiles} files, ${changedLines} changed lines` : ''}${commitCount || changedFiles ? ')' : ''}`,
);

function walk(root, visit) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}
