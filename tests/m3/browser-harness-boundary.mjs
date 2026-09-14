import assert from 'node:assert/strict';
import fs from 'node:fs';

const harnessPath = 'tests/m3/M3BrowserHarness.mjs';
const harness = fs.readFileSync(harnessPath, 'utf8');
const specs = [
  'tests/m3/direct-line-browser.mjs',
  'tests/m3/direct-circle-browser.mjs',
  'tests/m3/direct-arc-browser.mjs',
  'tests/m3/direct-rectangle-browser.mjs',
  'tests/m3/sketch-selection-delete-browser.mjs',
];

assert.match(harness, /playwright-core\/index\.mjs/, 'shared harness must own the Playwright dependency');
for (const helper of [
  'launchM3Browser',
  'createXYSketch',
  'createMobileXYSketch',
  'interactionBox',
  'squarePoint',
  'waitSolvedOverlay',
  'newDesktopPage',
  'newTouchPage',
  'saveLocalDocument',
  'reopenFirstSketch',
]) {
  assert.match(harness, new RegExp(`export (?:async )?function ${helper}\\b`), `shared harness is missing ${helper}`);
}

for (const file of specs) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /from '\.\/M3BrowserHarness\.mjs'/, `${file} must consume the shared M3 browser harness`);
  assert.doesNotMatch(source, /playwright-core/, `${file} must not own the Playwright dependency`);
  assert.doesNotMatch(source, /chromium\.launch/, `${file} must not launch Chromium independently`);
  for (const duplicated of [
    'wasmResources',
    'createXYSketch',
    'createMobileXYSketch',
    'interactionBox',
    'squarePoint',
    'newDesktopPage',
    'newTouchPage',
    'saveLocalDocument',
    'reopenFirstSketch',
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`(?:async )?function ${duplicated}\\b`),
      `${file} duplicated shared helper ${duplicated}`,
    );
  }
}

const policy = JSON.parse(fs.readFileSync('spec/process/repository-health.v1.json', 'utf8'));
const exceptions = policy.grandfatheredHardCeilings ?? {};
for (const file of specs.slice(0, 4)) {
  assert.equal(exceptions[file], undefined, `${file} must not remain grandfathered after M3M-007`);
}
const harnessBudget = policy.fileBudgets.find((item) => item.id === 'm3-browser-harness');
assert.ok(harnessBudget?.exactFiles?.includes(harnessPath), 'shared M3 browser harness must have an explicit machine budget');

console.log('ASA-CAD M3M-007 browser harness boundary PASS (shared infrastructure + focused specs + no old exceptions)');
