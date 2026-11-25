import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const ref = JSON.parse(readFileSync('spec/process/active-work.v1.json', 'utf8')).uiReference;
assert.equal(ref.sha, '88c535c652dac8b04f0d68fa144cf8486afdc926');
assert.equal(ref.tag, 'ui-reference-20261004');

for (const [path, component] of [
  ['src/web/CadShellTop.tsx', 'KompasTop'],
  ['src/web/CadShellMain.tsx', 'KompasMain'],
  ['src/web/CadShellBottom.tsx', 'KompasMobileNavigation'],
]) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, new RegExp('\\b' + component + '\\b'), path + ' must mount the canonical product UI');
  assert.doesNotMatch(source, /LegacyCadShell|useKompasDesktop|matchMedia|innerWidth/, path + ': UI shell routing cannot revert to the retired layout');
}
for (const path of [
  'src/web/CadFileMenu.tsx',
  'src/web/CadShellCommandGroups.tsx',
  'src/web/CadShellReferenceGroups.tsx',
  'src/web/CadShellMenu.tsx',
  'src/web/CadShellKeys.ts',
  'src/web/CadUiActionControls.tsx',
]) {
  assert.equal(existsSync(path), false, path + ' is retired; the canonical KOMPAS shell must remain its sole owner');
}
const entry = readFileSync('src/web/index.tsx', 'utf8');
assert.match(entry, /kompas\/kompas-responsive\.css/, 'compact layout must be supplied by KOMPAS CSS, not legacy components');
const desktop = readFileSync('src/web/kompas/KompasTop.tsx', 'utf8');
assert.match(desktop, /props\.activeWorkspace/, 'KOMPAS toolset must derive from shared active workspace');
assert.match(desktop, /props\.setActiveWorkspace/, 'KOMPAS toolset changes must update shared workspace');
const main = readFileSync('src/web/kompas/KompasMain.tsx', 'utf8');
assert.match(main, /k-mobile-tools-panel/, 'compact layout must retain shared mobile typed-action tools');
const status = readFileSync('docs/STATUS.md', 'utf8');
assert.match(status, /один владелец состояния/, 'status must preserve one application/document owner across presentations');
for (const [path, component] of [
  ['src/web/CadShellTop.tsx', 'FusionTop'],
  ['src/web/CadShellMain.tsx', 'FusionMain'],
  ['src/web/CadShellBottom.tsx', 'FusionBottom'],
]) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, new RegExp('\\b' + component + '\\b'), 'Fusion must use the same typed shell boundary');
  assert.match(source, /useEditorMode/, 'Presentation choice must use explicit editor mode');
}
const session = readFileSync('src/web/useCadApplicationSession.ts', 'utf8');
assert.equal((session.match(/new CadApplicationImpl\(/g) ?? []).length, 1);
assert.match(session, /app\.dispose\(\)/, 'The shared application must release its runtime on exit');
console.log('ASA-CAD canonical #170 + Fusion presentation guard PASS (one action/document/history owner)');
