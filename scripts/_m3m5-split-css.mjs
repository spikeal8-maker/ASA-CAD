import fs from 'node:fs';
import path from 'node:path';

const stylesPath = 'src/web/styles.css';
const indexPath = 'src/web/index.tsx';
const budgetPath = 'tests/process/file-budgets.mjs';
const lineBoundaryPath = 'tests/m3/direct-line-boundary.mjs';

const css = fs.readFileSync(stylesPath, 'utf8').replace(/\r\n?/g, '\n');
const markers = [
  ['top-shell.css', '.main-menu-bar {'],
  ['ribbon.css', '.instrument-area {'],
  ['management.css', '.content-area {'],
  ['work-area.css', '.work-area {'],
  ['dialogs.css', '.modal-backdrop {'],
  ['shell-responsive.css', '/* Short desktop: reduce vertical chrome before reducing font sizes. */'],
];

const starts = markers.map(([, marker]) => {
  const index = css.indexOf(marker);
  if (index < 0) throw new Error(`Missing CSS split marker: ${marker}`);
  return index;
});
for (let i = 1; i < starts.length; i += 1) {
  if (starts[i] <= starts[i - 1]) throw new Error('CSS split markers are out of order');
}

const outputs = [
  ['base.css', css.slice(0, starts[0])],
  ...markers.map(([name], index) => [
    name,
    css.slice(starts[index], index + 1 < starts.length ? starts[index + 1] : css.length),
  ]),
];

fs.mkdirSync('src/web/styles', { recursive: true });
for (const [name, content] of outputs) {
  const normalized = content.replace(/^\n+|\s+$/g, '').concat('\n');
  fs.writeFileSync(path.join('src/web/styles', name), normalized);
}

let indexSource = fs.readFileSync(indexPath, 'utf8');
const oldImport = "import './styles.css';";
const newImports = outputs.map(([name]) => `import './styles/${name}';`).join('\n');
if (!indexSource.includes(oldImport)) throw new Error('Expected styles.css import not found');
indexSource = indexSource.replace(oldImport, newImports);
fs.writeFileSync(indexPath, indexSource);

let budgets = fs.readFileSync(budgetPath, 'utf8');
const frozenLine = "  ['src/web/styles.css', 22_588],\n";
if (!budgets.includes(frozenLine)) throw new Error('Expected styles.css frozen budget not found');
budgets = budgets.replace(frozenLine, '');
fs.writeFileSync(budgetPath, budgets);

let lineBoundary = fs.readFileSync(lineBoundaryPath, 'utf8');
const oldStyleRead = "const styles = fs.readFileSync('src/web/styles.css', 'utf8');";
const newStyleRead = "const styles = fs.readFileSync('src/web/styles/management.css', 'utf8');";
if (!lineBoundary.includes(oldStyleRead)) throw new Error('Expected direct-line styles read not found');
lineBoundary = lineBoundary.replace(oldStyleRead, newStyleRead);
fs.writeFileSync(lineBoundaryPath, lineBoundary);

fs.unlinkSync(stylesPath);

console.log('M3M-005 CSS domains written:');
for (const [name] of outputs) {
  const file = path.join('src/web/styles', name);
  console.log(`${file}: ${Buffer.byteLength(fs.readFileSync(file, 'utf8'), 'utf8')} B`);
}
