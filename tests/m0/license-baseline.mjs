import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repo = new URL('../../', import.meta.url);
const license = await readFile(new URL('vendor/toubkal/LICENSE', repo), 'utf8');
const notices = await readFile(new URL('vendor/toubkal/THIRD_PARTY_NOTICES.md', repo), 'utf8');
const pkg = JSON.parse(await readFile(new URL('vendor/toubkal/package.json', repo), 'utf8'));
const lock = JSON.parse(await readFile(new URL('vendor/toubkal/package-lock.json', repo), 'utf8'));

assert.match(license, /MIT License/i, 'vendored Toubkal MIT license is missing');
assert.equal(pkg.license, 'MIT', 'vendored package metadata must preserve MIT license');
assert.match(notices, /@salusoft89\/planegcs/i, 'PlaneGCS notice is missing');
assert.match(notices, /opencascade\.js/i, 'OpenCascade.js notice is missing');
assert.match(notices, /LGPL-2\.0-or-later/i, 'PlaneGCS LGPL notice is missing');
assert.match(notices, /LGPL-2\.1-only/i, 'OpenCascade.js LGPL notice is missing');
assert.ok(lock.packages, 'vendor package-lock must remain present and parseable');

console.log('ASA-CAD M0 license baseline PASS');
