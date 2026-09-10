import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  parseCadDocument,
  type CadDocument,
} from './document';

export interface CadDocumentMigrationContext {
  readonly targetSchemaVersion: number;
}

export type CadDocumentMigration = (
  input: Record<string, unknown>,
  context: CadDocumentMigrationContext,
) => Record<string, unknown>;

const migrations = new Map<number, CadDocumentMigration>();

/**
 * Registers migration N -> N+1. Migrations are intentionally explicit and
 * sequential; engine upgrades must never silently rewrite stored project data.
 */
export function registerCadDocumentMigration(fromVersion: number, migration: CadDocumentMigration): void {
  if (!Number.isInteger(fromVersion) || fromVersion < 0) throw new Error('fromVersion must be a non-negative integer');
  if (fromVersion >= CAD_DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Cannot register migration from current/future schema ${fromVersion}`);
  }
  if (migrations.has(fromVersion)) throw new Error(`Migration ${fromVersion} -> ${fromVersion + 1} already registered`);
  migrations.set(fromVersion, migration);
}

export function migrateCadDocument(value: string | unknown): CadDocument {
  let current: unknown = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
  if (!current || typeof current !== 'object') throw new Error('CadDocument must be an object');

  let record = current as Record<string, unknown>;
  const initialVersion = record.schemaVersion;
  if (!Number.isInteger(initialVersion)) throw new Error('CadDocument.schemaVersion must be an integer');
  let version = initialVersion as number;

  if (version > CAD_DOCUMENT_SCHEMA_VERSION) {
    throw new CadDocumentFutureVersionError(version, CAD_DOCUMENT_SCHEMA_VERSION);
  }

  while (version < CAD_DOCUMENT_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration) throw new CadDocumentMigrationMissingError(version, version + 1);
    record = migration(record, { targetSchemaVersion: version + 1 });
    const next = record.schemaVersion;
    if (next !== version + 1) {
      throw new Error(`Migration ${version} -> ${version + 1} returned schemaVersion ${String(next)}`);
    }
    version += 1;
  }

  return parseCadDocument(record);
}

export class CadDocumentMigrationMissingError extends Error {
  readonly code = 'CAD_DOCUMENT_MIGRATION_MISSING';

  constructor(readonly fromVersion: number, readonly toVersion: number) {
    super(`No CadDocument migration registered for ${fromVersion} -> ${toVersion}`);
    this.name = 'CadDocumentMigrationMissingError';
  }
}

export class CadDocumentFutureVersionError extends Error {
  readonly code = 'CAD_DOCUMENT_FUTURE_VERSION';

  constructor(readonly documentVersion: number, readonly supportedVersion: number) {
    super(`CadDocument schema ${documentVersion} is newer than supported schema ${supportedVersion}`);
    this.name = 'CadDocumentFutureVersionError';
  }
}
