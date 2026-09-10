import type { CadProjectHost, CadProjectLoadResult } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import { migrateCadDocument } from '../contracts/migrations';

export interface AsaLabCadProjectHostOptions {
  projectId: string;
  fetch?: typeof globalThis.fetch;
  apiBase?: string;
}

interface DraftEnvelope {
  document: unknown;
  revision: number;
}

/**
 * Same-origin adapter to ASA Lab Project Core. It performs persistence only;
 * there are intentionally no geometry/recompute/solver endpoints here.
 */
export class AsaLabCadProjectHost implements CadProjectHost {
  private readonly projectId: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly apiBase: string;

  constructor(options: AsaLabCadProjectHostOptions) {
    if (!options.projectId) throw new Error('projectId is required');
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
    this.projectId = options.projectId;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.apiBase = (options.apiBase ?? '/api/projects').replace(/\/$/, '');
  }

  async load(): Promise<CadProjectLoadResult> {
    const response = await this.request(this.projectUrl(), { method: 'GET' });
    const payload = await response.json() as Record<string, unknown>;
    const draft = this.readDraft(payload.draft, 'load');
    return {
      document: migrateCadDocument(draft.document),
      revision: draft.revision,
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

    const response = await this.request(`${this.projectUrl()}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: input.document,
        baseRevision: input.baseRevision,
        mutationId: input.mutationId,
      }),
    });
    const payload = await response.json() as Record<string, unknown>;
    const draft = this.readDraft(payload.draft, 'save');
    return { revision: draft.revision };
  }

  async saveSnapshot(input: {
    imageDataUrl: string;
    sourceRevision: number;
  }): Promise<void> {
    if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
      throw new Error('sourceRevision must be a non-negative integer');
    }
    await this.request(`${this.projectUrl()}/snapshot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  private projectUrl(): string {
    return `${this.apiBase}/${encodeURIComponent(this.projectId)}`;
  }

  private async request(input: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(input, {
        ...init,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw new CadHostNetworkError(error instanceof Error ? error.message : String(error));
    }

    if (response.ok) return response;

    let code: string | undefined;
    let message: string | undefined;
    try {
      const payload = await response.clone().json() as { error?: { code?: string; message?: string } };
      code = payload.error?.code;
      message = payload.error?.message;
    } catch {
      // Non-JSON failures are still represented by status below.
    }

    if (response.status === 409 && code === 'project_revision_conflict') {
      throw new AsaLabCadRevisionConflictError(message ?? 'Project revision conflict');
    }
    const fallbackMessage = response.statusText || 'ASA Lab request failed';
    throw new CadHostHttpError(response.status, code, message ?? fallbackMessage);
  }

  private readDraft(value: unknown, operation: string): DraftEnvelope {
    if (!value || typeof value !== 'object') throw new Error(`ASA Lab ${operation} response has no draft`);
    const draft = value as Record<string, unknown>;
    if (!Number.isSafeInteger(draft.revision) || Number(draft.revision) < 0) {
      throw new Error(`ASA Lab ${operation} draft.revision is invalid`);
    }
    if (!('document' in draft)) throw new Error(`ASA Lab ${operation} draft.document is missing`);
    return { document: draft.document, revision: Number(draft.revision) };
  }
}

export class CadHostHttpError extends Error {
  readonly name = 'CadHostHttpError';
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export class AsaLabCadRevisionConflictError extends CadHostHttpError {
  readonly name = 'AsaLabCadRevisionConflictError';
  constructor(message: string) {
    super(409, 'project_revision_conflict', message);
  }
}

export class CadHostNetworkError extends Error {
  readonly name = 'CadHostNetworkError';
  readonly code = 'CAD_HOST_NETWORK_ERROR';
}
