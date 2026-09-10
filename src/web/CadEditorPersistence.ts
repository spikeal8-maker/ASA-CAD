import type { CadClientRoute } from '../browser/routes';
import type { CadDocument } from '../contracts/document';
import { createBrowserCadProjectSession } from '../host/createBrowserCadProjectSession';

type SessionBundle = ReturnType<typeof createBrowserCadProjectSession>;

function projectKeyForRoute(route: CadClientRoute): string {
  switch (route.kind) {
    case 'editor': return `project:${route.projectId}`;
    case 'viewer': return `viewer:${route.versionId}`;
    case 'dev-part': return `fixture:${route.fixture}`;
    case 'standalone': return 'standalone';
    case 'unknown': return `route:${route.pathname}`;
  }
}

/** Product UI persistence facade. No UI component owns storage/network keys. */
export class CadEditorPersistence {
  private readonly bundle: SessionBundle;
  private openPromise: ReturnType<SessionBundle['session']['open']> | null = null;

  constructor(route: CadClientRoute, initialDocument: CadDocument) {
    this.bundle = createBrowserCadProjectSession(projectKeyForRoute(route), initialDocument);
  }

  getProjectKey(): string {
    return this.bundle.projectKey;
  }

  getStandaloneStorageKey(): string {
    return this.bundle.host.getStorageKey();
  }

  async load(): Promise<CadDocument> {
    const opened = await this.ensureOpen();
    return opened.document;
  }

  async save(document: CadDocument): Promise<{ revision: number }> {
    await this.ensureOpen();
    return this.bundle.session.save(document);
  }

  async retryRecovery(): Promise<{ revision: number } | null> {
    await this.ensureOpen();
    return this.bundle.session.retryRecovery();
  }

  private ensureOpen(): ReturnType<SessionBundle['session']['open']> {
    if (!this.openPromise) this.openPromise = this.bundle.session.open();
    return this.openPromise;
  }
}
