const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PRODUCT = 'ASA-CAD-Three-Mode';
const LEGACY_PRODUCT = 'ASA-CAD-Fusion-Live';
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_RETAINED_HEADS = Object.freeze([
  'c1959b1e84a7c38288022622a9585a38c07d3f7e',
  '2420935b7d0642d7994a24231f3e123f42dae19d',
  'cb7006efe7a108bc85bcf99d3a3e4a9c2f73568b',
]);
const assetPrefix = head => '/__asa_builds/' + head + '/';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => file === root || file.startsWith(root + path.sep);

function safeRelative(value) {
  if (typeof value !== 'string' || !value || /[\\:\0?#]/.test(value)
    || value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe delivery path: ' + value);
  }
  return value;
}

function containedFile(root, relative) {
  const parts = safeRelative(relative).split('/');
  let file = root;
  for (let index = 0; index < parts.length; index += 1) {
    file = path.join(file, parts[index]);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error('Delivery paths must contain regular files/directories: ' + relative);
    }
  }
  if (!inside(root, fs.realpathSync(file))) throw new Error('Delivery file escaped its package');
  return file;
}

async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for await (const chunk of fs.createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest('hex') };
}

function buildMetadata(item, root, fallbackProduct) {
  if (!SHA.test(item.sourceHead) || !Number.isInteger(item.version) || item.version < 1
    || typeof item.workspace !== 'string' || !/^[a-z0-9-]+$/.test(item.workspace)) {
    throw new Error('Invalid delivery build metadata');
  }
  const product = item.product ?? fallbackProduct;
  if (![PRODUCT, LEGACY_PRODUCT].includes(product)) throw new Error('Unrecognized retained product');
  return { sourceHead: item.sourceHead, version: item.version, workspace: item.workspace, product, root };
}

/** Verify all listed bytes before a listener opens. Unlisted files are never served/copied. */
async function verifyDeliveryPackage(folder, { allowLegacy = false } = {}) {
  const root = fs.realpathSync(path.resolve(folder));
  const manifestFile = containedFile(root, 'delivery-manifest.json');
  const raw = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(raw);
  if (!manifest || typeof manifest !== 'object' || manifest.schemaVersion !== 1 || manifest.launchPort !== 8099 || manifest.localOnly !== true
    || ![PRODUCT, ...(allowLegacy ? [LEGACY_PRODUCT] : [])].includes(manifest.product)
    || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('A valid loopback delivery-manifest.json is required');
  }
  const current = buildMetadata(manifest, 'app', manifest.product);
  const routing = manifest.assetRouting;
  if (!routing || routing.prefix !== assetPrefix(current.sourceHead) || !Array.isArray(routing.compatibility)
    || !SHA.test(routing.unversionedSourceHead)) throw new Error('Invalid immutable asset routing');
  const builds = new Map([[current.sourceHead, current]]);
  for (const item of routing.compatibility) {
    if (!SHA.test(item.sourceHead) || builds.has(item.sourceHead)
      || item.root !== 'compatibility/' + item.sourceHead + '/app') throw new Error('Invalid retained build root');
    builds.set(item.sourceHead, buildMetadata(item, item.root, manifest.product));
  }
  for (const head of REQUIRED_RETAINED_HEADS) {
    if (!builds.has(head)) throw new Error('Required old asset owner is missing: ' + head);
  }
  if (!builds.has(routing.unversionedSourceHead)) throw new Error('The unversioned asset owner is not retained');
  if (routing.previousSourceHead !== null && (!SHA.test(routing.previousSourceHead)
    || !builds.has(routing.previousSourceHead))) throw new Error('The rollback build is not retained');
  if (manifest.product === PRODUCT && (!Number.isInteger(manifest.cadDocumentSchemaVersion)
    || manifest.cadDocumentSchemaVersion < 1 || manifest.source?.clean !== true
    || manifest.source?.head !== current.sourceHead || manifest.source?.builder !== 'rspack')) {
    throw new Error('Delivery must identify the clean product source and document schema');
  }

  const files = new Map();
  const caseInsensitive = new Set();
  for (const item of manifest.files) {
    const relative = safeRelative(item.path);
    if (relative === 'delivery-manifest.json' || caseInsensitive.has(relative.toLowerCase())
      || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !SHA256.test(item.sha256)) {
      throw new Error('Invalid or duplicate delivery file record: ' + relative);
    }
    caseInsensitive.add(relative.toLowerCase());
    const file = containedFile(root, relative);
    const actual = await hashFile(file);
    if (actual.bytes !== item.bytes || actual.sha256 !== item.sha256) {
      throw new Error('Delivery checksum mismatch: ' + relative);
    }
    files.set(relative, { ...item, file, mtimeMs: fs.statSync(file).mtimeMs });
  }
  for (const build of builds.values()) {
    if (!files.has(build.root + '/index.html')) throw new Error('Retained app has no verified entry: ' + build.sourceHead);
  }
  if (manifest.product === PRODUCT) {
    validateEntry(files, current, 'index.html');
    validateEntry(files, current, 'backup/index.html');
  }
  return { root, manifest, manifestSha256: digest(raw), builds, current, files };
}

function validateEntry(files, build, entry) {
  const record = files.get(build.root + '/' + entry);
  if (!record) throw new Error('Delivery has no verified entry: ' + entry);
  const html = fs.readFileSync(record.file, 'utf8');
  const references = Array.from(html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi));
  if (!references.length) throw new Error('Delivery entry has no emitted asset references');
  for (const [, url] of references) {
    if (!url.startsWith(assetPrefix(build.sourceHead))) throw new Error('Entry assets must use their same-origin immutable prefix');
    const relative = safeRelative(decodeURIComponent(url.slice(assetPrefix(build.sourceHead).length).split(/[?#]/)[0]));
    if (!files.has(build.root + '/' + relative)) throw new Error('Entry references an unverified asset: ' + relative);
  }
}

async function inventory(folder) {
  const files = [];
  async function visit(relative) {
    for (const item of fs.readdirSync(path.join(folder, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = relative ? relative + '/' + item.name : item.name;
      safeRelative(name);
      if (item.isDirectory()) await visit(name);
      else if (item.isFile() && name !== 'delivery-manifest.json') files.push({ path: name, ...await hashFile(path.join(folder, name)) });
      else if (name !== 'delivery-manifest.json') throw new Error('Non-regular entry in delivery inventory: ' + name);
    }
  }
  await visit('');
  return files;
}

module.exports = { PRODUCT, LEGACY_PRODUCT, REQUIRED_RETAINED_HEADS, SHA,
  assetPrefix, digest, inside, safeRelative, containedFile, hashFile, verifyDeliveryPackage, inventory };
