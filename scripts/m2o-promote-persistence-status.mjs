import { readFile, writeFile } from 'node:fs/promises';
const path = 'spec/ui/command-registry.v1.json';
let source = await readFile(path, 'utf8');
for (const id of ['system.open', 'system.save']) {
  const before = new RegExp(`(\\{"id":"${id.replace('.', '\\.') }"[^\\n]*"status":")experimental(")`);
  if (!before.test(source)) throw new Error(`${id}: experimental status anchor not found`);
  source = source.replace(before, '$1implemented$2');
}
await writeFile(path, source);
console.log('Promoted system.open/system.save to implemented');
