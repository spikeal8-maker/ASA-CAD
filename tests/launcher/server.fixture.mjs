import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PRODUCT, LEGACY_PRODUCT, REQUIRED_RETAINED_HEADS, assetPrefix, inventory } = require('../../build/three-mode-manifest.cjs');
export const candidateHead = 'f'.repeat(40);
export const oldHeads = REQUIRED_RETAINED_HEADS;

/** Tiny protocol fixtures only: these bytes do not represent a shipped CAD build. */
export async function makePackage() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asa-three-mode-server-'));
  for (const head of [candidateHead, ...oldHeads]) {
    const app = head === candidateHead ? 'app' : 'compatibility/' + head + '/app';
    fs.mkdirSync(path.join(root, app, 'wasm'), { recursive: true });
    fs.writeFileSync(path.join(root, app, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="'
      + assetPrefix(head) + 'main.css"></head><body data-source="' + head + '"><script src="'
      + assetPrefix(head) + 'main.js"></script></body></html>');
    fs.writeFileSync(path.join(root, app, 'main.js'), 'globalThis.fixtureHead=' + JSON.stringify(head) + ';');
    fs.writeFileSync(path.join(root, app, 'lazy.js'), 'globalThis.deferredFixtureHead=' + JSON.stringify(head) + ';');
    fs.writeFileSync(path.join(root, app, 'main.css'), 'body{--fixture-head:"' + head + '"}');
    fs.writeFileSync(path.join(root, app, 'wasm/kernel.wasm'), Buffer.concat([Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]), Buffer.from(head)]));
    if (head === candidateHead) {
      fs.mkdirSync(path.join(root, app, 'backup'));
      fs.writeFileSync(path.join(root, app, 'backup/index.html'), '<!doctype html><title>Backup fixture</title><script src="'
        + assetPrefix(head) + 'backup.js"></script>');
      fs.writeFileSync(path.join(root, app, 'backup.js'), 'globalThis.backupFixture=' + JSON.stringify(head) + ';');
    }
  }
  const manifest = {
    schemaVersion: 1, product: PRODUCT, version: 1, workspace: 'three-mode-launcher',
    sourceHead: candidateHead, launchPort: 8099, localOnly: true, cadDocumentSchemaVersion: 3,
    source: { head: candidateHead, clean: true, builder: 'rspack' },
    assetRouting: { prefix: assetPrefix(candidateHead), previousSourceHead: oldHeads[0],
      unversionedSourceHead: oldHeads[1], compatibility: oldHeads.map((sourceHead, index) => ({
        sourceHead, version: 8 - index, workspace: 'fusion-sketch-v1', product: LEGACY_PRODUCT,
        root: 'compatibility/' + sourceHead + '/app',
      })) },
    files: await inventory(root),
  };
  const writeManifest = () => fs.writeFileSync(path.join(root, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeManifest();
  return { root, manifest, writeManifest, remove: () => fs.rmSync(root, { recursive: true, force: true }) };
}
