const path = require('node:path');
const { createRequire } = require('node:module');

const vendorRequire = createRequire(path.resolve(__dirname, '../vendor/toubkal/package.json'));
const rspackCore = vendorRequire('@rspack/core');
const config = require('./rspack.asa.config.cjs');

const compiler = rspackCore.rspack(config);

compiler.run((error, stats) => {
  const finish = (code) => {
    compiler.close(() => {
      process.exitCode = code;
    });
  };

  if (error) {
    console.error(error);
    finish(1);
    return;
  }

  if (!stats) {
    console.error('Rspack returned no build stats');
    finish(1);
    return;
  }

  console.log(stats.toString({ colors: process.stdout.isTTY, chunks: false, modules: false }));
  finish(stats.hasErrors() ? 1 : 0);
});
