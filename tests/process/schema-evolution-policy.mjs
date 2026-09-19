import assert from 'node:assert/strict';
import fs from 'node:fs';

const schemaPolicyPath = 'spec/process/cad-document-schema-policy.v1.json';
const milestonePolicyPath = 'spec/process/milestone-gates.v1.json';
const documentPath = 'src/contracts/document.ts';
const sketchPath = 'src/contracts/sketch.ts';
const dimensionsPath = 'src/contracts/sketchDimensions.ts';

const schemaPolicy = JSON.parse(fs.readFileSync(schemaPolicyPath, 'utf8'));
const milestonePolicy = JSON.parse(fs.readFileSync(milestonePolicyPath, 'utf8'));
const documentSource = fs.readFileSync(documentPath, 'utf8');
const sketchSource = fs.readFileSync(sketchPath, 'utf8');
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

const grammarKeys = ['documentKinds', 'sketchEntityTypes', 'constraintTypes', 'dimensionTypes'];
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
  for (const key of grammarKeys) {
    assert.ok(Array.isArray(schema[key]), `Schema ${schema.version} must declare ${key}`);
    assert.equal(new Set(schema[key]).size, schema[key].length, `Schema ${schema.version} ${key} must be unique`);
  }
}

const currentSchema = schemaPolicy.schemas.find((schema) => schema.version === sourceVersion);
assert.ok(currentSchema, 'Current schema policy entry is missing');

const documentKindBlock = documentSource.match(/export type CadDocumentKind\s*=\s*([\s\S]*?);/);
assert.ok(documentKindBlock, 'CadDocumentKind must remain statically readable');
const sourceDocumentKinds = [...documentKindBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

const sourceSketchEntityTypes = [
  ...sketchSource.matchAll(/export interface CadSketch[A-Za-z0-9]+Entity\s*\{[^}]*\btype:\s*'([^']+)'/g),
].map((match) => match[1]);

const sourceConstraintTypes = [
  ...sketchSource.matchAll(/export interface Cad[A-Za-z0-9]+Constraint extends CadConstraintBase<'([^']+)'>/g),
].map((match) => match[1]);

const sourceDimensionTypes = [
  ...dimensionSource.matchAll(/export interface Cad[A-Za-z0-9]+Dimension extends CadDimensionBase<'([^']+)'>/g),
].map((match) => match[1]);

assertUnique(sourceDocumentKinds, 'CadDocument kind');
assertUnique(sourceSketchEntityTypes, 'Sketch entity');
assertUnique(sourceConstraintTypes, 'Constraint');
assertUnique(sourceDimensionTypes, 'Dimension');

assert.deepEqual(
  sourceDocumentKinds,
  currentSchema.documentKinds,
  'Current persisted CadDocument kind grammar must exactly match current schema policy',
);
assert.deepEqual(
  sourceSketchEntityTypes,
  currentSchema.sketchEntityTypes,
  'Current persisted Sketch entity grammar must exactly match current schema policy',
);
assert.deepEqual(
  sourceConstraintTypes,
  currentSchema.constraintTypes,
  'Current persisted Constraint grammar must exactly match current schema policy',
);
assert.deepEqual(
  sourceDimensionTypes,
  currentSchema.dimensionTypes,
  'Current persisted Dimension grammar must exactly match current schema policy',
);

const protectedDocumentKinds = ['part', 'assembly', 'drawing', 'fragment', 'specification', 'text'];
const protectedSketchEntityTypes = ['line', 'circle', 'arc'];
const protectedConstraintTypes = [
  'horizontal',
  'vertical',
  'parallel',
  'perpendicular',
  'tangent',
  'concentric',
  'equal',
  'symmetric',
  'pointOnCurve',
  'fixed',
  'coincident',
];
const protectedV1DimensionTypes = ['linear', 'horizontal', 'vertical', 'diameter'];

const v1 = schemaPolicy.schemas.find((schema) => schema.version === 1);
const v2 = schemaPolicy.schemas.find((schema) => schema.version === 2);
const v3 = schemaPolicy.schemas.find((schema) => schema.version === 3);
assert.ok(v1, 'Schema-v1 policy entry is required');
assert.ok(v2, 'Schema-v2 policy entry is required');
assert.ok(v3, 'Schema-v3 policy entry is required');

assert.deepEqual(v1.documentKinds, protectedDocumentKinds, 'Schema-v1 document-kind grammar is frozen');
assert.deepEqual(v1.sketchEntityTypes, protectedSketchEntityTypes, 'Schema-v1 Sketch entity grammar is frozen');
assert.deepEqual(v1.constraintTypes, protectedConstraintTypes, 'Schema-v1 Constraint grammar is frozen');
assert.deepEqual(v1.dimensionTypes, protectedV1DimensionTypes, 'Schema-v1 Dimension grammar is frozen');

assert.deepEqual(v2.documentKinds, v1.documentKinds, 'v1->v2 must not change document-kind grammar');
assert.deepEqual(v2.sketchEntityTypes, v1.sketchEntityTypes, 'v1->v2 must not change Sketch entity grammar');
assert.deepEqual(v2.constraintTypes, v1.constraintTypes, 'v1->v2 must not change Constraint grammar');
assert.deepEqual(
  v2.dimensionTypes,
  [...v1.dimensionTypes, 'radius'],
  'v1->v2 persisted-union delta must be Radius Dimension only',
);
assert.deepEqual(v3.documentKinds, v2.documentKinds, 'v2->v3 must not change document-kind grammar');
assert.deepEqual(v3.sketchEntityTypes, v2.sketchEntityTypes, 'v2->v3 must not change Sketch entity grammar');
assert.deepEqual(v3.constraintTypes, v2.constraintTypes, 'v2->v3 must not change Constraint grammar');
assert.deepEqual(
  v3.dimensionTypes,
  [...v2.dimensionTypes, 'angular'],
  'v2->v3 persisted-union delta must be Angular Dimension only',
);

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
  `ASA-CAD schema evolution policy PASS (schema v${sourceVersion}; document=${currentSchema.documentKinds.length}; entities=${currentSchema.sketchEntityTypes.length}; constraints=${currentSchema.constraintTypes.length}; dimensions=${currentSchema.dimensionTypes.join(', ')})`,
);

function assertUnique(values, label) {
  assert.equal(values.length > 0, true, `${label} grammar must not be empty`);
  assert.equal(new Set(values).size, values.length, `${label} discriminants must be unique`);
}

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Unable to isolate source block: ${start} -> ${end}`);
  return source.slice(from, to);
}
