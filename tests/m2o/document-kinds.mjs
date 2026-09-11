import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED_KINDS = [
  'part',
  'assembly',
  'drawing',
  'fragment',
  'specification',
  'text',
];

const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8');
const systemSpec = readFileSync('docs/SYSTEM_SPEC.md', 'utf8');
const status = readFileSync('docs/STATUS.md', 'utf8');
const documentContract = readFileSync('src/contracts/document.ts', 'utf8');

const kindBlock = documentContract.match(/export type CadDocumentKind\s*=([\s\S]*?);/);
assert.ok(kindBlock, 'CadDocumentKind declaration not found in src/contracts/document.ts');

const codeKinds = [...kindBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(
  [...codeKinds].sort(),
  [...EXPECTED_KINDS].sort(),
  `CadDocumentKind must contain exactly: ${EXPECTED_KINDS.join(', ')}`,
);

for (const kind of EXPECTED_KINDS) {
  assert.match(
    architecture,
    new RegExp(`['\\x60]${kind}['\\x60]`, 'i'),
    `ARCHITECTURE.md must name document kind '${kind}'`,
  );
}

for (const label of ['Part', 'Assembly', 'Drawing', 'Fragment', 'Specification', 'Text']) {
  assert.match(systemSpec, new RegExp(`\\b${label}\\b`, 'i'), `SYSTEM_SPEC.md must mention ${label}`);
}

assert.match(status, /six|six first-class|document kinds|M1 ASA-owned `CadDocument`/i, 'STATUS.md must remain compatible with the six-document product model');

assert.doesNotMatch(
  architecture,
  /type\s+CadDocument\s*=\s*CadPartDocument\s*\|\s*CadAssemblyDocument\s*;/,
  'ARCHITECTURE.md regressed to a two-document CadDocument union',
);
assert.doesNotMatch(
  architecture,
  /type\s+CadDocumentKind\s*=\s*['"]part['"]\s*\|\s*['"]assembly['"]\s*;/,
  'ARCHITECTURE.md regressed to a two-document CadDocumentKind union',
);

console.log(`M2O O1 document-kind consistency PASS (${EXPECTED_KINDS.join(', ')})`);
