import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const distUrl = new URL('../../dist/asa/', import.meta.url);
const dist = fileURLToPath(distUrl);
const index = await readFile(join(dist, 'index.html'), 'utf8');
assert.match(index, /<title>ASA-CAD<\/title>/i, 'ASA shell HTML title is missing');
assert.match(index, /\.js/i, 'ASA shell index has no JS bundle');

async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}

const outputFiles = await files(dist);
assert.ok(outputFiles.some((file) => file.endsWith('.js')), 'ASA shell emitted no JavaScript');
assert.ok(outputFiles.some((file) => file.endsWith('.css')), 'ASA shell emitted no CSS');
assert.equal(
  outputFiles.some((file) => file.endsWith('.wasm')),
  false,
  'M2 shell boot bundle must not eagerly include the heavy CAD WASM runtime',
);

const bundleText = (
  await Promise.all(
    outputFiles
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFile(file, 'utf8')),
  )
).join('\n');
assert.equal(/Initializing geometry registry/i.test(bundleText), false, 'ASA shell accidentally bundled vendor application boot text');
assert.equal(/toubkalcad-app-logo/i.test(bundleText), false, 'ASA shell accidentally bundled vendor product artwork');

console.log('ASA-CAD M2 independent shell build PASS');
console.log(`Emitted ${outputFiles.length} files; heavy WASM is not in the shell boot artifact.`);
