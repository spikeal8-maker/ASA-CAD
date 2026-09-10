import assert from 'node:assert/strict';
import {
  AsaLabCadProjectHost,
  AsaLabCadRevisionConflictError,
  createEmptyCadDocument,
} from '../../src';

const initial = createEmptyCadDocument('part', { title: 'ASA host test' });
const calls: Array<{ url: string; method: string; credentials?: RequestCredentials; body?: string }> = [];
let revision = 5;
let stored = structuredClone(initial);

const fakeFetch: typeof globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init.method ?? 'GET';
  calls.push({
    url,
    method,
    credentials: init.credentials,
    body: typeof init.body === 'string' ? init.body : undefined,
  });

  if (url === '/api/projects/project%20one' && method === 'GET') {
    return Response.json({ project: { id: 'project one', moduleKey: 'cad' }, draft: { document: stored, revision }, versions: [] });
  }

  if (url === '/api/projects/project%20one/draft' && method === 'PUT') {
    const body = JSON.parse(String(init.body)) as { document: typeof initial; baseRevision: number; mutationId: string };
    if (body.mutationId === 'force-conflict') {
      return Response.json(
        { error: { code: 'project_revision_conflict', message: 'stale revision' } },
        { status: 409 },
      );
    }
    assert.equal(body.baseRevision, revision);
    assert.ok(body.mutationId);
    stored = structuredClone(body.document);
    revision += 1;
    return Response.json({ draft: { document: stored, revision }, result: null });
  }

  if (url === '/api/projects/project%20one/snapshot' && method === 'PUT') {
    const body = JSON.parse(String(init.body)) as { imageDataUrl: string; sourceRevision: number };
    assert.equal(body.sourceRevision, revision);
    assert.match(body.imageDataUrl, /^data:image\/png;base64,/);
    return Response.json({ snapshot: { sourceRevision: body.sourceRevision } });
  }

  return Response.json({ error: { code: 'unexpected', message: `${method} ${url}` } }, { status: 404 });
};

const host = new AsaLabCadProjectHost({ projectId: 'project one', fetch: fakeFetch });
const opened = await host.load();
assert.equal(opened.revision, 5);
assert.equal(opened.document.title, 'ASA host test');

const edited = structuredClone(opened.document);
edited.title = 'Saved through Project Core';
const saved = await host.save({ document: edited, baseRevision: 5, mutationId: 'mutation-host-1' });
assert.equal(saved.revision, 6);

await host.saveSnapshot({ imageDataUrl: 'data:image/png;base64,AA==', sourceRevision: 6 });

await assert.rejects(
  () => host.save({ document: edited, baseRevision: 6, mutationId: 'force-conflict' }),
  (error: unknown) => {
    assert.ok(error instanceof AsaLabCadRevisionConflictError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'project_revision_conflict');
    return true;
  },
);

assert.deepEqual(
  calls.map((call) => [call.method, call.url]),
  [
    ['GET', '/api/projects/project%20one'],
    ['PUT', '/api/projects/project%20one/draft'],
    ['PUT', '/api/projects/project%20one/snapshot'],
    ['PUT', '/api/projects/project%20one/draft'],
  ],
);
assert.ok(calls.every((call) => call.credentials === 'same-origin'), 'ASA Lab host must keep same-origin session credentials');
assert.equal(calls.some((call) => /compute|rebuild|boolean|fillet|solve/i.test(call.url)), false, 'host must not call CAD compute endpoints');

console.log('ASA-CAD M1B ASA Lab Project Core host mapping PASS');
