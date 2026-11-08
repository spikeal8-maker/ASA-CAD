import assert from 'node:assert/strict';
import test from 'node:test';
import { cadEditorPath, cadViewerPath, cadPartDevFixturePath, parseCadClientRoute } from '../../src/browser/routes';
import { CAD_LAUNCHER_PATH, CAD_MODES, cadBasePath, cadPath, isLocalCadProjectId, localCadEditorPath, unmountCadPath } from '../../src/browser/editorModes';

await test('the root opens the launcher while the original standalone editor remains reachable', () => {
  assert.deepEqual(parseCadClientRoute(CAD_LAUNCHER_PATH), { kind: 'launcher' });
  assert.deepEqual(parseCadClientRoute('/?return=home#recent'), { kind: 'launcher' });
  for (const pathname of ['/cad', '/cad/', '/cad/?open=last']) {
    assert.deepEqual(parseCadClientRoute(pathname), { kind: 'standalone' });
  }
});

await test('local editor URLs preserve project identity and mode without navigation memory', () => {
  for (const mode of ['kompas', 'fusion'] as const) for (const projectId of ['legacy', 'ea575a47-c0c3-40b1-9166-8bdd8ff4d019', 'Part_1580']) {
    const href = localCadEditorPath(mode, projectId);
    const expected = { kind: 'local-editor', mode, projectId };
    const location = new URL(href, 'http://127.0.0.1:8099/');
    assert.equal(location.origin, 'http://127.0.0.1:8099');
    assert.equal(location.search, '');
    assert.equal(location.hash, '');
    assert.deepEqual(parseCadClientRoute(location.pathname), expected);
    assert.deepEqual(parseCadClientRoute(`${location.pathname}/?view=solid`), expected);
    // Re-parsing a fresh URL represents the route state available after F5 or a
    // copied deep link. Browser history/unsaved guards need separate UI proof.
    assert.deepEqual(parseCadClientRoute(new URL(location.href).pathname), expected);
  }
});

await test('existing server project, version and development routes keep their meaning', () => {
  for (const id of ['project-1580', 'деталь №1', 'class/a']) {
    assert.deepEqual(parseCadClientRoute(cadEditorPath(id)), { kind: 'editor', projectId: id });
    assert.deepEqual(parseCadClientRoute(cadViewerPath(id)), { kind: 'viewer', versionId: id });
  }
  assert.equal(cadEditorPath('project-1580'), '/cad/projects/project-1580');
  assert.equal(cadViewerPath('version-1580'), '/cad/view/version-1580');
  assert.throws(() => cadEditorPath(''));
  assert.throws(() => cadViewerPath(''));
  assert.deepEqual(parseCadClientRoute(cadPartDevFixturePath('arc')), { kind: 'dev-part', fixture: 'arc' });
  assert.deepEqual(parseCadClientRoute('/cad/dev/part/rectangle'), { kind: 'dev-part', fixture: 'rectangle' });
});

await test('invalid local IDs and malformed encoded routes fail explicitly instead of opening another project', () => {
  for (const id of ['', '..', 'a/b', 'a\\b', 'a?b', 'a#b', 'x\ny', ' space ', 'x'.repeat(97)]) {
    assert.equal(isLocalCadProjectId(id), false, JSON.stringify(id));
    assert.throws(() => localCadEditorPath('kompas', id));
  }
  for (const pathname of [
    '/cad/kompas/%', '/cad/fusion/%GG', '/cad/fusion/%E0%A4%A',
    '/cad/projects/%', '/cad/view/%E0%A4%A', '/dev/part/%', '/cad/dev/part/%',
    '/cad/fusion/a%2Fb', '/cad/kompas/..', '/cad/blocks3d/legacy',
    '/cad/kompas', '/cad/fusion/legacy/extra', '/unknown',
  ]) {
    assert.doesNotThrow(() => parseCadClientRoute(pathname));
    assert.deepEqual(parseCadClientRoute(pathname), { kind: 'unknown', pathname });
  }
});

await test('the three-mode registry keeps the external editor in its own document and session system', () => {
  assert.deepEqual(CAD_MODES.map(mode => mode.id), ['kompas', 'fusion', 'blocks3d']);
  const [kompas, fusion, blocks] = CAD_MODES;
  assert.equal(kompas.projectType, fusion.projectType);
  assert.equal(kompas.saving, fusion.saving);
  assert.equal(kompas.external, false);
  assert.equal(fusion.external, false);
  assert.equal(blocks.external, true);
  assert.equal(blocks.projectType, 'three-d');
  assert.equal(blocks.connection, 'external-session');
  assert.equal(blocks.saving, 'asa-lab-project-core');
});

// Minimal metadata seam for the public mount-path helpers; no app state,
// localStorage, browser session or navigation is fabricated by this test.
function withBase<T>(content: string | null, run: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => content === null ? null : { content } } });
  try { return run(); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

await test('candidate mount paths round-trip all normal editor URLs without replacing the root', () => {
  withBase(null, () => {
    assert.equal(cadBasePath(), '');
    assert.equal(cadPath('/'), '/');
    assert.equal(unmountCadPath('/cad/fusion/legacy'), '/cad/fusion/legacy');
  });
  withBase('/__asa_candidates/launcher-001/', () => {
    assert.equal(cadPath('/'), '/__asa_candidates/launcher-001/');
    for (const mode of ['kompas', 'fusion'] as const) {
      const route = localCadEditorPath(mode, 'legacy');
      assert.deepEqual(parseCadClientRoute(unmountCadPath(cadPath(route))), { kind: 'local-editor', mode, projectId: 'legacy' });
    }
    assert.equal(unmountCadPath('/__asa_candidates/launcher-001'), '/');
    assert.equal(unmountCadPath('/__asa_candidates/launcher-0010/cad'), '/__asa_candidates/launcher-0010/cad');
  });
});

await test('invalid mount metadata cannot turn local navigation into an external or protocol-relative URL', () => {
  for (const content of ['//outside/', '///', 'https://outside/', '../candidate/', '/candidate/../', '/candidate/?token=x']) withBase(content, () => {
    assert.equal(cadBasePath(), '', content);
    assert.equal(cadPath('/'), '/', content);
  });
});
