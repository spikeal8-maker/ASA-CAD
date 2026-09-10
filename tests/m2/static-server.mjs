import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../dist/asa/', import.meta.url)));
const port = Number(process.env.PORT ?? 8090);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

async function existingFile(candidate) {
  if (!candidate) return null;
  try {
    await access(candidate);
    const info = await stat(candidate);
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const pathName = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`).pathname;
    let file = await existingFile(safePath(pathName));
    if (!file) file = join(root, 'index.html');

    const extension = extname(file).toLowerCase();
    response.setHeader('Content-Type', MIME[extension] ?? 'application/octet-stream');
    if (/\.[a-f0-9]{8}\./i.test(file) || extension === '.wasm') {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      response.setHeader('Cache-Control', 'no-cache');
    }

    createReadStream(file)
      .on('error', (error) => {
        console.error(error);
        if (!response.headersSent) response.writeHead(500);
        response.end('server error');
      })
      .pipe(response);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end('server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ASA-CAD M2 static server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
