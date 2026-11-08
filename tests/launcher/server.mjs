import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { candidateHead, oldHeads, makePackage } from './server.fixture.mjs';

const require = createRequire(import.meta.url);
const { startDeliveryServer, argumentsForServer } = require('../../build/three-mode-server.cjs');
const { assetPrefix, verifyDeliveryPackage, inventory } = require('../../build/three-mode-manifest.cjs');

async function close(server) {
  server.closeIdleConnections();
  await new Promise(resolve => server.close(resolve));
}
function rawRequest(port, url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, headers, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
}

test('only the declared loopback ports and explicit delivery roots are accepted', async () => {
  assert.throws(() => argumentsForServer([]), /--package is required/);
  assert.throws(() => argumentsForServer(['--host', '0.0.0.0']), /Usage/);
  assert.equal(argumentsForServer(['--package', '/example']).port, 8099);
  assert.equal(argumentsForServer(['--package', '/example', '--port', '0']).port, 0);
  await assert.rejects(startDeliveryServer({ packageRoot: '/missing', port: 8100 }), /Only port 8099/);
});

test('real HTTP delivery keeps deep links, exact health, deferred assets and old owners', async t => {
  const fixture = await makePackage();
  t.after(fixture.remove);
  const server = await startDeliveryServer({ packageRoot: fixture.root, port: 0 });
  t.after(() => close(server));
  const address = server.address();
  assert.equal(address.address, '127.0.0.1');
  assert.notEqual(address.port, 8099);
  const healthResponse = await rawRequest(address.port, '/__asa_health?fresh=1');
  assert.equal(healthResponse.status, 200);
  const health = JSON.parse(healthResponse.body);
  assert.equal(health.sourceHead, candidateHead);
  assert.equal(health.assetPrefix, assetPrefix(candidateHead));
  assert.equal(health.unversionedSourceHead, oldHeads[1]);
  assert.deepEqual(health.retainedSourceHeads, oldHeads);
  assert.match(health.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(health.verifiedFiles, fixture.manifest.files.length);
  assert.equal(healthResponse.headers['cache-control'], 'no-store');
  for (const route of [
    '/', '/cad', '/cad/kompas/project-1', '/cad/fusion/project-1',
    '/cad/projects/p1.v2', '/cad/view/v1', '/dev/part/empty',
    '/cad/projects/class%2Fa', '/cad/view/class%2Fa', '/cad/view/class%2fa/',
    '/cad/projects/%D0%B4%D0%B5%D1%82%D0%B0%D0%BB%D1%8C%20%E2%84%961',
    '/cad/projects/a%23b%3Fc?fresh=1', '/cad/projects/literal%252Fid',
  ]) {
    const response = await rawRequest(address.port, route);
    assert.equal(response.status, 200, route);
    assert.match(response.body.toString(), new RegExp(candidateHead));
    assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(response.headers['cross-origin-embedder-policy'], 'require-corp');
    assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin');
    assert.match(response.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  for (const head of [candidateHead, ...oldHeads]) {
    for (const asset of ['main.js', 'lazy.js', 'wasm/kernel.wasm']) {
      const response = await rawRequest(address.port, assetPrefix(head) + asset);
      assert.equal(response.status, 200, head + '/' + asset);
      assert.ok(response.body.includes(Buffer.from(head)));
      assert.equal(response.headers['x-asa-cad-asset-source'], head);
      assert.match(response.headers['cache-control'], /immutable/);
      if (asset.endsWith('.wasm')) assert.equal(response.headers['content-type'], 'application/wasm');
    }
  }
  for (const entry of ['/backup', '/backup/', '/backup/index.html', assetPrefix(candidateHead) + 'backup/index.html']) {
    const response = await rawRequest(address.port, entry);
    assert.equal(response.status, 200); assert.match(response.body.toString(), /Backup fixture/);
  }
  const legacy = await rawRequest(address.port, '/lazy.js');
  assert.ok(legacy.body.includes(Buffer.from(oldHeads[1])));
  const legacyWasm = await rawRequest(address.port, '/wasm/kernel.wasm');
  assert.ok(legacyWasm.body.includes(Buffer.from(oldHeads[1])));
  const head = await rawRequest(address.port, assetPrefix(oldHeads[0]) + 'lazy.js', {}, 'HEAD');
  assert.equal(head.status, 200); assert.equal(head.body.length, 0); assert.ok(Number(head.headers['content-length']) > 0);
  const healthHead = await rawRequest(address.port, '/__asa_health', {}, 'HEAD');
  assert.equal(healthHead.body.length, 0); assert.ok(Number(healthHead.headers['content-length']) > 0);
  assert.equal((await rawRequest(address.port, '/__asa_health', {}, 'POST')).status, 405);
  assert.equal((await rawRequest(address.port, '/__asa_health', { Host: 'attacker.invalid:' + address.port })).status, 421);
  for (const missing of ['/missing.js', '/cad/missing.js', assetPrefix(candidateHead) + 'missing.wasm', '/__asa_builds/' + '0'.repeat(40) + '/lazy.js']) {
    const response = await rawRequest(address.port, missing);
    assert.equal(response.status, 404, missing); assert.equal(response.body.length, 0);
  }
  for (const unsafe of [
    '/%2e%2e/delivery-manifest.json', '/__asa_builds/' + candidateHead + '/%2e%2e/main.js',
    '/%5c..%5cdelivery-manifest.json', '/cad/projects/class%2F..%2Fsecret',
    '/cad/view/%2e%2e', '/cad/view/a%2f%2e%2e', '/cad/projects/a%5Cb',
  ]) {
    assert.equal((await rawRequest(address.port, unsafe)).status, 403, unsafe);
  }
  assert.equal((await rawRequest(address.port, '/%invalid')).status, 400);
  fs.writeFileSync(path.join(fixture.root, 'app/unlisted.js'), 'unlisted');
  assert.equal((await rawRequest(address.port, assetPrefix(candidateHead) + 'unlisted.js')).status, 404);
  const changed = path.join(fixture.root, 'app/main.js');
  fs.appendFileSync(changed, '\nchanged');
  assert.equal((await rawRequest(address.port, assetPrefix(candidateHead) + 'main.js')).status, 503);
});

test('rollback selects the retained entry without rebinding unversioned or current assets', async t => {
  const fixture = await makePackage(); t.after(fixture.remove);
  const server = await startDeliveryServer({ packageRoot: fixture.root, port: 0, activeBuild: oldHeads[0] });
  t.after(() => close(server));
  const port = server.address().port;
  const health = JSON.parse((await rawRequest(port, '/__asa_health')).body);
  assert.equal(health.sourceHead, oldHeads[0]);
  assert.equal(health.deliverySourceHead, candidateHead);
  assert.ok((await rawRequest(port, '/')).body.includes(Buffer.from(oldHeads[0])));
  assert.ok((await rawRequest(port, '/lazy.js')).body.includes(Buffer.from(oldHeads[1])));
  assert.ok((await rawRequest(port, assetPrefix(candidateHead) + 'wasm/kernel.wasm')).body.includes(Buffer.from(candidateHead)));
  await assert.rejects(startDeliveryServer({ packageRoot: fixture.root, port: 0, activeBuild: '0'.repeat(40) }), /not retained/);
});

test('missing manifest, checksum drift, symlinks, missing owners and remote entry assets fail before listen', async t => {
  const fixture = await makePackage(); t.after(fixture.remove);
  fs.renameSync(path.join(fixture.root, 'delivery-manifest.json'), path.join(fixture.root, 'saved-manifest.json'));
  await assert.rejects(verifyDeliveryPackage(fixture.root), /ENOENT/);
  fixture.writeManifest();
  const main = path.join(fixture.root, 'app/main.js');
  const bytes = fs.readFileSync(main);
  fs.writeFileSync(main, 'changed');
  await assert.rejects(verifyDeliveryPackage(fixture.root), /checksum mismatch/);
  fs.writeFileSync(main, bytes);
  fs.unlinkSync(main);
  fs.symlinkSync(path.join(fixture.root, 'app/lazy.js'), main);
  await assert.rejects(verifyDeliveryPackage(fixture.root), /regular files/);
  fs.unlinkSync(main); fs.writeFileSync(main, bytes);
  const retained = fixture.manifest.assetRouting.compatibility.pop(); fixture.writeManifest();
  await assert.rejects(verifyDeliveryPackage(fixture.root), /Required old asset owner/);
  fixture.manifest.assetRouting.compatibility.push(retained);
  fs.writeFileSync(path.join(fixture.root, 'app/index.html'), '<script src="https://example.invalid/remote.js"></script>');
  fixture.manifest.files = await inventory(fixture.root); fixture.writeManifest();
  await assert.rejects(verifyDeliveryPackage(fixture.root), /same-origin immutable prefix/);
});
