import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('../../', import.meta.url);
const protectedDirs = ['src/contracts', 'src/application'];
const forbidden = [
  /vendor\/toubkal/,
  /window\.oc/,
  /TopoDS_/,
  /CADGeometryRegistry/,
  /useCADStore/,
  /CustomEvent\s*</,
];

async function walk(directory) {
  const entries = await readdir(new URL(`${directory}/`, root), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (['.ts', '.tsx'].includes(extname(entry.name))) result.push(path);
  }
  return result;
}

for (const directory of protectedDirs) {
  for (const file of await walk(directory)) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(source),
        false,
        `${relative('.', file)} leaks forbidden vendor/kernel coupling: ${pattern}`,
      );
    }
  }
}

console.log('ASA-CAD M1 public architecture boundary PASS');
