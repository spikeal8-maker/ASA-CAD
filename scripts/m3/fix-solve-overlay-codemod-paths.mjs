import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const path = 'scripts/m3/apply-m3-solve-overlay.mjs';
let source = readFileSync(path, 'utf8');

const before = `'      - tests/m2/**\\n      - build/**'`;
const after = `'      - build/**\\n      - tests/m2/**'`;
const beforeOut = `'      - tests/m2/**\\n      - tests/m3/**\\n      - build/**'`;
const afterOut = `'      - build/**\\n      - tests/m2/**\\n      - tests/m3/**'`;
const inputCount = source.split(before).length - 1;
const outputCount = source.split(beforeOut).length - 1;
if (inputCount !== 2 || outputCount !== 2) {
  throw new Error(`Unexpected M3 browser path matcher counts: input=${inputCount}, output=${outputCount}`);
}
source = source.split(before).join(after).split(beforeOut).join(afterOut);

const wrongPortCount = source.split('http://127.0.0.1:8091/').length - 1;
if (wrongPortCount !== 2) {
  throw new Error(`Unexpected M3 browser step port matcher count: ${wrongPortCount}`);
}
source = source.split('http://127.0.0.1:8091/').join('http://127.0.0.1:8090/');

writeFileSync(path, source);
rmSync('scripts/m3/fix-solve-overlay-codemod-paths.mjs');
console.log('Fixed M3.1 browser workflow path + step matchers');
