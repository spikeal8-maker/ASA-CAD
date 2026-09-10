import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/web/App.tsx';
let source = await readFile(path, 'utf8');

const importAnchor = `import { useUiScaleSettings } from './UiScaleSettings';`;
if (!source.includes(importAnchor)) throw new Error('App.tsx panel import anchor not found');
source = source.replace(
  importAnchor,
  `${importAnchor}\nimport { DocumentTree, ParameterPanel } from './panels/EditorPanels';`,
);

const panelStart = source.indexOf('function DocumentTree({');
if (panelStart < 0) throw new Error('App.tsx DocumentTree anchor not found');
source = source.slice(0, panelStart).trimEnd() + '\n';

await writeFile(path, source);
console.log('M2O editor panel extraction applied');
