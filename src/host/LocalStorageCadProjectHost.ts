import type { CadProjectHost, CadProjectLoadResult } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import { migrateCadDocument, serializeCadDocument } from '../contracts';

export interface LocalStorageCadProjectHostOptions {
  initialDocument: CadDocument;
  storage?: Storage;
  storageKey?: string;
}

interface StoredProjectState {
  serializedDocument: string;
  revision: number;
  mutations: Record<string, number>;
}

export const DEFAULT_STANDALONE_CAD_STORAGE_KEY = 'asa-cad-m2-shell-document';

/**
 * Standalone browser persistence with the same optimistic revision/idempotency
 * contract as the ASA Lab host. The legacy raw-document key is retained as a
 * compatibility mirror for existing standalone tooling and exports.
 */
export class LocalStorageCadProjectHost implements CadProjectHost {
  private readonly storage: Storage;
  private readonly storageKey: string;
  private readonly stateKey: string;
  private readonly initialSerializedDocument: string;

  constructor(options: LocalStorageCadProjectHostOptions) {
    const storage = options.storage ?? globalThis.localStorage;
    if (!storage) throw new Error('localStorage is unavailable');
    this.storage = storage;
    this.storageKey = options.storageKey ?? DEFAULT_STANDALONE_CAD_STORAGE_KEY;
    this.stateKey = `${this.storageKey}:state`;
    this.initialSerializedDocument = serializeCadDocument(options.initialDocument);
  }

  hasPersistedDocument(): boolean {
    return this.storage.getItem(this.stateKey) !== null || this.storage.getItem(this.storageKey) !== null;
  }

  async load(): Promise<CadProjectLoadResult> {
    const state = this.readState();
    return {
      document: migrateCadDocument(state.serializedDocument),
      revision: state.revision,
    };
  }

  async save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }> {
    if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0) {
      throw new Error('baseRevision must be a non-negative integer');
    }
    if (!input.mutationId) throw new Error('mutationId is required');

    const state = this.readState();
    const previouslyApplied = state.mutations[input.mutationId];
    if (previouslyApplied !== undefined) return { revision: previouslyApplied };

    if (input.baseRevision !== state.revision) {
      throw new LocalStorageCadRevisionConflictError(input.baseRevision, state.revision);
    }

    const revision = state.revision + 1;
    const serializedDocument = serializeCadDocument(input.document);
    const mutations = {
      ...state.mutations,
      [input.mutationId]: revision,
    };
    const recentMutations = Object.fromEntries(Object.entries(mutations).slice(-32));
    const nextState: StoredProjectState = { serializedDocument, revision, mutations: recentMutations };

    // One canonical envelope owns revision/idempotency. The raw JSON key is a
    // compatibility mirror only and is never revision authority once the
    // envelope exists.
    this.storage.setItem(this.stateKey, JSON.stringify(nextState));
    try {
      this.storage.setItem(this.storageKey, serializedDocument);
    } catch {
      // Canonical state was already persisted. A compatibility mirror failure
      // must not turn a successful local save into a false revision conflict.
    }

    return { revision };
  }

  private readState(): StoredProjectState {
    const envelope = this.storage.getItem(this.stateKey);
    if (envelope) {
      const parsed = JSON.parse(envelope) as Partial<StoredProjectState>;
      if (
        typeof parsed.serializedDocument !== 'string'
        || !Number.isSafeInteger(parsed.revision)
        || Number(parsed.revision) < 0
        || !parsed.mutations
        || typeof parsed.mutations !== 'object'
      ) {
        throw new Error('Stored ASA-CAD standalone project state is invalid');
      }
      return {
        serializedDocument: parsed.serializedDocument,
        revision: Number(parsed.revision),
        mutations: parsed.mutations as Record<string, number>,
      };
    }

    // Backward compatibility with the pre-O3 standalone raw JSON save.
    const legacyDocument = this.storage.getItem(this.storageKey);
    return {
      serializedDocument: legacyDocument ?? this.initialSerializedDocument,
      revision: 0,
      mutations: {},
    };
  }
}

export class LocalStorageCadRevisionConflictError extends Error {
  readonly code = 'CAD_REVISION_CONFLICT';

  constructor(
    readonly baseRevision: number,
    readonly currentRevision: number,
  ) {
    super(`CadDocument revision conflict: base=${baseRevision}, current=${currentRevision}`);
    this.name = 'LocalStorageCadRevisionConflictError';
  }
}
