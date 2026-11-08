import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cadPath, localCadEditorPath, unmountCadPath, type CadEditorMode } from '../../browser/editorModes';
import { parseCadClientRoute } from '../../browser/routes';
import { CadHistoryNavigation, CadHistoryStepper, type CadHistoryEntry, type CadLeaveGuard } from './CadHistoryNavigation';

interface Navigation {
  pathname: string;
  go(path: string): Promise<void>;
  registerGuard(guard: CadLeaveGuard): () => void;
}
interface BrowserNavigation {
  currentEntry: { key: string } | null;
  traverseTo(key: string): { finished: Promise<unknown> };
}
export const CadNavigationContext = createContext<Navigation | null>(null);

export function useCadNavigation(): Navigation {
  const [pathname, setPathname] = useState(() => unmountCadPath(window.location.pathname));
  const [session] = useState(() => {
    const browser = (window as Window & { navigation?: BrowserNavigation }).navigation;
    const read = (): CadHistoryEntry => ({
      pathname: unmountCadPath(window.location.pathname),
      index: Number.isSafeInteger(window.history.state?.asaCadIndex) ? window.history.state.asaCadIndex : 0,
      key: browser?.currentEntry?.key,
    });
    const stepper = new CadHistoryStepper(delta => window.history.go(delta));
    const controller = new CadHistoryNavigation({
      read, commit: setPathname,
      push(entry) { window.history.pushState({ asaCadIndex: entry.index }, '', cadPath(entry.pathname)); },
      async traverse(target) {
        // Absolute entry keys avoid relative-go races in browsers with the
        // Navigation API. An aborted traversal is reconciled from the real URL.
        if (browser && target.key) {
          try { await browser.traverseTo(target.key).finished; return; }
          catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
        }
        await stepper.traverse(target, read());
      },
    });
    return { controller, stepper, read };
  });
  useEffect(() => {
    let previous = session.read();
    window.history.replaceState({ ...window.history.state, asaCadIndex: previous.index }, '');
    const pop = () => {
      if (!Number.isSafeInteger(window.history.state?.asaCadIndex)) { window.location.reload(); return; }
      const entry = session.read();
      session.stepper.pop(previous, entry); previous = entry;
      session.controller.pop(entry);
    };
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('popstate', pop);
      session.controller.dispose(); session.stepper.dispose();
    };
  }, [session]);
  return {
    pathname,
    go: path => session.controller.go(path),
    registerGuard: guard => session.controller.registerGuard(guard),
  };
}

export function EditorNavigation(props: { dirty: boolean; save(): Promise<boolean>; cancelCommand(): void }) {
  const navigation = useContext(CadNavigationContext);
  const pending = useRef<{ resolve(allowed: boolean): void; decided: boolean } | null>(null);
  const busy = useRef(false), alive = useRef(false), state = useRef(props); state.current = props;
  const [prompt, setPrompt] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const decide = (allowed: boolean) => {
    if (!pending.current || pending.current.decided) return;
    pending.current.decided = true; busy.current = true; setSaving(true);
    pending.current.resolve(allowed);
  };
  useEffect(() => {
    if (!navigation) return;
    alive.current = true;
    const unbind = navigation.registerGuard({
      isDirty: () => state.current.dirty,
      confirmLeave: () => new Promise<boolean>(resolve => {
        pending.current = { resolve, decided: false };
        busy.current = false; setSaving(false); setError(''); setPrompt(true);
      }),
      settled() {
        pending.current = null; busy.current = false;
        if (alive.current) { setPrompt(false); setSaving(false); setError(''); }
      },
    });
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      alive.current = false; pending.current?.resolve(false); pending.current = null;
      unbind(); window.removeEventListener('beforeunload', unload);
    };
  }, []);
  if (!navigation) return null;
  const route = parseCadClientRoute(navigation.pathname), mode = route.kind === 'local-editor' ? route.mode : 'kompas';
  if (route.kind === 'dev-part' || route.kind === 'standalone') return null;
  const changeMode = (next: CadEditorMode) => {
    if (route.kind !== 'local-editor') return;
    props.cancelCommand(); void navigation.go(localCadEditorPath(next, route.projectId));
  };
  const save = async () => {
    if (busy.current || !pending.current) return;
    const request = pending.current;
    busy.current = true; setSaving(true); setError('');
    try {
      const saved = await state.current.save();
      if (!alive.current || pending.current !== request) return;
      if (saved) { decide(true); return; }
      setError('Сохранение не удалось. Проект остаётся открытым.');
    } catch (reason) {
      if (!alive.current || pending.current !== request) return;
      setError(String(reason));
    }
    busy.current = false; setSaving(false);
  };
  return <>
    <nav className="cad-launcher-nav" aria-label="Навигация ASA CAD">
      <button type="button" onClick={() => void navigation.go('/')}>← На главную</button><strong>ASA CAD</strong>
      {route.kind === 'local-editor' && <label>Редактор <select aria-label="Редактор" value={mode}
        onChange={event => changeMode(event.target.value as CadEditorMode)}>
        <option value="kompas">Компас</option><option value="fusion">Fusion</option></select></label>}
      <span>{route.kind === 'editor' ? 'Проект ASA Lab' : 'Сохраняется в этом браузере'}</span>
    </nav>
    {prompt && <LeaveDialog busy={saving} error={error} onSave={save}
      onDiscard={() => { if (!busy.current) decide(true); }} onStay={() => { if (!busy.current) decide(false); }} />}
  </>;
}

function LeaveDialog(props: { busy: boolean; error: string; onSave(): void; onDiscard(): void; onStay(): void }) {
  const dialog = useRef<HTMLDialogElement>(null), state = useRef(props); state.current = props;
  useLayoutEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal();
    const focusable = () => Array.from(element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      // CAD binds keys at document capture too; React bubbling alone is too late.
      event.stopImmediatePropagation();
      if (event.type !== 'keydown') return;
      if (event.key === 'Tab') {
        event.preventDefault();
        const items = focusable(), index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        (items[next] ?? element).focus();
      } else if (event.key === 'Escape') {
        event.preventDefault(); if (!state.current.busy) state.current.onStay();
      } else if (state.current.busy || event.ctrlKey || event.metaKey || event.altKey
        || !['Enter', ' '].includes(event.key) || !element.contains(document.activeElement)) event.preventDefault();
    };
    const focus = (event: FocusEvent) => {
      if (!element.contains(event.target as Node)) (focusable()[0] ?? element).focus();
    };
    for (const type of ['keydown', 'keyup', 'keypress'] as const) window.addEventListener(type, key, true);
    window.addEventListener('focusin', focus, true);
    return () => {
      for (const type of ['keydown', 'keyup', 'keypress'] as const) window.removeEventListener(type, key, true);
      window.removeEventListener('focusin', focus, true);
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useLayoutEffect(() => { if (props.busy) dialog.current?.focus(); }, [props.busy]);
  return createPortal(<dialog ref={dialog} tabIndex={-1} className="new-document-dialog launcher-project-dialog"
    aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description" aria-busy={props.busy}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!props.busy) props.onStay(); }}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onContextMenu={event => event.stopPropagation()}>
    <h2 id="leave-title">Сохранить изменения перед выходом?</h2>
    <p id="leave-description">Проект содержит несохранённые изменения.</p>
    {props.error && <p role="alert">{props.error}</p>}
    <div className="unsaved-changes-actions" style={{ marginTop: 20 }}>
      <button type="button" className="primary" disabled={props.busy} onClick={props.onSave}>Сохранить и выйти</button>
      <button type="button" disabled={props.busy} onClick={props.onDiscard}>Выйти без сохранения</button>
      <button type="button" disabled={props.busy} onClick={props.onStay}>Остаться</button>
    </div>
  </dialog>, document.body);
}
