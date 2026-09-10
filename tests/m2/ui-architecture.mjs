import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const WEB_ROOT = 'src/web';
const APP_PATH = join(WEB_ROOT, 'App.tsx');

// App.tsx is already too large. Freeze growth immediately; new feature families
// must move responsibilities into focused modules before adding more orchestration.
const MAX_APP_BYTES = 62_500;
const appBytes = statSync(APP_PATH).size;
assert.ok(
  appBytes <= MAX_APP_BYTES,
  `App.tsx grew to ${appBytes} bytes (limit ${MAX_APP_BYTES}). Extract a focused controller/component instead of growing the god-object.`,
);

function filesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

const mobileSourceFiles = filesRecursively(WEB_ROOT).filter((path) => {
  const extension = extname(path);
  return /mobile/i.test(relative(WEB_ROOT, path)) && (extension === '.ts' || extension === '.tsx');
});

for (const path of mobileSourceFiles) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(
    source,
    /document\.querySelector|document\.querySelectorAll|\.click\(\)/,
    `${path}: mobile presentation must consume typed actions/state, not discover or click desktop DOM controls`,
  );
}

console.log(`ASA-CAD M2 UI architecture PASS (App.tsx ${appBytes}/${MAX_APP_BYTES} bytes; ${mobileSourceFiles.length} mobile TS/TSX files checked)`);
