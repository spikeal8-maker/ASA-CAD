import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const commitCount = Number(process.env.ASA_PR_COMMIT_COUNT ?? '0');
if (commitCount > 0) {
  assert.ok(
    commitCount <= 12,
    `PR has ${commitCount} commits. Hard limit is 12. Rebuild/squash the review branch from current main before review.`,
  );
  if (commitCount > 6) {
    console.warn(`PR hygiene warning: ${commitCount} commits; target is <= 6 for one vertical slice.`);
  }
}

const temporaryName = /(^|\/)([^/]*(codemod|one[-_]?shot|review[-_]?fix|temporary[-_]?workflow)[^/]*)(\/|$)/i;
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

console.log(`ASA-CAD PR hygiene PASS${commitCount ? ` (${commitCount} commits)` : ''}`);

function walk(root, visit) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}
