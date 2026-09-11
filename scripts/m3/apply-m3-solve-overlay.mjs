import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`M3.1 codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/web/App.tsx', [
  [
    'M3 solve-overlay imports',
    "import { usePartSketchWorkspace } from './usePartSketchWorkspace';\n",
    "import { usePartSketchWorkspace } from './usePartSketchWorkspace';\nimport { useSketchSolveOverlay } from './useSketchSolveOverlay';\nimport { StatusBar } from './StatusBar';\n",
  ],
  [
    'revision token value',
    '  const [, setRevisionToken] = useState(0);',
    '  const [revisionToken, setRevisionToken] = useState(0);',
  ],
  [
    'solve-overlay hook',
    `  } = workspace;

  useEffect(() => {`,
    `  } = workspace;
  const { solveSnapshot, sketchOverlay } = useSketchSolveOverlay({
    document,
    activeSketchId,
    activeSketch: sketch,
    active: document.kind === 'part' && activeWorkspace === 'sketch',
    revisionToken,
  });

  useEffect(() => {`,
  ],
  [
    'viewport overlay activation',
    `                {renderModel ? (
                  <CadViewport
                    model={renderModel}
                    selectionMode={selectionMode}`,
    `                {renderModel || sketchOverlay ? (
                  <CadViewport
                    model={renderModel}
                    sketchOverlay={sketchOverlay}
                    selectionMode={selectionMode}`,
  ],
  [
    'focused StatusBar owner',
    `      <footer className="status-bar">
        <div className="status-left">
          <span className={\`status-indicator \${state.recompute.status}\`} />
          <span>{notice}</span>
        </div>
        <div className="status-right">
          {devFixture && <span>fixture:{devFixture}</span>}
          {selectedPick && <span>{selectedPick.kind === 'face' ? 'Грань' : 'Ребро'}: {selectedPointText}</span>}
          {selectedBody && <span>Выбрано: {selectedBody.name}</span>}
          <span>{documentNames[document.kind]}</span>
          <span>{runtimeState.status === 'ready' ? 'OCC локально' : 'ядро по требованию'}</span>
          <span>мм</span>
          <span>UI 100%</span>
          <span>M2</span>
        </div>
      </footer>`,
    `      <StatusBar
        recomputeStatus={state.recompute.status}
        notice={notice}
        fixture={devFixture}
        selectedPick={selectedPick}
        selectedPointText={selectedPointText}
        selectedBodyName={selectedBody?.name}
        documentName={documentNames[document.kind]}
        runtimeReady={runtimeState.status === 'ready'}
        sketchSolveActive={document.kind === 'part' && activeWorkspace === 'sketch'}
        solveSnapshot={solveSnapshot}
      />`,
  ],
]);

patch('tests/m2/part-browser.mjs', [
  [
    'rectangle OpenCascade laziness assertion',
    "  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded during 2D rectangle authoring');",
    "  assert.equal(await page.locator('.cad-app').getAttribute('data-runtime-status'), 'idle', 'OpenCascade runtime loaded during 2D rectangle authoring');",
  ],
  [
    'pre-solid OpenCascade laziness assertion',
    "  assert.deepEqual(await loadedWasmResources(), [], 'OpenCascade WASM loaded before the solid command was committed');",
    "  assert.equal(await page.locator('.cad-app').getAttribute('data-runtime-status'), 'idle', 'OpenCascade runtime loaded before the solid command was committed');",
  ],
  [
    'generic WASM summary',
    "  console.log(`  ✓ lazy WASM: ${loadedWasm.length} resource(s), first solid only`);",
    "  console.log(`  ✓ lazy OpenCascade runtime: solid starts only at first B-Rep operation; ${loadedWasm.length} WASM resource(s) total`);",
  ],
]);

patch('package.json', [
  [
    'M3 foundation test script',
    '    "test:m2o": "npm run test:m2o:docs && npm run test:m2o:registry && npm run test:m2o:persistence && npm run test:m2o:actions && npm run test:m2o:decomposition && npm run test:m2o:handlers && npm run test:m2o:sketch-contracts && npm run test:m2o:semantics && npm run test:m2o:sketch-session && npm run test:m2o:solve-cycle && npm run test:m2o:viewport-interaction && npm run test:m2o:viewport-camera && npm run test:m2o:sketch-overlay",\n    "test:asa":',
    '    "test:m2o": "npm run test:m2o:docs && npm run test:m2o:registry && npm run test:m2o:persistence && npm run test:m2o:actions && npm run test:m2o:decomposition && npm run test:m2o:handlers && npm run test:m2o:sketch-contracts && npm run test:m2o:semantics && npm run test:m2o:sketch-session && npm run test:m2o:solve-cycle && npm run test:m2o:viewport-interaction && npm run test:m2o:viewport-camera && npm run test:m2o:sketch-overlay",\n    "test:m3:foundation": "node tests/m3/solve-overlay-boundary.mjs",\n    "test:asa":',
  ],
  [
    'M3 foundation in aggregate test',
    'npm run test:m2:shell && npm run test:m2o",',
    'npm run test:m2:shell && npm run test:m2o && npm run test:m3:foundation",',
  ],
]);

patch('.github/workflows/m2-shell.yml', [
  [
    'M3 shell paths push',
    '      - tests/m2o/**\n      - package.json',
    '      - tests/m2o/**\n      - tests/m3/**\n      - package.json',
  ],
  [
    'M3 shell paths pull request',
    '      - tests/m2o/**\n      - package.json',
    '      - tests/m2o/**\n      - tests/m3/**\n      - package.json',
  ],
  [
    'M3 foundation required step',
    `      - name: Verify M2O optimization gates
        run: npm run test:m2o

      - name: Verify neutral OpenCascade render bridge`,
    `      - name: Verify M2O optimization gates
        run: npm run test:m2o

      - name: Verify M3 foundation boundaries
        run: npm run test:m3:foundation

      - name: Verify neutral OpenCascade render bridge`,
  ],
]);

patch('.github/workflows/m2-browser.yml', [
  [
    'M3 browser paths push',
    '      - build/**\n      - tests/m2/**',
    '      - build/**\n      - tests/m2/**\n      - tests/m3/**',
  ],
  [
    'M3 browser paths pull request',
    '      - build/**\n      - tests/m2/**',
    '      - build/**\n      - tests/m2/**\n      - tests/m3/**',
  ],
  [
    'M3 solve-overlay browser step',
    `      - name: Exercise shared mobile action tools
        env:
          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/
        run: node tests/m2/mobile-tools-browser.mjs

      - name: Exercise full protected Part workflow`,
    `      - name: Exercise shared mobile action tools
        env:
          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/
        run: node tests/m2/mobile-tools-browser.mjs

      - name: Exercise M3 active Sketch solve overlay
        env:
          ASA_CAD_SHELL_URL: http://127.0.0.1:8090/
        run: node tests/m3/solve-overlay-browser.mjs

      - name: Exercise full protected Part workflow`,
  ],
]);

for (const tempPath of [
  'scripts/m3/apply-m3-solve-overlay.mjs',
  '.github/workflows/m3-solve-overlay-codemod.yml',
]) {
  if (existsSync(tempPath)) rmSync(tempPath);
}

console.log('Applied M3.1 solve-overlay wiring and removed one-shot codemod');
