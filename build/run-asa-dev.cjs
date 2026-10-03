const path = require('node:path');
const { createRequire } = require('node:module');

// Resolve the pinned toolchain by package name, as run-asa-build.cjs does:
// @rspack/core and @rspack/dev-server 2.x expose only `exports`, so a
// directory require by path fails with MODULE_NOT_FOUND.
const vendorRequire = createRequire(path.resolve(__dirname, '../vendor/toubkal/package.json'));
const rspackCore = vendorRequire('@rspack/core');
const devServerModule = vendorRequire('@rspack/dev-server');
const config = require('./rspack.asa.config.cjs');

const RspackDevServer = devServerModule.RspackDevServer ?? devServerModule.default ?? devServerModule;
const compiler = rspackCore.rspack(config);
const server = new RspackDevServer(config.devServer, compiler);

server.start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function stop() {
  try {
    await server.stop();
  } finally {
    compiler.close(() => process.exit(0));
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
