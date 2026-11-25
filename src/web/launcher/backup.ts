import { LocalCadProjects, type LocalCadBackup } from '../../host/LocalCadProjects';

const RECOVERY_DATABASE = 'asa-cad-recovery';
const RECOVERY_STORE = 'projects';
export interface CadBackupError { source: 'localStorage' | 'indexedDB'; key?: string; message: string }
interface RawRecoveryBackup {
  database: string; store: string; status: 'absent' | 'read' | 'partial' | 'unavailable';
  // JSON omits undefined object fields/changes undefined array items to null;
  // these paths restore their exact stored value without parsing document bytes.
  records: Array<{ key: unknown; value: unknown; undefinedPaths?: Array<Array<string | number>> }>;
}
export interface LocalCadFullBackup extends Omit<LocalCadBackup, 'version' | 'errors'> {
  version: 2; origin: string; recovery: RawRecoveryBackup; errors: CadBackupError[];
}
export interface CadBackupOptions { indexedDb?: IDBFactory | null; origin?: string; timeoutMs?: number }
export interface CadBackupDownload {
  readonly complete: boolean; readonly errors: readonly CadBackupError[]; readonly fileName: string;
  readonly localEntries: number; readonly recoveryRecords: number;
  readonly sha256?: string; readonly checksumError?: string;
}

/** JSON export must not silently strip malformed, non-JSON recovery fields. */
function assertJsonValue(
  value: unknown, ancestors = new Set<object>(), undefinedPaths?: Array<Array<string | number>>, path: Array<string | number> = [],
): void {
  if (value === undefined && undefinedPaths) { undefinedPaths.push(path); return; }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error('Запись не представима в JSON без потери данных');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('Запись содержит неподдерживаемое для JSON значение');
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new Error('Запись содержит разреженный массив, не представимый в JSON без потери данных');
      assertJsonValue(value[index], ancestors, undefinedPaths, [...path, index]);
    }
  } else {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, ancestors, undefinedPaths, [...path, key]);
  }
  ancestors.delete(value);
}

/** Enumerate first, never create/upgrade a database, then read every key in one readonly transaction. */
function readRawRecovery(
  factory: IDBFactory, result: RawRecoveryBackup, errors: CadBackupError[], timeoutMs: number,
): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    let database: IDBDatabase | undefined;
    const finish = (status: RawRecoveryBackup['status'], reason?: unknown) => {
      if (settled) return;
      settled = true;
      result.status = status;
      if (reason !== undefined) errors.push({ source: 'indexedDB', message: String(reason) });
      clearTimeout(timer);
      database?.close();
      resolve();
    };
    const timer = setTimeout(() => finish('partial', 'Время чтения резервных записей IndexedDB истекло'), timeoutMs);
    void Promise.resolve().then(() => {
      if (typeof factory.databases !== 'function') throw new Error('Браузер не позволяет безопасно перечислить IndexedDB; база не открывалась');
      return factory.databases();
    }).then(databases => {
      if (settled) return;
      if (!databases.some(item => item.name === RECOVERY_DATABASE)) { finish('absent'); return; }
      const request = factory.open(RECOVERY_DATABASE);
      request.onupgradeneeded = () => {
        // The database may disappear after enumeration. Abort its creation transaction.
        request.transaction?.abort();
        finish('unavailable', 'База recovery изменилась во время экспорта; создание или обновление отменено');
      };
      request.onblocked = () => finish('unavailable', 'Чтение recovery заблокировано другой вкладкой');
      request.onerror = () => finish('unavailable', request.error ?? new Error('Не удалось открыть recovery'));
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); return; }
        if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
          finish('partial', 'В базе recovery отсутствует ожидаемое хранилище projects'); return;
        }
        try {
          const transaction = database.transaction(RECOVERY_STORE, 'readonly');
          const cursorRequest = transaction.objectStore(RECOVERY_STORE).openCursor();
          transaction.oncomplete = () => finish(errors.some(error => error.source === 'indexedDB') ? 'partial' : 'read');
          transaction.onabort = () => finish('partial', transaction.error ?? new Error('Чтение recovery прервано'));
          cursorRequest.onerror = () => finish('partial', cursorRequest.error ?? new Error('Не удалось прочитать recovery'));
          cursorRequest.onsuccess = () => {
            if (settled || !cursorRequest.result) return;
            const cursor = cursorRequest.result;
            try {
              const undefinedPaths: Array<Array<string | number>> = [];
              assertJsonValue(cursor.primaryKey);
              assertJsonValue(cursor.value, new Set(), undefinedPaths);
              result.records.push({ key: cursor.primaryKey, value: cursor.value,
                ...(undefinedPaths.length ? { undefinedPaths } : {}) });
            } catch (reason) {
              errors.push({ source: 'indexedDB',
                ...(typeof cursor.primaryKey === 'string' ? { key: cursor.primaryKey } : {}), message: String(reason) });
            }
            try { cursor.continue(); } catch (reason) { finish('partial', reason); }
          };
        } catch (reason) { finish('partial', reason); }
      };
    }).catch(reason => finish('unavailable', reason));
  });
}

/** Complete means all requested reads succeeded; localStorage and IndexedDB are not an atomic cross-store snapshot. */
export async function collectLocalCadBackup(
  catalog: LocalCadProjects, options: CadBackupOptions = {},
): Promise<LocalCadFullBackup> {
  const backup = catalog.backup();
  const errors: CadBackupError[] = backup.errors.map(error => ({ source: 'localStorage', ...error }));
  const recovery: RawRecoveryBackup = { database: RECOVERY_DATABASE, store: RECOVERY_STORE, status: 'unavailable', records: [] };
  try {
    const factory = options.indexedDb === undefined ? globalThis.indexedDB : options.indexedDb;
    if (!factory) throw new Error('IndexedDB недоступна; экспорт содержит только доступные локальные данные');
    await readRawRecovery(factory, recovery, errors, options.timeoutMs ?? 5000);
  } catch (reason) { errors.push({ source: 'indexedDB', message: String(reason) }); }
  return { ...backup, version: 2, origin: options.origin ?? globalThis.location?.origin ?? '',
    complete: errors.length === 0, errors, recovery };
}

/** A partial export still downloads. Callers must show complete/errors; a download request is not disk verification. */
export async function downloadLocalCadBackup(
  catalog: LocalCadProjects, options?: CadBackupOptions,
): Promise<CadBackupDownload> {
  const backup = await collectLocalCadBackup(catalog, options);
  const output = JSON.stringify(backup, null, 2);
  const bytes = new TextEncoder().encode(output);
  let sha256: string | undefined, checksumError: string | undefined;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (reason) { checksumError = String(reason); }
  const blob = new Blob([bytes], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `ASA-CAD-backup-${backup.exportedAt.replace(/[:.]/g, '-')}${backup.complete ? '' : '-partial'}.json`;
  link.href = url;
  link.download = fileName;
  try { document.body.appendChild(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  return { complete: backup.complete, errors: backup.errors, fileName,
    localEntries: Object.keys(backup.entries).length, recoveryRecords: backup.recovery.records.length,
    ...(sha256 ? { sha256 } : {}), ...(checksumError ? { checksumError } : {}) };
}
