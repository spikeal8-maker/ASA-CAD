import type { CadProjectHost, CadProjectLoadResult } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import { parseCadDocument, serializeCadDocument } from '../contracts/document';

/**
 * Deterministic standalone/test host. It implements the same optimistic
 * revision contract that the ASA Lab Project Core adapter will implement.
 */
export class MemoryCadProjectHost implements CadProjectHost {
  private serializedDocument: string;
  private revision: number;
  private readonly appliedMutations = new Map<string, number>();

  constructor(document: CadDocument, revision = 0) {
    if (!Number.isInteger(revision) || revision < 0) throw new Error('revision must be a non-negative integer');
    this.serializedDocument = serializeCadDocument(document);
    this.revision = revision;
  }

  async load(): Promise<CadProjectLoadResult> {
    return {
      document: parseCadDocument(this.serializedDocument),
      revision: this.revision,
    };
  }

  async save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }> {
    const existing = this.appliedMutations.get(input.mutationId);
    if (existing !== undefined) return { revision: existing };

    if (input.baseRevision !== this.revision) {
      throw new CadRevisionConflictError(input.baseRevision, this.revision);
    }
    if (!input.mutationId) throw new Error('mutationId is required');

    this.serializedDocument = serializeCadDocument(input.document);
    this.revision += 1;
    this.appliedMutations.set(input.mutationId, this.revision);
    return { revision: this.revision };
  }
}

export class CadRevisionConflictError extends Error {
  readonly code = 'CAD_REVISION_CONFLICT';

  constructor(
    readonly baseRevision: number,
    readonly currentRevision: number,
  ) {
    super(`CadDocument revision conflict: base=${baseRevision}, current=${currentRevision}`);
    this.name = 'CadRevisionConflictError';
  }
}
