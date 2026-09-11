import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O5.2 codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce('command registry import', "import commandRegistryJson from '../../spec/ui/command-registry.v1.json';\n", '');
replaceOnce(
  'ParameterPanel import',
  "import { DocumentTree } from './DocumentTree';\n",
  "import { DocumentTree } from './DocumentTree';\nimport { ParameterPanel } from './ParameterPanel';\n",
);
replaceOnce(
  'legacy registry metadata block',
  `interface RegistryCommand {
  id: string;
  labelRu: string;
  milestone: string;
  status: string;
}

const registry = commandRegistryJson as { commands: RegistryCommand[] };
const commandById = new Map(registry.commands.map((command) => [command.id, command]));

`,
  '',
);
replaceOnce(
  'legacy commandLabel helper',
  `function commandLabel(id: string, fallback: string): string {
  return commandById.get(id)?.labelRu ?? fallback;
}

`,
  '',
);

const panelStart = source.indexOf('\nfunction ParameterPanel(props: {');
if (panelStart < 0) throw new Error('O5.2 codemod could not find ParameterPanel tail');
const tail = source.slice(panelStart);
if (!tail.includes('\nfunction NumericField(props: {')) {
  throw new Error('O5.2 expected NumericField to remain inside ParameterPanel tail');
}
if (!tail.trimEnd().endsWith('}')) {
  throw new Error('O5.2 ParameterPanel tail does not end at App.tsx EOF');
}
source = `${source.slice(0, panelStart).trimEnd()}\n`;

writeFileSync(path, source);
console.log('Applied O5.2 ParameterPanel extraction');
