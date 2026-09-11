import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
const camera = readFileSync('src/web/viewport/ViewportCameraController.ts', 'utf8');

assert.match(viewport, /new ViewportCameraController/, 'CadViewport must delegate ASA view commands to camera controller');
assert.doesNotMatch(viewport, /const fitDistance =/, 'fit-distance policy must not return to the Three effect');
assert.doesNotMatch(viewport, /view\.startsWith\('pan-'\)/, 'pan command policy must not return to the Three effect');
assert.doesNotMatch(viewport, /view === 'isometric'[^\n]*new THREE\.Vector3/, 'standard-view direction mapping must not return to Three effect');

assert.doesNotMatch(camera, /from ['"][^'"]*three[^'"]*['"]/, 'camera controller must remain Three-independent');
assert.doesNotMatch(camera, /:\s*(?:HTMLElement|PointerEvent|MouseEvent|OrbitControls)\b/, 'camera controller must not depend on DOM/OrbitControls types');
assert.doesNotMatch(camera, /from ['"][^'"]*(?:application|runtime)[^'"]*['"]/, 'camera-only navigation must not import CAD application/runtime layers');
assert.match(camera, /setView\(view: CadViewportViewName\)/, 'camera controller must own view command interpretation');
assert.match(camera, /fitDistance\(/, 'camera controller must own fit-distance policy');

console.log('M2O O8 camera boundary PASS (navigation math outside Three effect and CAD runtime)');
