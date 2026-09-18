import assert from 'node:assert/strict';
import fs from 'node:fs';

const schemaPolicyPath = 'spec/process/cad-document-schema-policy.v1.json';
const milestonePolicyPath = 'spec/process/milestone-gates.v1.json';
const documentPath = 'src/contracts/document.ts';
const dimensionsPath = 'src/contracts/sketchDimensions.ts';

const schemaPolicy = JSON.parse(fs.readFileSync(schemaPolicyPath, 'utf8'));
const milestonePolicy = JSON.parse(fs.readFileSync(milestonePolicyPath, 'utf8'));
const documentSource = fs.readFileSync(documentPath, 'utf8');
const dimensionSource = fs.readFileSync(dimensionsPath, 'utf8');

assert.equal(schemaPolicy.policyVersion, 1);
assert.equal(schemaPolicy.schemaVersionSemantics, 'exact-persisted-grammar');
assert.equal(schemaPolicy.persistedUnionDiscriminantAdditionRequiresSchemaBump, true);
assert.equal(schemaPolicy.readMustNotSilentlyRewriteStoredDocuments, true);

const sourceVersionMatch = documentSource.match(/export const CAD_DOCUMENT_SCHEMA_VERSION\s*=\s*(\d+)\s+as const/);
assert.ok(sourceVersionMatch, 'CAD_DOCUMENT_SCHEMA_VERSION must remain statically readable');
const sourceVersion = Number(sourceVersionMatch[1]);
assert.equal(
  sourceVersion,
  schemaPolicy.currentCadDocumentSchemaVersion,
  'CadDocument source version must equal schema policy current version',
);

assert.ok(Array.isArray(schemaPolicy.schemas) && schemaPolicy.schemas.length > 0);
const versions = schemaPolicy.schemas.map((schema) => schema.version);
assert.deepEqual(
  versions,
  Array.from({ length: sourceVersion }, (_, index) => index + 1),
  'Declared schema versions must be contiguous from 1 through current',
);
assert.equal(versions.at(-1), sourceVersion);

for (const schema of schemaPolicy.schemas) {
  assert.equal(Number.isInteger(schema.version), true, 'Schema version must be an integer');
  assert.equal(typeof schema.fixture, 'string');
  assert.ok(fs.existsSync(schema.fixture), `Schema ${schema.version} fixture is missing: ${schema.fixture}`);
  const fixture = JSON.parse(fs.readFileSync(schema.fixture, 'utf8'));
  assert.equal(
    fixture.schemaVersion,
    schema.version,
    `Schema ${schema.version} fixture must declare its own schemaVersion`,
  );
}

const currentSchema = schemaPolicy.schemas.find((schema) => schema.version === sourceVersion);
assert.ok(currentSchema, 'Current schema policy entry is missing');

const sourceDimensionTypes = [
  ...dimensionSource.matchAll(/export interface Cad[A-Za-z0-9]+Dimension extends CadDimensionBase<'([^']+)'>/g),
].map((match) => match[1]);
assert.equal(new Set(sourceDimensionTypes).size, sourceDimensionTypes.length, 'Dimension discriminants must be unique');
assert.deepEqual(
  [...sourceDimensionTypes].sort(),
  [...currentSchema.dimensionTypes].sort(),
  'Current persisted Dimension discriminants must exactly match current schema grammar policy',
);

const protectedV1 = ['linear', 'horizontal', 'vertical', 'diameter'];
const v1 = schemaPolicy.schemas.find((schema) => schema.version === 1);
assert.ok(v1, 'Schema-v1 policy entry is required');
assert.deepEqual(v1.dimensionTypes, protectedV1, 'Schema-v1 Dimension grammar is frozen');

const compatibility = milestonePolicy.compatibility ?? {};
for (const flag of [
  'schemaVersionRepresentsExactPersistedGrammar',
  'persistedUnionDiscriminantAdditionRequiresSchemaBump',
  'schemaBumpRequiresMigrationFixture',
  'allDeclaredSupportedSchemasMustOpen',
  'readMustNotSilentlyRewriteStoredDocuments',
]) {
  assert.equal(compatibility[flag], true, `Compatibility flag must be true: ${flag}`);
}

const localHost = fs.readFileSync('src/host/LocalStorageCadProjectHost.ts', 'utf8');
const asaHost = fs.readFileSync('src/host/AsaLabCadProjectHost.ts', 'utf8');
const localLoad = between(localHost, 'async load()', 'async save(');
const asaLoad = between(asaHost, 'async load()', 'async save(');
assert.match(localLoad, /migrateCadDocument\(state\.serializedDocument\)/, 'LocalStorage load must migrate on ingress');
assert.doesNotMatch(localLoad, /setItem\(/, 'LocalStorage load must not rewrite storage');
assert.match(asaLoad, /migrateCadDocument\(draft\.document\)/, 'ASA Lab load must migrate on ingress');
assert.doesNotMatch(asaLoad, /method:\s*'PUT'/, 'ASA Lab load must not save while reading');

console.log(
  `ASA-CAD schema evolution policy PASS (schema v${sourceVersion}; Dimension grammar: ${currentSchema.dimensionTypes.join(', ')})`,
);

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Unable to isolate source block: ${start} -> ${end}`);
  return source.slice(from, to);
}
