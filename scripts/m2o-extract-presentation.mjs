import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/web/App.tsx';
let source = await readFile(path, 'utf8');

source = source.replace(`import commandRegistryJson from '../../spec/ui/command-registry.v1.json';\n`, '');
source = source.replace(
  `import { CadEditorPersistence } from './CadEditorPersistence';\nimport { useUiScaleSettings } from './UiScaleSettings';`,
  `import { CadEditorPersistence } from './CadEditorPersistence';\nimport { useUiScaleSettings } from './UiScaleSettings';\nimport {\n  commandById,\n  commandLabel,\n  dimensionLabel,\n  documentDescriptions,\n  documentNames,\n  hasCircle,\n  hasRectangle,\n  kindIcon,\n  latestSketch,\n  partDocument,\n  searchCommands,\n  viewportViewByLabel,\n} from './presentation/CadEditorPresentation';`,
);

const helperStart = source.indexOf('interface RegistryCommand {');
const appStart = source.indexOf('export function App() {');
if (helperStart < 0 || appStart < 0 || appStart <= helperStart) {
  throw new Error('App.tsx presentation helper anchors not found');
}
source = source.slice(0, helperStart) + source.slice(appStart);

const oldSearch = `  const searchableCommands = search.trim()\n    ? registry.commands\n        .filter((command) => command.labelRu.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))\n        .slice(0, 8)\n    : [];`;
if (!source.includes(oldSearch)) throw new Error('App.tsx command search anchor not found');
source = source.replace(oldSearch, `  const searchableCommands = searchCommands(search, document.kind);`);

await writeFile(path, source);
console.log('M2O App presentation extraction applied');
