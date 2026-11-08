const fs = require('node:fs');
const path = require('node:path');
const { assetPrefix, containedFile } = require('./three-mode-manifest.cjs');

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function headers(res, active) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Emscripten bindings need local dynamic compilation. No remote script/asset origin is allowed.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-ASA-CAD-Shell', active.workspace);
  res.setHeader('X-ASA-CAD-Source', active.sourceHead);
}

function requestPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return { status: 400 };
  const encodedPathname = url.split(/[?#]/)[0];
  let pathname;
  try { pathname = decodeURIComponent(encodedPathname); } catch { return { status: 400 }; }
  if (pathname.includes('\0')) return { status: 400 };
  if (pathname.includes('\\') || pathname.split('/').some(part => part === '.' || part === '..')) return { status: 403 };
  return { pathname, encodedPathname };
}

function route(delivery, active, pathname, encodedPathname) {
  if (pathname.startsWith('/__asa_builds/')) {
    const match = /^\/__asa_builds\/([a-f0-9]{40})\/(.*)$/.exec(pathname);
    const build = match && delivery.builds.get(match[1]);
    if (!build) return { status: 404 };
    const relative = match[2] || 'index.html';
    return { build, relative, versioned: true };
  }
  if (['/backup', '/backup/', '/backup/index.html'].includes(pathname)) {
    return { build: active, relative: 'backup/index.html', versioned: false };
  }
  // Match document routes before decoding segment boundaries: project/version
  // IDs may contain encoded slashes. requestPath still validates the fully
  // decoded path for traversal before any route or asset lookup is allowed.
  // An asset miss must never return HTML or a newer build's similarly named file.
  if (pathname === '/' || pathname === '/index.html'
    || /^\/cad(?:\/(?:kompas|fusion|projects|view)\/[^/]+|\/dev\/part\/[^/]+)?\/?$/.test(encodedPathname)
    || /^\/dev\/part\/[^/]+\/?$/.test(encodedPathname)) {
    return { build: active, relative: 'index.html', versioned: false };
  }
  return { build: delivery.builds.get(delivery.manifest.assetRouting.unversionedSourceHead),
    relative: pathname.slice(1), versioned: false };
}

function createHandler(delivery, active, getPort) {
  return (req, res) => {
    headers(res, active);
    const port = getPort();
    if (req.headers.host !== '127.0.0.1:' + port) { res.writeHead(421); res.end(); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD'); res.writeHead(405); res.end(); return;
    }
    const decoded = requestPath(req.url);
    if (decoded.status) { res.writeHead(decoded.status); res.end(); return; }
    if (decoded.pathname === '/__asa_health') {
      const body = JSON.stringify({ product: active.product, deliveryProduct: delivery.manifest.product,
        version: active.version, workspace: active.workspace, localOnly: true, port,
        sourceHead: active.sourceHead, deliverySourceHead: delivery.current.sourceHead,
        assetPrefix: assetPrefix(active.sourceHead),
        unversionedSourceHead: delivery.manifest.assetRouting.unversionedSourceHead,
        previousSourceHead: delivery.manifest.assetRouting.previousSourceHead,
        retainedSourceHeads: [...delivery.builds.keys()].filter(head => head !== active.sourceHead),
        manifestSha256: delivery.manifestSha256, verifiedFiles: delivery.files.size });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(body)); res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    const selected = route(delivery, active, decoded.pathname, decoded.encodedPathname);
    if (selected.status) { res.writeHead(selected.status); res.end(); return; }
    const relative = selected.build.root + '/' + selected.relative;
    const record = delivery.files.get(relative);
    if (!record) { res.writeHead(404); res.end(); return; }
    let stat;
    try {
      containedFile(delivery.root, relative);
      stat = fs.statSync(record.file);
      if (stat.size !== record.bytes || stat.mtimeMs !== record.mtimeMs) throw new Error('Changed delivery file');
    } catch { res.writeHead(503); res.end(); return; }
    res.setHeader('X-ASA-CAD-Asset-Source', selected.build.sourceHead);
    res.setHeader('Content-Type', mime[path.extname(record.file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', record.bytes);
    res.setHeader('ETag', '"' + record.sha256 + '"');
    if (selected.versioned) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else if (path.extname(record.file) !== '.html') res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(record.file);
    stream.on('error', () => { if (!res.headersSent) { res.writeHead(500); res.end(); } else res.destroy(); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  };
}

module.exports = { createHandler };
