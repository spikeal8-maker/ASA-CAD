import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`O8.3 codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/web/CadViewport.tsx', [
  [
    'Sketch overlay imports',
    "import { ViewportSelectionController } from './viewport/ViewportSelectionController';\n",
    `import { ViewportSelectionController } from './viewport/ViewportSelectionController';
import { SketchOverlayLayer } from './viewport/SketchOverlayLayer';
import type { SketchOverlayModel } from './viewport/SketchOverlayModel';
`,
  ],
  [
    'Sketch overlay prop',
    `export interface CadViewportProps {
  model: CadRenderModel | null;
  selectionMode?: ViewportSelectionMode;`,
    `export interface CadViewportProps {
  model: CadRenderModel | null;
  /** Separate transient 2D Sketch surface; never merged into B-Rep CadRenderModel. */
  sketchOverlay?: SketchOverlayModel | null;
  selectionMode?: ViewportSelectionMode;`,
  ],
  [
    'Sketch overlay destructuring',
    `export function CadViewport({
  model,
  selectionMode = 'none',`,
    `export function CadViewport({
  model,
  sketchOverlay = null,
  selectionMode = 'none',`,
  ],
  [
    'Sketch overlay render',
    `    >
      {error && <div className="cad-viewport-error">{error}</div>}
    </div>`,
    `    >
      <SketchOverlayLayer model={sketchOverlay} />
      {error && <div className="cad-viewport-error">{error}</div>}
    </div>`,
  ],
]);

patch('package.json', [
  [
    'Sketch overlay test script',
    '    "test:m2o:viewport-camera": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-camera.ts && node tests/m2o/viewport-camera-boundary.mjs",\n    "test:m2o":',
    '    "test:m2o:viewport-camera": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-camera.ts && node tests/m2o/viewport-camera-boundary.mjs",\n    "test:m2o:sketch-overlay": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-overlay-model.ts && node tests/m2o/sketch-overlay-boundary.mjs",\n    "test:m2o":',
  ],
  [
    'Sketch overlay gate inclusion',
    'npm run test:m2o:viewport-interaction && npm run test:m2o:viewport-camera",',
    'npm run test:m2o:viewport-interaction && npm run test:m2o:viewport-camera && npm run test:m2o:sketch-overlay",',
  ],
]);

for (const tempPath of [
  'scripts/m2o/apply-o8-sketch-overlay.mjs',
  '.github/workflows/m2o-o8-sketch-overlay-codemod.yml',
]) {
  if (existsSync(tempPath)) rmSync(tempPath);
}

console.log('Applied O8.3 Sketch overlay seam and removed one-shot codemod');
