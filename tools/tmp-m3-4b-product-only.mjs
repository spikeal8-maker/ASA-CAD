import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const source = fs.readFileSync('tools/tmp-m3-4b-arc-interaction.mjs', 'utf8');
const marker = "\nedit('.github/workflows/m3-browser.yml'";
const index = source.indexOf(marker);
if (index < 0) throw new Error('M3 browser edit marker missing from Arc codemod');
const productOnly = source.slice(0, index) + "\nconsole.log('M3.4B Arc product-only wiring applied');\n";
const temp = '/tmp/m3-4b-product-only-runtime.mjs';
fs.writeFileSync(temp, productOnly);
await import(pathToFileURL(temp).href);
