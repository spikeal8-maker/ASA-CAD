import type { CadProjectHost } from '../contracts/application';
import { createEmptyCadDocument, serializeCadDocument, type CadDocument } from '../contracts/document';
import { migrateCadDocument } from '../contracts/migrations';
import { isLocalCadProjectId, type CadEditorMode } from '../browser/editorModes';
import { LocalStorageCadProjectHost, DEFAULT_STANDALONE_CAD_STORAGE_KEY } from './LocalStorageCadProjectHost';

const PREFIX = 'asa-cad-local-project:';
export interface LocalCadProject {
  id: string; title: string; mode: CadEditorMode; updatedAt?: string; legacy: boolean;
}
export interface LocalCadBackup {
  format: 'asa-cad-local-backup'; version: 1; exportedAt: string;
  entries: Record<string, string>; complete: boolean;
  errors: Array<{ key?: string; message: string }>;
}
interface ProjectEnvelope {
  serializedDocument: string; revision: number; mutations: Record<string, number>;
  launcher?: { mode: CadEditorMode; updatedAt: string };
}

/** A catalog of the existing host envelopes, never a second document/history store. */
export class LocalCadProjects {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  private key(id: string): string {
    if (!isLocalCadProjectId(id)) throw new Error('Некорректный идентификатор проекта');
    return id === 'legacy' ? DEFAULT_STANDALONE_CAD_STORAGE_KEY : `${PREFIX}${id}`;
  }

  private envelope(id: string): ProjectEnvelope | null {
    const key = this.key(id);
    const value = this.storage.getItem(`${key}:state`);
    if (value !== null) {
      const parsed = JSON.parse(value) as ProjectEnvelope;
      if (!parsed || typeof parsed.serializedDocument !== 'string'
        || !Number.isSafeInteger(parsed.revision) || parsed.revision < 0
        || !parsed.mutations || typeof parsed.mutations !== 'object' || Array.isArray(parsed.mutations)
        || Object.values(parsed.mutations).some(revision => !Number.isSafeInteger(revision)
          || revision < 0 || revision > parsed.revision)) {
        throw new Error('Локальный проект повреждён. Исходные данные сохранены без изменений.');
      }
      migrateCadDocument(parsed.serializedDocument);
      return parsed;
    }
    const legacy = this.storage.getItem(key);
    if (legacy === null) return null;
    migrateCadDocument(legacy);
    return { serializedDocument: legacy, revision: 0, mutations: {} };
  }

  ids(): string[] {
    const ids = new Set<string>();
    if (this.storage.getItem(DEFAULT_STANDALONE_CAD_STORAGE_KEY) !== null
      || this.storage.getItem(`${DEFAULT_STANDALONE_CAD_STORAGE_KEY}:state`) !== null) ids.add('legacy');
    for (let i = 0; i < this.storage.length; i += 1) {
      const key = this.storage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const id = key.slice(PREFIX.length).replace(/:state$/, '');
      if (isLocalCadProjectId(id)) ids.add(id);
    }
    return [...ids];
  }

  list(onUnreadable?: (id: string) => void): LocalCadProject[] {
    return this.ids().flatMap(id => {
      try {
        const saved = this.envelope(id);
        if (!saved) return [];
        const document = migrateCadDocument(saved.serializedDocument);
        return [{ id, title: document.title, legacy: id === 'legacy',
          mode: saved.launcher?.mode === 'fusion' ? 'fusion' as const : 'kompas' as const,
          updatedAt: typeof saved.launcher?.updatedAt === 'string'
            && Number.isFinite(Date.parse(saved.launcher.updatedAt)) ? saved.launcher.updatedAt : undefined }];
      } catch (reason) {
        if (!onUnreadable) throw reason;
        onUnreadable(id);
        return [];
      }
    }).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  create(mode: CadEditorMode, title: string): string {
    const normalized = title.trim();
    if (!normalized || normalized.length > 120) throw new Error('Введите название проекта длиной до 120 символов');
    const id = crypto.randomUUID();
    const document = createEmptyCadDocument('part', { title: normalized });
    this.storage.setItem(`${this.key(id)}:state`, JSON.stringify({
      serializedDocument: serializeCadDocument(document), revision: 0, mutations: {},
      launcher: { mode, updatedAt: new Date().toISOString() },
    } satisfies ProjectEnvelope));
    return id;
  }

  host(id: string, mode: CadEditorMode | (() => CadEditorMode)): CadProjectHost {
    const saved = this.envelope(id);
    if (!saved) throw new Error('Проект не найден в этом браузере');
    const key = this.key(id), storage = this.storage;
    const catalogStorage: Storage = {
      get length() { return storage.length; },
      clear: () => { throw new Error('Очистка хранилища недоступна из редактора'); },
      key: index => storage.key(index), getItem: name => storage.getItem(name),
      removeItem: name => storage.removeItem(name),
      setItem(name, value) {
        const next = name === `${key}:state`
          ? JSON.stringify({ ...JSON.parse(value), launcher: {
            mode: typeof mode === 'function' ? mode() : mode, updatedAt: new Date().toISOString(),
          } })
          : value;
        storage.setItem(name, next);
      },
    };
    return new LocalStorageCadProjectHost({ storage: catalogStorage, storageKey: key,
      initialDocument: migrateCadDocument(saved.serializedDocument) });
  }

  /** Raw document slots only. Failed reads do not prevent export of other recoverable bytes. */
  backup(): LocalCadBackup {
    const entries: Record<string, string> = {};
    const errors: LocalCadBackup['errors'] = [];
    const keys = new Set([DEFAULT_STANDALONE_CAD_STORAGE_KEY, `${DEFAULT_STANDALONE_CAD_STORAGE_KEY}:state`]);
    let length = 0;
    try { length = this.storage.length; }
    catch (reason) { errors.push({ message: `Не удалось перечислить локальные проекты: ${String(reason)}` }); }
    for (let index = 0; index < length; index += 1) {
      try {
        const key = this.storage.key(index);
        if (key?.startsWith(PREFIX) && isLocalCadProjectId(key.slice(PREFIX.length).replace(/:state$/, ''))) keys.add(key);
      } catch (reason) { errors.push({ message: `Не удалось прочитать имя локального проекта ${index}: ${String(reason)}` }); }
    }
    for (const key of keys) {
      try {
        const value = this.storage.getItem(key);
        if (value !== null) entries[key] = value;
      } catch (reason) { errors.push({ key, message: String(reason) }); }
    }
    return { format: 'asa-cad-local-backup', version: 1, exportedAt: new Date().toISOString(), entries,
      complete: errors.length === 0, errors };
  }

  /** Restore into fresh project slots. Existing projects and legacy bytes are never overwritten. */
  importDocument(document: CadDocument, mode: CadEditorMode): string {
    const checked = migrateCadDocument(serializeCadDocument(document));
    const id = crypto.randomUUID();
    this.storage.setItem(`${this.key(id)}:state`, JSON.stringify({
      serializedDocument: serializeCadDocument(checked), revision: 0, mutations: {},
      launcher: { mode, updatedAt: new Date().toISOString() },
    } satisfies ProjectEnvelope));
    return id;
  }
}
