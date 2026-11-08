const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { createRequire } = require('node:module');
const { inside } = require('./three-mode-manifest.cjs');

const repo = path.resolve(__dirname, '..');
function sourceIdentity(root = repo) {
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const status = cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' });
  return { head, clean: status.trim() === '', builder: 'rspack' };
}

function prepareOutput(requested, protectedRoot = null) {
  const absolute = path.resolve(requested);
  const parent = fs.realpathSync(path.dirname(absolute));
  const output = path.join(parent, path.basename(absolute));
  if (fs.existsSync(output)) throw new Error('Refusing to overwrite an existing output: ' + output);
  if (protectedRoot && inside(protectedRoot, output)) throw new Error('Output must be outside the previous package');
  const staging = fs.mkdtempSync(path.join(parent, '.asa-three-mode-build-'));
  return {
    output, staging,
    publish() {
      if (fs.existsSync(output)) throw new Error('Output appeared during the build; refusing replacement');
      fs.renameSync(staging, output);
    },
    discard() { fs.rmSync(staging, { recursive: true, force: true }); },
  };
}

function bundleConfig({ output, publicPath, backupOnly = false }) {
  const vendorRequire = createRequire(path.join(repo, 'vendor/toubkal/package.json'));
  const { HtmlRspackPlugin } = vendorRequire('@rspack/core');
  const base = require('./rspack.asa.config.cjs');
  const backupEntry = path.join(repo, 'src/web/launcher/backup-entry.ts');
  const backupTemplate = path.join(repo, 'src/web/launcher/backup.html');
  for (const file of [backupEntry, backupTemplate]) if (!fs.existsSync(file)) throw new Error('Backup entry is missing: ' + file);
  return {
    ...base, mode: 'production', devtool: false,
    entry: backupOnly ? { backup: backupEntry } : { main: base.entry, backup: backupEntry },
    output: { ...base.output, path: output, publicPath, clean: true,
      ...(backupOnly ? { filename: 'backup.js', chunkFilename: 'backup.[contenthash:8].js' } : {}) },
    optimization: backupOnly ? { splitChunks: false, runtimeChunk: false, minimize: true } : base.optimization,
    plugins: [
      ...(base.plugins ?? []).filter(plugin => !(plugin instanceof HtmlRspackPlugin)),
      ...(!backupOnly ? [new HtmlRspackPlugin({ template: path.join(repo, 'src/web/index.html'), filename: 'index.html', chunks: ['main'] })] : []),
      new HtmlRspackPlugin({ template: backupTemplate, filename: backupOnly ? 'index.html' : 'backup/index.html', chunks: ['backup'] }),
    ],
  };
}

async function compile(config) {
  const vendorRequire = createRequire(path.join(repo, 'vendor/toubkal/package.json'));
  const compiler = vendorRequire('@rspack/core').rspack(config);
  try {
    return await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error) { reject(error); return; }
      if (!stats || stats.hasErrors()) {
        reject(new Error(stats?.toString({ colors: false, all: false, errors: true, errorDetails: true }) ?? 'Rspack returned no stats'));
        return;
      }
      console.log(stats.toString({ colors: false, chunks: false, modules: false }));
      resolve(stats);
    }));
  } finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
  }
}

function options(argv, required) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!required.includes(key) || !argv[index + 1] || argv[index + 1].startsWith('--') || values[key] !== undefined) {
      throw new Error('Expected options: ' + required.map(name => name + ' <value>').join(' '));
    }
    values[key] = argv[++index];
  }
  if (required.some(key => !values[key])) throw new Error('Required options: ' + required.join(', '));
  return values;
}

module.exports = { repo, sourceIdentity, prepareOutput, bundleConfig, compile, options };
