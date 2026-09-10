import type { CadProjectHost } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import type { CadRecoveryRecord, CadRecoveryStore } from './CadRecoveryStore';

export interface CadProjectSessionOptions {
  projectKey: string;
  host: CadProjectHost;
  recovery: CadRecoveryStore;
  mutationIdFactory?: () => string;
  now?: () => Date;
}

export interface CadProjectSessionOpenResult {
  document: CadDocument;
  revision: number;
  recovery: CadRecoveryRecord | null;
}

/**
 * Coordinates authoritative host persistence with local crash/network recovery.
 * It never computes geometry and never decides that local recovery is newer
 * authority automatically; the caller must explicitly restore it.
 */
export class CadProjectSession {
  private revision: number | null = null;

  constructor(private readonly options: CadProjectSessionOptions) {
    if (!options.projectKey) throw new Error('projectKey is required');
  }

  getRevision(): number | null {
    return this.revision;
  }

  async open(): Promise<CadProjectSessionOpenResult> {
    const [remote, recovery] = await Promise.all([
      this.options.host.load(),
      this.options.recovery.load(this.options.projectKey),
    ]);
    this.revision = remote.revision;
    return { document: remote.document, revision: remote.revision, recovery };
  }

  async save(document: CadDocument): Promise<{ revision: number }> {
    if (this.revision === null) throw new Error('CadProjectSession.open() must run before save()');
    const mutationId = this.createMutationId();
    const record: CadRecoveryRecord = {
      projectKey: this.options.projectKey,
      document,
      baseRevision: this.revision,
      savedAt: (this.options.now ?? (() => new Date()))().toISOString(),
      pendingMutationId: mutationId,
    };

    await this.options.recovery.save(record);
    const result = await this.options.host.save({
      document,
      baseRevision: record.baseRevision,
      mutationId,
    });
    this.revision = result.revision;
    await this.options.recovery.clear(this.options.projectKey);
    return result;
  }

  async retryRecovery(): Promise<{ revision: number } | null> {
    const record = await this.options.recovery.load(this.options.projectKey);
    if (!record) return null;
    if (!record.pendingMutationId) throw new Error('Recovery record has no mutationId');

    const result = await this.options.host.save({
      document: record.document,
      baseRevision: record.baseRevision,
      mutationId: record.pendingMutationId,
    });
    this.revision = result.revision;
    await this.options.recovery.clear(this.options.projectKey);
    return result;
  }

  async discardRecovery(): Promise<void> {
    await this.options.recovery.clear(this.options.projectKey);
  }

  private createMutationId(): string {
    if (this.options.mutationIdFactory) return this.options.mutationIdFactory();
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `cad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
