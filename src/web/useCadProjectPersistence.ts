import { useMemo } from 'react';
import type { CadProjectHost } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import type { CadClientRoute } from '../browser/routes';
import { CadEditorPersistence, type CadPersistenceApplication } from '../host/CadEditorPersistence';
import { CadProjectSession } from '../host/CadProjectSession';
import {
  IndexedDbCadRecoveryStore,
  MemoryCadRecoveryStore,
  type CadRecoveryStore,
} from '../host/CadRecoveryStore';
import { LocalStorageCadProjectHost } from '../host/LocalStorageCadProjectHost';

export interface CadProjectPersistenceOverrides {
  projectHost?: CadProjectHost;
  recoveryStore?: CadRecoveryStore;
  projectKey?: string;
}

export function useCadProjectPersistence(
  application: CadPersistenceApplication,
  initialDocument: CadDocument,
  route: CadClientRoute,
  overrides: CadProjectPersistenceOverrides,
): CadEditorPersistence {
  const standaloneHost = useMemo(
    () => overrides.projectHost ? null : new LocalStorageCadProjectHost({ initialDocument }),
    [initialDocument, overrides.projectHost],
  );
  const host = overrides.projectHost ?? standaloneHost!;
  const recovery = useMemo<CadRecoveryStore>(
    () => overrides.recoveryStore ?? (
      typeof globalThis.indexedDB !== 'undefined'
        ? new IndexedDbCadRecoveryStore()
        : new MemoryCadRecoveryStore()
    ),
    [overrides.recoveryStore],
  );
  const projectKey = overrides.projectKey ?? (
    route.kind === 'editor'
      ? `asa-cad:${route.projectId}`
      : route.kind === 'dev-part'
        ? `asa-cad:dev:${route.fixture}`
        : 'asa-cad:standalone'
  );
  const session = useMemo(
    () => new CadProjectSession({ projectKey, host, recovery }),
    [host, projectKey, recovery],
  );

  return useMemo(
    () => new CadEditorPersistence(application, session, standaloneHost ?? undefined),
    [application, session, standaloneHost],
  );
}
