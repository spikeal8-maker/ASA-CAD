import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifestPath = process.argv[2] ?? 'release/manifest.json';
const schemaPolicyPath = 'spec/process/cad-document-schema-policy.v1.json';
const documentPath = 'src/contracts/document.ts';

assert.ok(fs.existsSync(manifestPath), `Release manifest is missing: ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const schemaPolicy = JSON.parse(fs.readFileSync(schemaPolicyPath, 'utf8'));
const documentSource = fs.readFileSync(documentPath, 'utf8');

const sourceVersionMatch = documentSource.match(
  /export const CAD_DOCUMENT_SCHEMA_VERSION\s*=\s*(\d+)\s+as const/,
);
assert.ok(sourceVersionMatch, 'CAD_DOCUMENT_SCHEMA_VERSION must remain statically readable');

const sourceVersion = Number(sourceVersionMatch[1]);
const policyVersion = schemaPolicy.currentCadDocumentSchemaVersion;
const releaseVersion = manifest.cadDocumentSchemaVersion;

assert.equal(Number.isInteger(sourceVersion), true, 'Production schema version must be an integer');
assert.equal(Number.isInteger(policyVersion), true, 'Schema policy current version must be an integer');
assert.equal(Number.isInteger(releaseVersion), true, 'Release schema version must be an integer');
assert.ok(releaseVersion > 0, 'Release schema version must be positive');

assert.equal(
  policyVersion,
  sourceVersion,
  'Schema policy current version must equal production CAD_DOCUMENT_SCHEMA_VERSION',
);
assert.equal(
  releaseVersion,
  sourceVersion,
  `Release manifest schema version must equal production CAD_DOCUMENT_SCHEMA_VERSION (${sourceVersion})`,
);

const currentSchema = schemaPolicy.schemas?.find((schema) => schema.version === sourceVersion);
assert.ok(currentSchema, `Schema policy must declare current schema version ${sourceVersion}`);

console.log(
  `ASA-CAD release schema contract PASS (source=${sourceVersion}; policy=${policyVersion}; release=${releaseVersion}; manifest=${manifestPath})`,
);
