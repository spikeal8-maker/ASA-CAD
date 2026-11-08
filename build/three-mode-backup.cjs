const fs = require('node:fs');
const path = require('node:path');
const { inventory } = require('./three-mode-manifest.cjs');
const { sourceIdentity, prepareOutput, bundleConfig, compile, options } = require('./three-mode-bundle.cjs');

/** A separately reviewable, button-driven backup page. This command never installs or exports user data. */
async function buildBackupPage({ output, assetPrefix }) {
  if (!/^\/__asa_builds\/[a-f0-9]{40}\/preflight-backup\/$/.test(assetPrefix)) {
    throw new Error('--asset-prefix must be /__asa_builds/<40-character SHA>/preflight-backup/');
  }
  const source = sourceIdentity();
  const target = prepareOutput(output);
  try {
    const stats = await compile(bundleConfig({ output: target.staging, publicPath: assetPrefix, backupOnly: true }));
    const emitted = stats.toJson({ all: false, assets: true, modules: true, nestedModules: true });
    const javascript = emitted.assets.filter(asset => asset.name.endsWith('.js'));
    if (javascript.length !== 1 || javascript[0].name !== 'backup.js'
      || emitted.assets.some(asset => /\.(?:wasm|css)$/.test(asset.name))) throw new Error('Backup must emit a single JS bundle and no runtime/CSS chunks');
    const forbidden = /(?:[\\/](?:react(?:-dom)?|three|opencascade\.js|planegcs)[\\/]|\.wasm(?:\?|$))/i;
    const inspect = modules => {
      for (const module of modules ?? []) {
        if (forbidden.test(module.name ?? '')) throw new Error('Backup imported a forbidden CAD/UI runtime: ' + module.name);
        inspect(module.modules);
      }
    };
    inspect(emitted.modules);
    const manifest = { schemaVersion: 1, product: 'ASA-CAD-Browser-Backup-Page',
      source, assetPrefix, createdUTC: new Date().toISOString(),
      purpose: 'User-clicked read-only local-document export; not a CAD release or completed backup',
      files: await inventory(target.staging) };
    fs.writeFileSync(path.join(target.staging, 'backup-page-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    target.publish();
    return { output: target.output, source, assetPrefix, files: manifest.files };
  } catch (error) { target.discard(); throw error; }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = options(process.argv.slice(2), ['--out', '--asset-prefix']);
    return buildBackupPage({ output: args['--out'], assetPrefix: args['--asset-prefix'] });
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
module.exports = { buildBackupPage };
