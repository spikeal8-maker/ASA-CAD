import type { CadApplication } from '../contracts/application';
import { parseCadDocument, serializeCadDocument, type CadDocument } from '../contracts/document';
import type { CadProjectSession, CadProjectSessionOpenResult } from './CadProjectSession';

export type CadPersistenceApplication = Pick<CadApplication, 'getDocument' | 'replaceDocument'>;

export interface CadPersistedDocumentPresence {
  hasPersistedDocument(): boolean | Promise<boolean>;
}

/**
 * Editor-facing persistence controller. UI code asks to save/open; host,
 * revision, mutation and recovery mechanics remain behind CadProjectSession.
 */
export class CadEditorPersistence {
  private initialization: Promise<CadProjectSessionOpenResult> | null = null;

  constructor(
    private readonly application: CadPersistenceApplication,
    private readonly session: CadProjectSession,
    private readonly presence?: CadPersistedDocumentPresence,
  ) {}

  async hasPersistedDocument(): Promise<boolean> {
    return this.presence ? this.presence.hasPersistedDocument() : true;
  }

  async save(): Promise<{ revision: number }> {
    await this.ensureSessionOpened();
    return this.session.save(this.snapshotDocument());
  }

  async open(): Promise<CadProjectSessionOpenResult> {
    const result = await this.session.open();
    this.initialization = Promise.resolve(result);
    await this.application.replaceDocument(result.document);
    return result;
  }

  getRevision(): number | null {
    return this.session.getRevision();
  }

  private async ensureSessionOpened(): Promise<CadProjectSessionOpenResult> {
    if (!this.initialization) {
      this.initialization = this.session.open().catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  private snapshotDocument(): CadDocument {
    // Persist an ordinary serializable DTO, never a mutable reference owned by
    // the running application or any runtime/native object.
    return parseCadDocument(serializeCadDocument(this.application.getDocument()));
  }
}
