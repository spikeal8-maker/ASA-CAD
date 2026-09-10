import type { CadProjectHost, CadProjectLoadResult } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import { parseCadDocument, serializeCadDocument } from '../contracts/document';
import { CadRevisionConflictError } from './MemoryCadProjectHost';

interface StoredProjectRecord {
  revision: number;
  serializedDocument: string;
  appliedMutations: Record<string, number>;
}

/**
 * Browser standalone persistence behind the same CadProjectHost contract used
 * by ASA Lab. localStorage is only a host implementation detail; product UI
 * must talk through CadProjectSession/CadProjectHost instead of owning keys.
 */
export class LocalStorageCadProjectHost implements CadProjectHost {
  private readonly storageKey: string;

  constructor(
    private readonly projectKey: string,
    private readonly initialDocument: CadDocument,
    private readonly storage: Storage = globalThis.localStorage,
  ) {
    if (!projectKey) throw new Error('projectKey is required');
    if (!storage) throw new Error('localStorage is unavailable');
    this.storageKey = `asa-cad-project:${projectKey}`;
  }

  async load(): Promise<CadProjectLoadResult> {
    const stored = this.read();
    if (!stored) {
      return {
        document: parseCadDocument(serializeCadDocument(this.initialDocument)),
        revision: 0,
      };
    }
    return {
      document: parseCadDocument(stored.serializedDocument),
      revision: stored.revision,
    };
  }

  async save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }> {
    if (!input.mutationId) throw new Error('mutationId is required');

    const stored = this.read() ?? {
      revision: 0,
      serializedDocument: serializeCadDocument(this.initialDocument),
      appliedMutations: {},
    };

    const existingRevision = stored.appliedMutations[input.mutationId];
    if (existingRevision !== undefined) return { revision: existingRevision };

    if (input.baseRevision !== stored.revision) {
      throw new CadRevisionConflictError(input.baseRevision, stored.revision);
    }

    const revision = stored.revision + 1;
    const appliedMutations = {
      ...stored.appliedMutations,
      [input.mutationId]: revision,
    };

    const mutationEntries = Object.entries(appliedMutations);
    const boundedMutations = Object.fromEntries(mutationEntries.slice(Math.max(0, mutationEntries.length - 50)));

    this.storage.setItem(this.storageKey, JSON.stringify({
      revision,
      serializedDocument: serializeCadDocument(input.document),
      appliedMutations: boundedMutations,
    } satisfies StoredProjectRecord));

    return { revision };
  }

  async saveSnapshot(_input: { imageDataUrl: string; sourceRevision: number }): Promise<void> {
    // Standalone M2 does not need a separate snapshot gallery. The method is a
    // deliberate no-op host capability so UI/persistence code remains identical.
  }

  getStorageKey(): string {
    return this.storageKey;
  }

  private read(): StoredProjectRecord | null {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProjectRecord>;
    if (!Number.isSafeInteger(parsed.revision) || Number(parsed.revision) < 0) {
      throw new Error(`Invalid stored CAD revision for ${this.projectKey}`);
    }
    if (typeof parsed.serializedDocument !== 'string') {
      throw new Error(`Invalid stored CAD document for ${this.projectKey}`);
    }
    return {
      revision: Number(parsed.revision),
      serializedDocument: parsed.serializedDocument,
      appliedMutations: parsed.appliedMutations && typeof parsed.appliedMutations === 'object'
        ? parsed.appliedMutations as Record<string, number>
        : {},
    };
  }
}
