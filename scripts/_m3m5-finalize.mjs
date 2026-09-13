import fs from 'node:fs';

const packagePath = 'package.json';
let pkg = fs.readFileSync(packagePath, 'utf8');
const oldDecomposition = '"test:m2o:decomposition": "node tests/m2o/app-decomposition.mjs"';
const newDecomposition = '"test:m2o:decomposition": "node tests/m2o/app-decomposition.mjs && node tests/process/css-decomposition.mjs"';
if (!pkg.includes(oldDecomposition)) throw new Error('Expected decomposition script not found');
pkg = pkg.replace(oldDecomposition, newDecomposition);
fs.writeFileSync(packagePath, pkg);

const statusPath = 'docs/STATUS.md';
let status = fs.readFileSync(statusPath, 'utf8');
status = status.replace(
  '5. **M3M-005 — split monolithic `styles.css` — NEXT;**\n6. M3M-006 — split Sketch command handlers by geometry/edit/constraint/dimension ownership;',
  '5. **M3M-005 — shell CSS split into focused domain files; monolithic `styles.css` removed — DONE (this change);**\n6. **M3M-006 — split Sketch command handlers by geometry/edit/constraint/dimension ownership — NEXT;**',
);
status = status.replace(
  'Work **only on #57 M3M-005** after this change merges. Split `styles.css` into a small set of focused domain CSS files and ratchet the old stylesheet ceiling down. Do not restart M3.6B.',
  'Work **only on #57 M3M-006** after this change merges. Split Sketch command handlers into focused geometry/edit/constraint/dimension owners before broader constraints. Do not restart M3.6B.',
);
if (!status.includes('M3M-005 — shell CSS split into focused domain files')) throw new Error('STATUS M3M-005 replacement failed');
fs.writeFileSync(statusPath, status);

console.log('M3M-005 package/status finalization applied');
