const fs = require('node:fs');
const path = require('node:path');
const { PRODUCT, assetPrefix, verifyDeliveryPackage, inventory } = require('./three-mode-manifest.cjs');
const { repo, sourceIdentity, prepareOutput, bundleConfig, compile, options } = require('./three-mode-bundle.cjs');

function copyRetained(previous, staging) {
  const compatibility = [];
  const expected = new Map();
  for (const build of previous.builds.values()) {
    const root = 'compatibility/' + build.sourceHead + '/app';
    compatibility.push({ sourceHead: build.sourceHead, version: build.version, workspace: build.workspace,
      product: build.product, root });
    const prefix = build.root + '/';
    for (const item of previous.files.values()) {
      if (!item.path.startsWith(prefix)) continue;
      const relative = root + '/' + item.path.slice(prefix.length);
      const destination = path.join(staging, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(item.file, destination, fs.constants.COPYFILE_FICLONE);
      expected.set(relative, item);
    }
  }
  return { compatibility, expected };
}

function copyRuntimeTools(staging) {
  for (const name of ['three-mode-server.cjs', 'three-mode-http.cjs', 'three-mode-manifest.cjs']) {
    fs.copyFileSync(path.join(__dirname, name), path.join(staging, name));
  }
  const directory = path.join(staging, 'licenses');
  fs.mkdirSync(directory);
  for (const name of ['react', 'react-dom', 'scheduler', 'three', 'opencascade.js', '@salusoft89/planegcs']) {
    const dependency = path.join(repo, 'vendor/toubkal/node_modules', name);
    for (const file of fs.readdirSync(dependency)) {
      if (/^(license|notice|copying)/i.test(file) && fs.statSync(path.join(dependency, file)).isFile()) {
        fs.copyFileSync(path.join(dependency, file), path.join(directory, name.replaceAll('/', '-').replace('@', '') + '-' + file));
      }
    }
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(repo, 'vendor/toubkal', name), path.join(directory, 'upstream-' + name));
  }
  fs.copyFileSync(path.join(repo, 'release/manifest.json'), path.join(staging, 'release-manifest.json'));
}

/** Build the existing product once and retain verified old assets. No listener, installer or data migration. */
async function buildDelivery({ output, previousPackage }) {
  const source = sourceIdentity();
  if (!source.clean) throw new Error('Delivery requires a clean committed HEAD. Use npm run build:asa for precommit product checks.');
  const previous = await verifyDeliveryPackage(previousPackage, { allowLegacy: true });
  if (previous.builds.has(source.head)) throw new Error('An immutable build SHA cannot be reused');
  const target = prepareOutput(output, previous.root);
  try {
    await compile(bundleConfig({ output: path.join(target.staging, 'app'), publicPath: assetPrefix(source.head) }));
    const retained = copyRetained(previous, target.staging);
    copyRuntimeTools(target.staging);
    const files = await inventory(target.staging);
    for (const item of files) {
      const old = retained.expected.get(item.path);
      if (old && (old.bytes !== item.bytes || old.sha256 !== item.sha256)) throw new Error('Retained asset changed while packaging: ' + item.path);
    }
    const finalSource = sourceIdentity();
    if (!finalSource.clean || finalSource.head !== source.head) throw new Error('Source changed during delivery build; candidate discarded');
    const release = JSON.parse(fs.readFileSync(path.join(repo, 'release/manifest.json'), 'utf8'));
    const manifest = { schemaVersion: 1, product: PRODUCT, version: 1, workspace: 'three-mode-launcher',
      launchPort: 8099, localOnly: true, sourceHead: source.head, source,
      cadDocumentSchemaVersion: release.cadDocumentSchemaVersion, createdUTC: new Date().toISOString(),
      fullFusionParity: false, previousManifestSha256: previous.manifestSha256,
      assetRouting: { prefix: assetPrefix(source.head), previousSourceHead: previous.current.sourceHead,
        unversionedSourceHead: previous.manifest.assetRouting.unversionedSourceHead,
        compatibility: retained.compatibility }, files };
    fs.writeFileSync(path.join(target.staging, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await verifyDeliveryPackage(target.staging);
    target.publish();
    return { output: target.output, sourceHead: source.head, assetPrefix: manifest.assetRouting.prefix,
      unversionedSourceHead: manifest.assetRouting.unversionedSourceHead,
      retainedSourceHeads: retained.compatibility.map(build => build.sourceHead),
      files: files.length, totalBytes: files.reduce((sum, item) => sum + item.bytes, 0),
      rollback: 'node three-mode-server.cjs --package . --port 8099 --active-build ' + previous.current.sourceHead };
  } catch (error) { target.discard(); throw error; }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = options(process.argv.slice(2), ['--out', '--previous-package']);
    return buildDelivery({ output: args['--out'], previousPackage: args['--previous-package'] });
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
module.exports = { buildDelivery };
