import assert from 'node:assert/strict';
import {
  CAD_PART_DEV_FIXTURE_NAMES,
  cadPartDevFixturePath,
  parseCadClientRoute,
} from '../../src/browser/routes';

for (const fixture of CAD_PART_DEV_FIXTURE_NAMES) {
  assert.equal(cadPartDevFixturePath(fixture), `/dev/part/${fixture}`);
  assert.deepEqual(parseCadClientRoute(`/dev/part/${fixture}`), { kind: 'dev-part', fixture });
  assert.deepEqual(parseCadClientRoute(`/dev/part/${fixture}/`), { kind: 'dev-part', fixture });
  assert.deepEqual(parseCadClientRoute(`/cad/dev/part/${fixture}`), { kind: 'dev-part', fixture });
}

assert.deepEqual(parseCadClientRoute('/dev/part/not-a-fixture'), {
  kind: 'unknown',
  pathname: '/dev/part/not-a-fixture',
});
assert.deepEqual(parseCadClientRoute('/cad/dev/part/not-a-fixture'), {
  kind: 'unknown',
  pathname: '/cad/dev/part/not-a-fixture',
});
assert.deepEqual(parseCadClientRoute('/cad/projects/reference'), {
  kind: 'editor',
  projectId: 'reference',
});

console.log('ASA-CAD M2A deterministic fixture route contract PASS');
