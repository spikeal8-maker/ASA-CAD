const path = require('node:path');
const rspackCore = require(path.resolve(__dirname, '../vendor/toubkal/node_modules/@rspack/core'));
const devServerModule = require(path.resolve(__dirname, '../vendor/toubkal/node_modules/@rspack/dev-server'));
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
