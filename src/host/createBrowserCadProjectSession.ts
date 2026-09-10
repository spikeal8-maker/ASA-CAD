import type { CadDocument } from '../contracts/document';
import { CadProjectSession } from './CadProjectSession';
import { IndexedDbCadRecoveryStore } from './CadRecoveryStore';
import { LocalStorageCadProjectHost } from './LocalStorageCadProjectHost';

export interface BrowserCadProjectSessionBundle {
  projectKey: string;
  host: LocalStorageCadProjectHost;
  session: CadProjectSession;
}

/**
 * Current standalone M2 composition. M5 replaces only the host implementation
 * with AsaLabCadProjectHost; editor/application code keeps the same session API.
 */
export function createBrowserCadProjectSession(
  projectKey: string,
  initialDocument: CadDocument,
): BrowserCadProjectSessionBundle {
  const host = new LocalStorageCadProjectHost(projectKey, initialDocument);
  const recovery = new IndexedDbCadRecoveryStore(globalThis.indexedDB, 'asa-cad-recovery', 'projects');
  return {
    projectKey,
    host,
    session: new CadProjectSession({ projectKey, host, recovery }),
  };
}
