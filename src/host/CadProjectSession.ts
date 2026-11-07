import type { CadProjectHost } from '../contracts/application';
import { parseCadDocument, serializeCadDocument, type CadDocument } from '../contracts/document';
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
  private revisionEpoch = 0;

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
    this.revisionEpoch += 1;
    this.revision = remote.revision;
    return { document: remote.document, revision: remote.revision, recovery };
  }

  async save(document: CadDocument): Promise<{ revision: number }> {
    if (this.revision === null) throw new Error('CadProjectSession.open() must run before save()');
    const epoch = this.revisionEpoch;
    const mutationId = this.createMutationId();
    const record: CadRecoveryRecord = {
      projectKey: this.options.projectKey,
      document: parseCadDocument(serializeCadDocument(document)),
      baseRevision: this.revision,
      savedAt: (this.options.now ?? (() => new Date()))().toISOString(),
      pendingMutationId: mutationId,
    };

    await this.options.recovery.save(record);
    const result = await this.options.host.save({
      document: record.document,
      baseRevision: record.baseRevision,
      mutationId,
    });
    this.acknowledgeRevision(result.revision, epoch);
    await this.options.recovery.clearAcknowledged(this.options.projectKey, mutationId);
    return result;
  }

  async retryRecovery(): Promise<{ revision: number } | null> {
    const epoch = this.revisionEpoch;
    const record = await this.options.recovery.load(this.options.projectKey);
    if (!record) return null;
    if (!record.pendingMutationId) throw new Error('Recovery record has no mutationId');

    const result = await this.options.host.save({
      document: record.document,
      baseRevision: record.baseRevision,
      mutationId: record.pendingMutationId,
    });
    this.acknowledgeRevision(result.revision, epoch);
    await this.options.recovery.clearAcknowledged(this.options.projectKey, record.pendingMutationId);
    return result;
  }

  async discardRecovery(): Promise<void> {
    await this.options.recovery.clear(this.options.projectKey);
  }

  private acknowledgeRevision(revision: number, epoch: number): void {
    // A completed open owns a new optimistic base; older ACKs cannot replace it.
    if (epoch === this.revisionEpoch) this.revision = Math.max(this.revision ?? 0, revision);
  }

  private createMutationId(): string {
    if (this.options.mutationIdFactory) return this.options.mutationIdFactory();
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `cad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
