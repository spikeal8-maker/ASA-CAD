const http = require('node:http');
const { verifyDeliveryPackage } = require('./three-mode-manifest.cjs');
const { createHandler } = require('./three-mode-http.cjs');

/** No installer/process-control behavior: this listener owns only its requested loopback socket. */
async function startDeliveryServer({ packageRoot, port = 8099, activeBuild = null }) {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && (minor < 23 || (minor === 23 && patch < 4)))) {
    throw new Error('The delivery server requires Node.js 22.23.4 or newer');
  }
  if (port !== 0 && port !== 8099) throw new Error('Only port 8099 or temporary test port 0 is allowed');
  const delivery = await verifyDeliveryPackage(packageRoot);
  const active = activeBuild ? delivery.builds.get(activeBuild) : delivery.current;
  if (!active) throw new Error('Requested rollback build is not retained: ' + activeBuild);
  const server = http.createServer();
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.on('request', createHandler(delivery, active, () => server.address().port));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  return server;
}

function argumentsForServer(argv) {
  const values = { port: 8099, activeBuild: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!['--package', '--port', '--active-build'].includes(option) || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error('Usage: node three-mode-server.cjs --package <directory> [--port 8099|0] [--active-build <40-character SHA>]');
    }
    const value = argv[++index];
    if (option === '--package') values.packageRoot = value;
    else if (option === '--port') values.port = /^(?:0|8099)$/.test(value) ? Number(value) : NaN;
    else values.activeBuild = value;
  }
  if (!values.packageRoot) throw new Error('--package is required; a raw build directory is not a delivery');
  return values;
}

if (require.main === module) {
  Promise.resolve().then(() => startDeliveryServer(argumentsForServer(process.argv.slice(2)))).then(server => {
    console.log(JSON.stringify({ event: 'listening', origin: 'http://127.0.0.1:' + server.address().port,
      localOnly: true, health: '/__asa_health' }));
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      server.close(() => { process.exitCode = 0; });
      server.closeIdleConnections();
      setTimeout(() => server.closeAllConnections(), 10000).unref();
    };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }).catch(error => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port is already occupied. The existing process was not stopped or changed.' : error.message);
    process.exitCode = 1;
  });
}

module.exports = { startDeliveryServer, argumentsForServer };
