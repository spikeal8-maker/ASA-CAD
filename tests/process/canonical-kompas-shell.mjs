import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
const entry = readFileSync('src/web/index.tsx', 'utf8');
assert.match(entry, /kompas\/kompas-responsive\.css/, 'compact layout must be supplied by KOMPAS CSS, not legacy components');
const desktop = readFileSync('src/web/kompas/KompasTop.tsx', 'utf8');
assert.match(desktop, /props\.activeWorkspace/, 'KOMPAS toolset must derive from shared active workspace');
assert.match(desktop, /props\.setActiveWorkspace/, 'KOMPAS toolset changes must update shared workspace');
const main = readFileSync('src/web/kompas/KompasMain.tsx', 'utf8');
assert.match(main, /k-mobile-tools-panel/, 'compact layout must retain shared mobile typed-action tools');
const status = readFileSync('docs/STATUS.md', 'utf8');
assert.match(status, /одна продуктовая оболочка/, 'status must state the canonical UI contract');
console.log('ASA-CAD canonical #170 shell static guard PASS (desktop/tablet/phone, one action/document model)');
