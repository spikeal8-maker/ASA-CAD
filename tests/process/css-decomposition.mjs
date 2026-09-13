import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('src/web/index.tsx', 'utf8');
const orderedImports = [
  "./styles/base.css",
  "./styles/top-shell.css",
  "./styles/ribbon.css",
  "./styles/management.css",
  "./styles/work-area.css",
  "./styles/dialogs.css",
  "./styles/shell-responsive.css",
  "./responsive.css",
  "./ui-scale.css",
  "./mobile-settings.css",
  "./mobile-tools.css",
];

let previous = -1;
for (const stylesheet of orderedImports) {
  const needle = `import '${stylesheet}';`;
  const offset = index.indexOf(needle);
  assert.ok(offset >= 0, `index.tsx must import ${stylesheet}`);
  assert.ok(offset > previous, `CSS import order changed around ${stylesheet}`);
  previous = offset;
}

assert.equal(fs.existsSync('src/web/styles.css'), false, 'monolithic src/web/styles.css must not return');

const domainFiles = [
  'base.css',
  'top-shell.css',
  'ribbon.css',
  'management.css',
  'work-area.css',
  'dialogs.css',
  'shell-responsive.css',
];

for (const name of domainFiles) {
  const file = `src/web/styles/${name}`;
  assert.ok(fs.existsSync(file), `${file} must exist`);
  const source = fs.readFileSync(file, 'utf8');
  const size = Buffer.byteLength(source.replace(/\r\n?/g, '\n'), 'utf8');
  assert.ok(size <= 10 * 1024, `${file} must stay within the 10 KB CSS target; got ${size} B`);
  if (name !== 'shell-responsive.css') {
    assert.equal(source.includes('@media'), false, `${file} must not own responsive media queries`);
  }
}

const shellResponsive = fs.readFileSync('src/web/styles/shell-responsive.css', 'utf8');
assert.match(shellResponsive, /@media \(max-width: 599px\)/, 'shell responsive owner must contain phone composition');
assert.match(shellResponsive, /@media \(min-width: 2560px\)/, 'shell responsive owner must contain wide-screen composition');
assert.match(shellResponsive, /@media \(prefers-reduced-motion: reduce\)/, 'shell responsive owner must retain reduced-motion policy');

const responsive = fs.readFileSync('src/web/responsive.css', 'utf8');
assert.match(responsive, /Portrait tablets/, 'accepted responsive override file must remain after base shell responsive CSS');

console.log('M3M-005 CSS decomposition PASS (ordered domain owners + responsive layering + <=10 KB domains)');
