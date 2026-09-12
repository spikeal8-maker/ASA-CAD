import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: expected fragment is not unique`);
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  "export type CadWorkspacePanel = 'tree' | 'parameters' | 'tools';",
  "export type CadWorkspacePanel = 'tree' | 'parameters' | 'tools' | 'closed';",
);
replaceOnce(
  'src/web/usePartSketchWorkspace.ts',
  `    setActiveCommand('sketch.line');\n    setPanel('tree');\n    clearTransientSelection();`,
  `    setActiveCommand('sketch.line');\n    setPanel('closed');\n    clearTransientSelection();`,
);

replaceOnce(
  'src/web/App.tsx',
  "  const [activePanel, setActivePanel] = useState<'tree' | 'parameters' | 'tools'>('tree');",
  "  const [activePanel, setActivePanel] = useState<'tree' | 'parameters' | 'tools' | 'closed'>('tree');",
);
replaceOnce(
  'src/web/App.tsx',
  `      <main className="content-area">`,
  `      <main className={\`content-area${activePanel === 'closed' ? ' panel-closed' : ''}\`}>`,
);
replaceOnce(
  'src/web/App.tsx',
  `        <aside className="management-panel">\n          {activePanel === 'tree' ? (`,
  `        <aside className="management-panel">\n          {activePanel === 'closed' ? null : activePanel === 'tree' ? (`,
);

const cssPath = 'src/web/styles.css';
const css = fs.readFileSync(cssPath, 'utf8');
const marker = '.management-panel {\n  min-width: 0;';
if (!css.includes(marker)) throw new Error('styles.css: management panel marker missing');
if (css.includes('.content-area.panel-closed')) throw new Error('styles.css: panel-closed already exists');
fs.writeFileSync(cssPath, css.replace(
  marker,
  `.content-area.panel-closed {\n  grid-template-columns: var(--rail-w) minmax(0, 1fr);\n}\n.content-area.panel-closed .management-panel { display: none; }\n\n${marker}`,
));

console.log('M3.2 review fixes panel codemod applied');
