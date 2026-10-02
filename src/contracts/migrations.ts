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

const SCHEMA_V1_DIMENSION_TYPES = new Set(['linear', 'horizontal', 'vertical', 'diameter']);
const SCHEMA_V2_DIMENSION_TYPES = new Set(['linear', 'horizontal', 'vertical', 'diameter', 'radius']);

function assertFrozenDimensionGrammar(
  input: Record<string, unknown>,
  schemaVersion: number,
  allowedTypes: ReadonlySet<string>,
): void {
  if (!Array.isArray(input.dimensions)) return;
  input.dimensions.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    const type = String((value as Record<string, unknown>).type);
    if (!allowedTypes.has(type)) {
      throw new Error(`Schema v${schemaVersion} dimensions[${index}].type is unsupported: ${type}`);
    }
  });
}

registerCadDocumentMigration(1, (input, context) => {
  assertFrozenDimensionGrammar(input, 1, SCHEMA_V1_DIMENSION_TYPES);
  return { ...input, schemaVersion: context.targetSchemaVersion };
});

registerCadDocumentMigration(2, (input, context) => {
  assertFrozenDimensionGrammar(input, 2, SCHEMA_V2_DIMENSION_TYPES);
  return { ...input, schemaVersion: context.targetSchemaVersion };
});

registerCadDocumentMigration(3, (input, context) => {
  if (input.kind !== 'drawing') return { ...input, schemaVersion: context.targetSchemaVersion };

  const documentId = typeof input.documentId === 'string' && input.documentId
    ? input.documentId
    : (() => { throw new Error('Schema v3 Drawing documentId is required'); })();
  if (!Array.isArray(input.sheets)) throw new Error('Schema v3 Drawing sheets must be an array');

  const makeSheet = (sheetId: string, name = 'Лист 1', orientation: 'portrait' | 'landscape' = 'landscape') => {
    const layerId = `layer_${sheetId}_system`;
    const landscape = orientation === 'landscape';
    return {
      id: sheetId,
      name,
      format: 'A4',
      orientation,
      scale: 1,
      width: landscape ? 297 : 210,
      height: landscape ? 210 : 297,
      layers: [{ id: layerId, name: 'Системный слой', visible: true, locked: false }],
      activeLayerId: layerId,
      entities: [],
    };
  };

  const sheets = input.sheets.length === 0
    ? [makeSheet(`sheet_${documentId}_a4`)]
    : input.sheets.map((value, index) => {
        if (!value || typeof value !== 'object') {
          throw new Error(`Schema v3 Drawing sheets[${index}] must be an object`);
        }
        const sheet = value as Record<string, unknown>;
        const id = typeof sheet.id === 'string' && sheet.id ? sheet.id : null;
        if (!id) throw new Error(`Schema v3 Drawing sheets[${index}].id is required`);
        if (!Array.isArray(sheet.entities)) {
          throw new Error(`Schema v3 Drawing sheets[${index}].entities must be an array`);
        }
        if (sheet.entities.length > 0) {
          throw new Error(
            `Schema v3 Drawing sheets[${index}] contains legacy untyped entities; safe automatic migration is unavailable`,
          );
        }
        for (const reserved of ['width', 'height', 'layers', 'activeLayerId']) {
          if (Object.prototype.hasOwnProperty.call(sheet, reserved)) {
            throw new Error(
              `Schema v3 Drawing sheets[${index}] already contains unknown ${reserved}; refusing destructive migration`,
            );
          }
        }
        if (sheet.format !== 'A4') {
          throw new Error(`Schema v3 Drawing sheets[${index}].format is unsupported for R1 migration: ${String(sheet.format)}`);
        }
        const orientation = sheet.orientation === 'portrait' ? 'portrait'
          : sheet.orientation === 'landscape' ? 'landscape'
            : (() => { throw new Error(`Schema v3 Drawing sheets[${index}].orientation is unsupported`); })();
        const scale = Number(sheet.scale);
        if (!Number.isFinite(scale) || scale <= 0) {
          throw new Error(`Schema v3 Drawing sheets[${index}].scale must be positive`);
        }
        return {
          ...sheet,
          ...makeSheet(id, typeof sheet.name === 'string' && sheet.name ? sheet.name : `Лист ${index + 1}`, orientation),
          scale,
        };
      });

  return { ...input, schemaVersion: context.targetSchemaVersion, sheets };
});

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
