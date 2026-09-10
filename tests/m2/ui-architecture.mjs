import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const WEB_ROOT = 'src/web';
const APP_PATH = join(WEB_ROOT, 'App.tsx');

// App.tsx is already too large. Freeze growth immediately; M2O must shrink it
// before M3 adds broad sketch command families.
const MAX_APP_BYTES = 62_500;
const appBytes = statSync(APP_PATH).size;
assert.ok(
  appBytes <= MAX_APP_BYTES,
  `App.tsx grew to ${appBytes} bytes (limit ${MAX_APP_BYTES}). Extract a focused controller/component instead of growing the god-object.`,
);

function filesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

const presentationFiles = filesRecursively(WEB_ROOT).filter((path) => {
  const extension = extname(path);
  return extension === '.ts' || extension === '.tsx';
});

for (const path of presentationFiles) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(
    source,
    /document\.querySelector|document\.querySelectorAll/,
    `${path}: presentation must communicate through typed React/actions/refs, not discover sibling UI through document queries`,
  );
  assert.doesNotMatch(
    source,
    /from\s+['"][^'"]*vendor\/toubkal|from\s+['"][^'"]*opencascade/i,
    `${path}: product presentation must not import vendor/OpenCascade implementation directly`,
  );
}

const appSource = readFileSync(APP_PATH, 'utf8');
assert.doesNotMatch(
  appSource,
  /localStorage\.|indexedDB|asa-cad-project:/,
  'App.tsx must persist through CadEditorPersistence/CadProjectSession, not own storage keys or browser persistence APIs',
);
assert.match(
  appSource,
  /CadEditorPersistence/,
  'App.tsx must use the editor persistence facade until persistence ownership is moved into a higher editor controller',
);

console.log(`ASA-CAD M2 UI architecture PASS (App.tsx ${appBytes}/${MAX_APP_BYTES} bytes; ${presentationFiles.length} TS/TSX presentation files checked)`);
