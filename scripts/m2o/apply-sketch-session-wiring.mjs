import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`SketchSession codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

function replaceAllExact(path, before, after, expectedCount) {
  let source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== expectedCount) throw new Error(`SketchSession codemod expected ${expectedCount} occurrences in ${path}, found ${count}`);
  source = source.split(before).join(after);
  writeFileSync(path, source);
}

patch('src/web/usePartSketchWorkspace.ts', [
  [
    'CadSketch type import',
    "import type { CadDocument, CadDocumentKind, CadPartDocument } from '../contracts/document';",
    "import type { CadDocument, CadDocumentKind, CadPartDocument, CadSketch } from '../contracts/document';",
  ],
  [
    'CadSketchId import',
    '  CadDimensionId,\n  CadSketchEntityId,',
    '  CadDimensionId,\n  CadSketchEntityId,\n  CadSketchId,',
  ],
  [
    'SketchSession hook import',
    "import type { CadViewportPick } from '../contracts/render';\n",
    "import type { CadViewportPick } from '../contracts/render';\nimport { useSketchSession } from './useSketchSession';\n",
  ],
  [
    'explicit active Sketch session',
    '  const part = partDocument(document);\n  const sketch = latestSketch(part);',
    `  const part = partDocument(document);
  const {
    activeSketchId,
    activeSketch: sketch,
    enterSketch: activateSketch,
    clearActiveSketch,
  } = useSketchSession(part);`,
  ],
  [
    'document reset clears Sketch session',
    "  const resetForDocument = useCallback((kind: CadDocumentKind) => {\n    resetToWorkspace(kind === 'part' ? 'solid' : kind);\n  }, [resetToWorkspace]);",
    "  const resetForDocument = useCallback((kind: CadDocumentKind) => {\n    clearActiveSketch();\n    resetToWorkspace(kind === 'part' ? 'solid' : kind);\n  }, [clearActiveSketch, resetToWorkspace]);",
  ],
  [
    'explicit tree Sketch entry',
    `  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    setSelectedBodyId(bodyId);
    setSelectedPick(null);
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, [setNotice]);
`,
    `  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    setSelectedBodyId(bodyId);
    setSelectedPick(null);
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, [setNotice]);

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    const currentPart = partDocument(app.getDocument());
    const target = findSketch(currentPart, sketchId);
    if (!target) {
      setNotice('Эскиз больше не существует');
      clearActiveSketch();
      return;
    }
    activateSketch(sketchId);
    setActiveCommand(null);
    setEditingDimensionId(null);
    setPanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
    setNotice(\`Открыт эскиз «\${target.name}»\`);
  }, [activateSketch, app, clearActiveSketch, clearTransientSelection, setNotice, setPanel]);
`,
  ],
  [
    'created Sketch activates session',
    `    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    const supportText = currentPart?.bodies.length ? 'выбранной грани' : \`плоскости \${sketchPlane}\`;`,
    `    const createdSketchId = result.createdIds?.[0] as CadSketchId | undefined;
    if (!result.ok || !createdSketchId) {
      setNotice(result.error?.message ?? 'Не удалось создать эскиз');
      return;
    }
    activateSketch(createdSketchId);
    const supportText = currentPart?.bodies.length ? 'выбранной грани' : \`плоскости \${sketchPlane}\`;`,
  ],
  [
    'dimension edit activates owner Sketch',
    `    const dimension = currentPart?.dimensions.find((item) => item.id === id);
    if (!dimension || !dimension.driving) return;
    setEditingDimensionId(id);`,
    `    const dimension = currentPart?.dimensions.find((item) => item.id === id);
    if (!dimension || !dimension.driving) return;
    const ownerSketch = currentPart?.sketches.find((item) => item.dimensionIds.includes(id));
    if (ownerSketch) activateSketch(ownerSketch.id);
    setEditingDimensionId(id);`,
  ],
  [
    'return active Sketch session',
    `    activeWorkspace,
    setActiveWorkspace,
    activeCommand,`,
    `    activeWorkspace,
    setActiveWorkspace,
    activeCommand,
    activeSketchId,`,
  ],
  [
    'return Sketch entry callback',
    `    handleViewportPick,
    handleBodySelect,
    beginCreateSketch,`,
    `    handleViewportPick,
    handleBodySelect,
    enterSketch,
    beginCreateSketch,`,
  ],
  [
    'replace latest Sketch helper',
    `function latestSketch(part: Readonly<CadPartDocument> | null) {
  return part?.sketches.at(-1) ?? null;
}

function hasRectangle(sketch: ReturnType<typeof latestSketch>): boolean {`,
    `function findSketch(
  part: Readonly<CadPartDocument> | null,
  sketchId: CadSketchId | null,
): Readonly<CadSketch> | null {
  if (!part || !sketchId) return null;
  return part.sketches.find((item) => item.id === sketchId) ?? null;
}

function hasRectangle(sketch: Readonly<CadSketch> | null): boolean {`,
  ],
  [
    'circle helper type',
    'function hasCircle(sketch: ReturnType<typeof latestSketch>): boolean {',
    'function hasCircle(sketch: Readonly<CadSketch> | null): boolean {',
  ],
]);

replaceAllExact(
  'src/web/usePartSketchWorkspace.ts',
  '    const currentSketch = latestSketch(currentPart);',
  '    const currentSketch = findSketch(currentPart, activeSketchId);',
  5,
);

patch('src/web/DocumentTree.tsx', [
  [
    'Sketch ID import',
    "import type { CadBodyId, CadDimensionId } from '../contracts/ids';",
    "import type { CadBodyId, CadDimensionId, CadSketchId } from '../contracts/ids';",
  ],
  [
    'Sketch session props',
    `  selectedBodyId: CadBodyId | null;
  onSelectBody(id: CadBodyId | null): void;
  onEditDimension(id: CadDimensionId): void;`,
    `  selectedBodyId: CadBodyId | null;
  activeSketchId: CadSketchId | null;
  onSelectBody(id: CadBodyId | null): void;
  onEditSketch(id: CadSketchId): void;
  onEditDimension(id: CadDimensionId): void;`,
  ],
  [
    'Sketch props destructuring',
    `  selectedBodyId,
  onSelectBody,
  onEditDimension,`,
    `  selectedBodyId,
  activeSketchId,
  onSelectBody,
  onEditSketch,
  onEditDimension,`,
  ],
  [
    'interactive Sketch rows',
    `            {document.sketches.map((item) => (
              <TreeRow key={item.id} depth={1} icon="⌗" label={item.name} />
            ))}`,
    `            {document.sketches.map((item) => (
              <TreeRow
                key={item.id}
                depth={1}
                icon="⌗"
                label={item.name}
                selected={item.id === activeSketchId}
                sketchId={item.id}
                onClick={() => onEditSketch(item.id)}
              />
            ))}`,
  ],
  [
    'TreeRow Sketch identity prop',
    `  selected?: boolean;
  bodyId?: CadBodyId;
  onClick?: () => void;`,
    `  selected?: boolean;
  bodyId?: CadBodyId;
  sketchId?: CadSketchId;
  onClick?: () => void;`,
  ],
  [
    'TreeRow data and aria contract',
    `      data-body-id={props.bodyId}
      aria-pressed={props.bodyId ? Boolean(props.selected) : undefined}`,
    `      data-body-id={props.bodyId}
      data-sketch-id={props.sketchId}
      aria-pressed={props.bodyId || props.sketchId ? Boolean(props.selected) : undefined}`,
  ],
]);

patch('src/web/App.tsx', [
  [
    'workspace active Sketch destructuring',
    `    activeWorkspace,
    setActiveWorkspace,
    activeCommand,`,
    `    activeWorkspace,
    setActiveWorkspace,
    activeCommand,
    activeSketchId,`,
  ],
  [
    'workspace Sketch entry destructuring',
    `    handleViewportPick,
    handleBodySelect,
    beginCreateSketch,`,
    `    handleViewportPick,
    handleBodySelect,
    enterSketch,
    beginCreateSketch,`,
  ],
  [
    'active Sketch debug contract',
    `      data-selected-body-id={selectedBodyId ?? ''}
      data-shortcuts="central"`,
    `      data-selected-body-id={selectedBodyId ?? ''}
      data-active-sketch-id={activeSketchId ?? ''}
      data-shortcuts="central"`,
  ],
  [
    'DocumentTree Sketch session wiring',
    `              document={document}
              selectedBodyId={selectedBodyId}
              onSelectBody={handleBodySelect}
              onEditDimension={beginDimensionEdit}`,
    `              document={document}
              selectedBodyId={selectedBodyId}
              activeSketchId={activeSketchId}
              onSelectBody={handleBodySelect}
              onEditSketch={enterSketch}
              onEditDimension={beginDimensionEdit}`,
  ],
]);

patch('tests/m2o/app-decomposition.mjs', [
  [
    'SketchSession sources',
    `const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
`,
    `const workspace = readFileSync('src/web/usePartSketchWorkspace.ts', 'utf8');
const sketchSession = readFileSync('src/web/SketchSession.ts', 'utf8');
const sketchSessionHook = readFileSync('src/web/useSketchSession.ts', 'utf8');
`,
  ],
  [
    'Sketch tree DOM contract',
    `assert.match(tree, /data-body-id=\\{props\\.bodyId\\}/, 'tree/body selection DOM contract must be preserved');
assert.match(tree, /aria-pressed=\\{props\\.bodyId \\? Boolean\\(props\\.selected\\) : undefined\\}/, 'tree accessibility selection contract must be preserved');`,
    `assert.match(tree, /data-body-id=\\{props\\.bodyId\\}/, 'tree/body selection DOM contract must be preserved');
assert.match(tree, /data-sketch-id=\\{props\\.sketchId\\}/, 'tree must expose explicit Sketch identity for session selection');
assert.match(tree, /onEditSketch\\(item\\.id\\)/, 'Sketch tree rows must explicitly enter the selected Sketch session');`,
  ],
  [
    'workspace explicit Sketch session guards',
    `assert.match(workspace, /app\\.captureReference\\(/, 'workspace controller must capture topology through CadApplication');
`,
    `assert.match(workspace, /app\\.captureReference\\(/, 'workspace controller must capture topology through CadApplication');
assert.match(workspace, /useSketchSession\\(part\\)/, 'workspace must own an explicit SketchSession');
assert.match(workspace, /activeSketchId/, 'workspace must route Sketch commands through explicit activeSketchId');
assert.doesNotMatch(workspace, /latestSketch\\(/, 'implicit latest-Sketch active context must not return');
assert.match(sketchSession, /activeSketchId: CadSketchId \\| null/, 'SketchSession must own explicit activeSketchId');
assert.match(sketchSession, /resolveActiveSketch/, 'SketchSession must resolve selection by stable Sketch ID');
assert.match(sketchSessionHook, /reconcileSketchSession/, 'React SketchSession owner must invalidate stale IDs after document changes');
`,
  ],
]);

patch('package.json', [
  [
    'SketchSession test script',
    '    "test:m2o:semantics": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/semantic-document-validation.ts",\n    "test:m2o":',
    '    "test:m2o:semantics": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/semantic-document-validation.ts",\n    "test:m2o:sketch-session": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-session.ts",\n    "test:m2o":',
  ],
  [
    'SketchSession gate inclusion',
    'npm run test:m2o:sketch-contracts && npm run test:m2o:semantics",',
    'npm run test:m2o:sketch-contracts && npm run test:m2o:semantics && npm run test:m2o:sketch-session",',
  ],
]);

for (const path of [
  'scripts/m2o/apply-sketch-session-wiring.mjs',
  '.github/workflows/m2o-sketch-session-codemod.yml',
]) {
  if (existsSync(path)) rmSync(path);
}

console.log('Applied explicit SketchSession/activeSketchId wiring and removed one-shot codemod');
