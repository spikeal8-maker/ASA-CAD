import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const path = 'src/web/CadViewport.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O8.2 codemod could not find ${label}`);
  source = source.replace(before, after);
}

function replaceBetween(label, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`O8.2 codemod could not locate ${label}`);
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

replaceOnce(
  'camera controller import',
  "import { ViewportSelectionController } from './viewport/ViewportSelectionController';\n",
  `import { ViewportSelectionController } from './viewport/ViewportSelectionController';
import {
  ViewportCameraController,
  type CadViewportViewName,
  type ViewportCameraPose,
} from './viewport/ViewportCameraController';
`,
);

replaceBetween(
  'local view-name union',
  'export type CadViewportViewName =',
  'export interface CadViewportViewCommand {',
  `export type { CadViewportViewName } from './viewport/ViewportCameraController';

`,
);

replaceBetween(
  'camera view math',
  '        const fitDistance = () => {',
  '        const faceGroupAtTriangle = (',
  `        const finishViewMutation = (view: CadViewportViewName, pose: ViewportCameraPose) => {
          camera.position.set(...pose.position);
          controls.target.set(...pose.target);
          camera.up.set(...pose.up);
          camera.lookAt(controls.target);
          controls.update();
          const currentHost = hostRef.current;
          if (currentHost) currentHost.dataset.viewName = view;
          writeCameraState();
          render();
        };

        const cameraController = new ViewportCameraController({
          center: [center.x, center.y, center.z],
          diagonal,
          readState: () => ({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
            up: [camera.up.x, camera.up.y, camera.up.z],
            fovDegrees: camera.fov,
            aspect: camera.aspect,
            minDistance: controls.minDistance,
            maxDistance: controls.maxDistance,
          }),
          applyPose: finishViewMutation,
        });

        const setView = (view: CadViewportViewName) => cameraController.setView(view);

`,
);

writeFileSync(path, source);

let pkg = readFileSync('package.json', 'utf8');
const beforeScript = '    "test:m2o:viewport-interaction": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-picking.ts && node tests/m2o/viewport-interaction-boundary.mjs",\n    "test:m2o":';
const afterScript = '    "test:m2o:viewport-interaction": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-picking.ts && node tests/m2o/viewport-interaction-boundary.mjs",\n    "test:m2o:viewport-camera": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-camera.ts && node tests/m2o/viewport-camera-boundary.mjs",\n    "test:m2o":';
if (!pkg.includes(beforeScript)) throw new Error('O8.2 codemod could not add camera test script');
pkg = pkg.replace(beforeScript, afterScript);
const beforeGate = 'npm run test:m2o:solve-cycle && npm run test:m2o:viewport-interaction",';
const afterGate = 'npm run test:m2o:solve-cycle && npm run test:m2o:viewport-interaction && npm run test:m2o:viewport-camera",';
if (!pkg.includes(beforeGate)) throw new Error('O8.2 codemod could not include camera gate');
pkg = pkg.replace(beforeGate, afterGate);
writeFileSync('package.json', pkg);

for (const tempPath of [
  'scripts/m2o/apply-o8-camera-navigation.mjs',
  '.github/workflows/m2o-o8-camera-navigation-codemod.yml',
]) {
  if (existsSync(tempPath)) rmSync(tempPath);
}

console.log('Applied O8.2 camera navigation extraction and removed one-shot codemod');
