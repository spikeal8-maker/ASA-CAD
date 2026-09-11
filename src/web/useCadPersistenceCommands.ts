import { useCallback } from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadEditorPersistence } from '../host/CadEditorPersistence';

export interface CadPersistenceCommandOptions {
  persistence: CadEditorPersistence;
  remoteHost: boolean;
  setNotice(message: string): void;
  onOpened(kind: CadDocumentKind): void;
}

export function useCadPersistenceCommands(options: CadPersistenceCommandOptions) {
  const save = useCallback(async () => {
    try {
      await options.persistence.save();
      options.setNotice(options.remoteHost ? 'Сохранено' : 'Сохранено локально');
    } catch (error) {
      options.setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [options.persistence, options.remoteHost, options.setNotice]);

  const open = useCallback(async () => {
    try {
      if (!(await options.persistence.hasPersistedDocument())) {
        options.setNotice('Нет локально сохраненного документа');
        return;
      }
      options.setNotice('Открытие документа…');
      const result = await options.persistence.open();
      options.onOpened(result.document.kind);
      options.setNotice(options.remoteHost ? 'Документ открыт' : 'Локальный документ открыт');
    } catch (error) {
      options.setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [options.onOpened, options.persistence, options.remoteHost, options.setNotice]);

  return { save, open };
}
