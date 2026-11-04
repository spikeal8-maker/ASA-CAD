import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(here, 'index.html'), 'utf8');
const contract = JSON.parse(readFileSync(resolve(here, 'skin-selection.contract.json'), 'utf8'));
const hash = createHash('sha256').update(html, 'utf8').digest('hex');
assert.equal(hash, contract.referenceBaseline.sourceSha256, 'HTML differs from reviewed Fusion v3');
assert.deepEqual(contract.choices.map((choice) => choice.id), ['fusion', 'kompas', 'vassalite']);
assert.equal(contract.gating.productCodeStartAllowed, false, 'Reference must not silently become product');
assert.equal(contract.status, 'PLANNED_NOT_WIRED');
assert.match(html, /^<!doctype html>/i);
assert.match(html, /<html lang="ru">/i);
assert.ok(!/<script[^>]+src=/i.test(html), 'Remote scripts are prohibited for offline prototype');
assert.ok(!/<link[^>]+href=/i.test(html), 'Remote stylesheets are prohibited for offline prototype');
assert.ok(!/\bAutodesk\b/i.test(html), 'Autodesk branding must not appear in independent UI');

for (const id of [
  'app', 'dataPanel', 'projectGrid', 'tabs', 'groups', 'viewport',
  'gridCanvas', 'browser', 'browserItems', 'viewcube', 'navigation',
  'timelineOptions', 'popup', 'params', 'paramAccept', 'paramCancel',
]) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing structural element: ' + id);
}
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1, 'Self-contained reference must have one inline script');
new vm.Script(scripts[0][1], { filename: 'prototypes/fusion/index.html' });

function extractObject(name, next) {
  const begin = html.indexOf('const ' + name + '=');
  const end = html.indexOf(next, begin);
  assert.ok(begin > 0 && end > begin, 'Cannot parse reference data for ' + name);
  return vm.runInNewContext(html.slice(begin, end) + '\n' + name, {});
}
const baseIcons = extractObject('ico', 'const refinedIco=');
const refinedIcons = extractObject('refinedIco', 'const ascDefs=');
const ribbon = extractObject('rCfg', 'function renderRibbon');
const entries = [];
for (const [workspace, groups] of Object.entries(ribbon)) {
  for (const [group, keys, labels, disabled] of groups) {
    assert.equal(keys.length, labels.length, workspace + '/' + group + ' icon/label count mismatch');
    keys.forEach((iconKey, index) => {
      assert.ok(Object.hasOwn(baseIcons, iconKey) || Object.hasOwn(refinedIcons, iconKey), 'Missing SVG artwork: ' + iconKey);
      entries.push({
        workspace, group, label: labels[index], iconKey,
        variant: Object.hasOwn(refinedIcons, iconKey) ? 'refined-svg' : 'base-svg',
        iconParity: 'NOT_VERIFIED',
        disabledInReference: Boolean(disabled),
      });
    });
  }
}
const unique = [...new Set(entries.map((entry) => entry.iconKey))].sort();
const manifest = {
  schemaVersion: 1,
  sourceSha256: hash,
  role: 'visual-reference-icon-inventory',
  iconParity: 'NOT_VERIFIED',
  totalCommandsAcrossWorkspaces: entries.length,
  uniqueIconKeys: unique.length,
  reusedIconKeys: unique.filter((key) => new Set(entries.filter((e) => e.iconKey === key).map((e) => e.label)).size > 1),
  workspaces: Object.keys(ribbon),
  tools: entries,
};
const encoded = JSON.stringify(manifest, null, 2) + '\n';
const inventoryPath = resolve(here, 'icon-inventory.v1.json');
if (process.argv.includes('--update-inventory')) {
  writeFileSync(inventoryPath, encoded, 'utf8');
  process.stdout.write('Inventory updated: ' + entries.length + ' tool entries, ' + unique.length + ' SVG keys\n');
} else {
  const committed = readFileSync(inventoryPath, 'utf8');
  assert.deepEqual(JSON.parse(committed), manifest, 'Icon inventory is stale: run node prototypes/fusion/tests/reference-smoke.mjs --update-inventory');
  process.stdout.write('PASS: offline Fusion prototype v3, ' + Object.keys(ribbon).length + ' tabs, ' + entries.length +
    ' tools, ' + unique.length + ' icon keys, ' + manifest.reusedIconKeys.length + ' reused icon keys\n');
  process.stdout.write('PARITY: NOT_VERIFIED; this is not a CAD runtime or a production skin\n');
}
