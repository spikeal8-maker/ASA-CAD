import assert from 'node:assert/strict';
import {
  parseUiScalePreference,
  resolveUiScale,
  readStoredUiScale,
  writeStoredUiScale,
  type CadUiScalePreference,
} from '../../src/web/UiScale';

assert.equal(parseUiScalePreference('auto'), 'auto');
assert.equal(parseUiScalePreference('125'), 125);
assert.equal(parseUiScalePreference('150%'), 150);
assert.equal(parseUiScalePreference('105'), null);
assert.equal(parseUiScalePreference(null), null);

assert.equal(resolveUiScale('auto', { width: 1920, height: 1080, dpr: 1 }), 100);
assert.equal(resolveUiScale('auto', { width: 2560, height: 1440, dpr: 1 }), 110);
assert.equal(resolveUiScale('auto', { width: 2560, height: 1440, dpr: 1.5 }), 110);
assert.equal(resolveUiScale('auto', { width: 1920, height: 1080, dpr: 2 }), 100);
assert.equal(resolveUiScale('auto', { width: 3440, height: 1440, dpr: 1 }), 125);
assert.equal(resolveUiScale('auto', { width: 3440, height: 720, dpr: 1 }), 100);

for (const value of [90, 100, 110, 125, 150] as const) {
  assert.equal(
    resolveUiScale(value, { width: 1366, height: 768, dpr: 2 }),
    value,
    `manual ${value}% must win over Auto heuristics`,
  );
}

const state = new Map<string, string>();
const storage = {
  getItem(key: string) { return state.get(key) ?? null; },
  setItem(key: string, value: string) { state.set(key, value); },
};
assert.equal(readStoredUiScale(storage), 'auto');
for (const value of ['auto', 90, 100, 110, 125, 150] as CadUiScalePreference[]) {
  writeStoredUiScale(value, storage);
  assert.equal(readStoredUiScale(storage), value);
}
state.set('asa-cad-ui-scale', 'garbage');
assert.equal(readStoredUiScale(storage), 'auto');

console.log('ASA-CAD M2R UI Scale policy PASS');
console.log('  ✓ Auto uses effective CSS viewport and height protection');
console.log('  ✓ DPR does not independently double-scale 4K');
console.log('  ✓ explicit 90/100/110/125/150 overrides remain authoritative');
console.log('  ✓ persisted preferences parse safely');
