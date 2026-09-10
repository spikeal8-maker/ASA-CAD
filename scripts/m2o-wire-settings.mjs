import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/web/App.tsx';
let source = await readFile(path, 'utf8');

function replaceExact(before, after) {
  if (!source.includes(before)) throw new Error(`App.tsx: expected settings refactor anchor not found: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

replaceExact(
  `import { CadEditorPersistence } from './CadEditorPersistence';`,
  `import { CadEditorPersistence } from './CadEditorPersistence';\nimport { useUiScaleSettings } from './UiScaleSettings';`,
);

replaceExact(
  `export function App() {\n  const route = useMemo(() => parseCadClientRoute(window.location.pathname), []);`,
  `export function App() {\n  const { openSettings } = useUiScaleSettings();\n  const route = useMemo(() => parseCadClientRoute(window.location.pathname), []);`,
);

replaceExact(
  `<button type="button" title="Настройки">⚙</button>`,
  `<button type="button" title="Настройки" onClick={openSettings} aria-haspopup="dialog" aria-controls="asa-cad-interface-settings">⚙</button>`,
);

await writeFile(path, source);
console.log('M2O typed settings wiring applied');
