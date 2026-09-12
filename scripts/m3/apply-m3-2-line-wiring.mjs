import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, transform) {
  const source = readFileSync(path, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No change produced for ${path}`);
  writeFileSync(path, next);
}

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

edit('src/web/usePartSketchWorkspace.ts', (source) => {
  source = replaceExact(
    source,
    "import type { CadDocument, CadDocumentKind, CadPartDocument, CadSketch } from '../contracts/document';",
    "import type { CadDocument, CadDocumentKind, CadPartDocument, CadPoint2, CadSketch } from '../contracts/document';",
    'workspace CadPoint2 import',
  );
  source = replaceExact(
    source,
    "export type PartSketchSelectionMode = 'none' | 'face' | 'edge';",
    "export type PartSketchSelectionMode = 'none' | 'face' | 'edge' | 'sketch';",
    'Sketch selection mode',
  );
  source = replaceExact(
    source,
`  function beginRectangle() {
    if (!sketch) return;`,
`  function beginLine() {
    if (!sketch) return;
    setActiveCommand('sketch.line');
    setPanel('tree');
    clearTransientSelection();
    setSelectionMode('sketch');
    setActiveWorkspace('sketch');
    setNotice('Отрезок: укажите первую точку');
  }

  async function commitLine(from: CadPoint2, to: CadPoint2): Promise<boolean> {
    const currentPart = partDocument(app.getDocument());
    const currentSketch = findSketch(currentPart, activeSketchId);
    if (!currentSketch) {
      setNotice('Активный эскиз больше не существует');
      return false;
    }
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < 0.01) {
      setNotice('Отрезок должен иметь ненулевую длину');
      return false;
    }
    const result = await app.execute({
      id: 'sketch.line',
      payload: { sketchId: currentSketch.id, from, to },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать отрезок');
      return false;
    }
    setNotice('Отрезок создан; укажите первую точку следующего отрезка или Esc для выхода');
    return true;
  }

  function beginRectangle() {
    if (!sketch) return;`,
    'Line workspace functions',
  );
  source = replaceExact(
    source,
    "    const stayInSketch = activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';",
    "    const stayInSketch = activeCommand === 'sketch.line' || activeCommand === 'sketch.rectangle' || activeCommand === 'sketch.circle';",
    'Line cancel behavior',
  );
  source = replaceExact(
    source,
`    beginCreateSketch,
    commitCreateSketch,
    beginRectangle,`,
`    beginCreateSketch,
    commitCreateSketch,
    beginLine,
    commitLine,
    beginRectangle,`,
    'Line returned workspace functions',
  );
  return source;
});

edit('src/web/App.tsx', (source) => {
  source = replaceExact(
    source,
`    beginCreateSketch,
    commitCreateSketch,
    beginRectangle,`,
`    beginCreateSketch,
    commitCreateSketch,
    beginLine,
    commitLine,
    beginRectangle,`,
    'App Line workspace destructuring',
  );
  source = replaceExact(
    source,
`      createSketch: beginCreateSketch,
      rectangle: beginRectangle,`,
`      createSketch: beginCreateSketch,
      line: beginLine,
      rectangle: beginRectangle,`,
    'App Line action binding',
  );
  source = replaceExact(
    source,
`              <CommandGroup label="Геометрия">
                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} large accent />`,
`              <CommandGroup label="Геометрия">
                <CadUiActionButton action={uiAction('sketch.line')} symbol="╱" large accent />
                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} />`,
    'desktop Line ribbon button',
  );
  source = replaceExact(
    source,
`            {selectionMode !== 'none' && <span className="selection-caption">{selectionMode === 'face' ? 'Выбор грани' : 'Выбор ребра'}</span>}`,
`            {selectionMode !== 'none' && <span className="selection-caption">{selectionMode === 'face' ? 'Выбор грани' : selectionMode === 'edge' ? 'Выбор ребра' : 'Построение отрезка'}</span>}`,
    'Sketch selection caption',
  );
  source = replaceExact(
    source,
`                selectionMode={selectionMode}
                onPick={handleViewportPick}
                viewCommand={viewCommand}`,
`                selectionMode={selectionMode}
                onPick={handleViewportPick}
                viewCommand={viewCommand}
                lineToolActive={activeCommand === 'sketch.line'}
                onCommitLine={commitLine}`,
    'PartModelStage Line props',
  );
  source = replaceExact(
    source,
`                <button className="quick-accept" type="button" onClick={commitActiveCommand} title="Применить (Ctrl+Enter)">✓</button>
                <button className="quick-cancel" type="button" onClick={cancelCommand} title="Отмена (Esc)">×</button>`,
`                {activeCommand !== 'sketch.line' && <button className="quick-accept" type="button" onClick={commitActiveCommand} title="Применить (Ctrl+Enter)">✓</button>}
                <button className="quick-cancel" type="button" onClick={cancelCommand} title="Отмена (Esc)">×</button>`,
    'direct Line command lifecycle controls',
  );
  return source;
});

edit('src/application/commands/SketchCommandHandlers.ts', (source) => replaceExact(
  source,
`    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'line',
        data: { from: command.payload.from, to: command.payload.to },
      });`,
`    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const length = Math.hypot(
        command.payload.to[0] - command.payload.from[0],
        command.payload.to[1] - command.payload.from[1],
      );
      if (length < 0.01) throw new Error('Line length must be non-zero');
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'line',
        data: { from: command.payload.from, to: command.payload.to },
      });`,
  'application Line validation',
));

edit('spec/ui/command-registry.v1.json', (source) => {
  const registry = JSON.parse(source);
  const line = registry.commands.find((command) => command.id === 'sketch.line');
  if (!line) throw new Error('sketch.line missing from command registry');
  if (line.backendCommand !== 'sketch.line') throw new Error('sketch.line backend binding changed unexpectedly');
  line.status = 'implemented';
  return JSON.stringify(registry);
});

edit('src/web/runtime.css', (source) => {
  if (source.includes('.cad-sketch-interaction-layer')) throw new Error('interaction CSS already present');
  return source + `\n\n.cad-sketch-interaction-layer {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  cursor: crosshair;\n  touch-action: none;\n  user-select: none;\n}\n\n.cad-sketch-line-ghost {\n  fill: none;\n  stroke: var(--accent);\n  stroke-width: 1.6px;\n  stroke-dasharray: 4 3;\n  opacity: .8;\n  pointer-events: none;\n}\n\n.cad-sketch-line-anchor {\n  fill: white;\n  stroke: var(--accent);\n  stroke-width: 1.2px;\n  pointer-events: none;\n}\n`;
});

console.log('M3.2 Line wiring applied');
