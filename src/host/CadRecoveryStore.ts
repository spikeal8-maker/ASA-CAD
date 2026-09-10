import type { CadDocument } from '../contracts/document';
import { migrateCadDocument, serializeCadDocument } from '../contracts';

export interface CadRecoveryRecord {
  projectKey: string;
  document: CadDocument;
  baseRevision: number;
  savedAt: string;
  pendingMutationId?: string;
}

export interface CadRecoveryStore {
  load(projectKey: string): Promise<CadRecoveryRecord | null>;
  save(record: CadRecoveryRecord): Promise<void>;
  clear(projectKey: string): Promise<void>;
}

interface StoredRecoveryRecord {
  projectKey: string;
  serializedDocument: string;
  baseRevision: number;
  savedAt: string;
  pendingMutationId?: string;
}

/** Browser crash/network recovery only. ASA Lab remains cross-device authority. */
export class IndexedDbCadRecoveryStore implements CadRecoveryStore {
  constructor(
    private readonly indexedDb: IDBFactory = globalThis.indexedDB,
    private readonly databaseName = 'asa-cad-recovery',
    private readonly storeName = 'projects',
  ) {
    if (!indexedDb) throw new Error('IndexedDB is unavailable');
  }

  async load(projectKey: string): Promise<CadRecoveryRecord | null> {
    const db = await this.open();
    try {
      const stored = await this.request<StoredRecoveryRecord | undefined>(
        db.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(projectKey),
      );
      if (!stored) return null;
      return {
        projectKey: stored.projectKey,
        document: migrateCadDocument(stored.serializedDocument),
        baseRevision: stored.baseRevision,
        savedAt: stored.savedAt,
        pendingMutationId: stored.pendingMutationId,
      };
    } finally {
      db.close();
    }
  }

  async save(record: CadRecoveryRecord): Promise<void> {
    if (!record.projectKey) throw new Error('projectKey is required');
    if (!Number.isSafeInteger(record.baseRevision) || record.baseRevision < 0) {
      throw new Error('baseRevision must be a non-negative integer');
    }
    const db = await this.open();
    try {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put({
        projectKey: record.projectKey,
        serializedDocument: serializeCadDocument(record.document),
        baseRevision: record.baseRevision,
        savedAt: record.savedAt,
        pendingMutationId: record.pendingMutationId,
      } satisfies StoredRecoveryRecord);
      await this.transaction(tx);
    } finally {
      db.close();
    }
  }

  async clear(projectKey: string): Promise<void> {
    const db = await this.open();
    try {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(projectKey);
      await this.transaction(tx);
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.indexedDb.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'projectKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }

  private transaction(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }
}

export class MemoryCadRecoveryStore implements CadRecoveryStore {
  private readonly records = new Map<string, StoredRecoveryRecord>();

  async load(projectKey: string): Promise<CadRecoveryRecord | null> {
    const stored = this.records.get(projectKey);
    if (!stored) return null;
    return {
      projectKey: stored.projectKey,
      document: migrateCadDocument(stored.serializedDocument),
      baseRevision: stored.baseRevision,
      savedAt: stored.savedAt,
      pendingMutationId: stored.pendingMutationId,
    };
  }

  async save(record: CadRecoveryRecord): Promise<void> {
    this.records.set(record.projectKey, {
      projectKey: record.projectKey,
      serializedDocument: serializeCadDocument(record.document),
      baseRevision: record.baseRevision,
      savedAt: record.savedAt,
      pendingMutationId: record.pendingMutationId,
    });
  }

  async clear(projectKey: string): Promise<void> {
    this.records.delete(projectKey);
  }
}
