import { useContext, useEffect, useRef, useState } from 'react';
import { CadNavigationContext } from './CadNavigation';

export type EditorStartupStatus = 'loading' | 'ready' | 'error';

/** No editor controls are mounted until the stored document has replaced the initial DTO. */
export function useEditorStartup(enabled: boolean | undefined, openDocument: () => Promise<boolean>) {
  const [status, setStatus] = useState<EditorStartupStatus>(enabled ? 'loading' : 'ready');
  const opening = useRef<Promise<boolean> | null>(null), open = useRef(openDocument);
  open.current = openDocument;
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    opening.current ??= open.current();
    void opening.current.then(ok => { if (mounted) setStatus(ok ? 'ready' : 'error'); })
      .catch(() => { if (mounted) setStatus('error'); });
    return () => { mounted = false; };
  }, [enabled]);
  return status;
}

export function EditorStartup({ status }: { status: Exclude<EditorStartupStatus, 'ready'> }) {
  const navigation = useContext(CadNavigationContext);
  return <div className="cad-startup" role={status === 'loading' ? 'status' : 'alert'}>
    <h2>{status === 'loading' ? 'Открываем проект…' : 'Не удалось открыть проект'}</h2>
    {status === 'error' && <><p>Исходные данные не изменены. Проверьте доступ и вернитесь к списку проектов.</p>
      <button type="button" onClick={() => void navigation?.go('/')}>На главную</button></>}
  </div>;
}
