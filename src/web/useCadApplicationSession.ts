import { useEffect, useMemo, useState } from 'react';
import { CadApplicationImpl } from '../application/CadApplicationImpl';
import { BrowserPartRuntimeAdapter } from '../browser/BrowserPartRuntimeAdapter';
import { createEmptyCadDocument } from '../contracts/document';

/** The single document, runtime and history owner survives presentation changes. */
export function useCadApplicationSession() {
  const initialDocument = useMemo(() => createEmptyCadDocument('part', { title: 'Деталь 1' }), []);
  const runtime = useMemo(() => new BrowserPartRuntimeAdapter(), []);
  const app = useMemo(() => new CadApplicationImpl(initialDocument, runtime), [initialDocument, runtime]);
  const [revisionToken, setRevisionToken] = useState(0);
  useEffect(() => {
    const unsubscribe = app.subscribe(() => setRevisionToken(value => value + 1));
    return () => { unsubscribe(); app.dispose(); };
  }, [app]);
  return { initialDocument, runtime, app, revisionToken };
}
