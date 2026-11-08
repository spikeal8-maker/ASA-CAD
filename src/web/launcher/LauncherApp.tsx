import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CAD_MODES, localCadEditorPath, type CadEditorMode, type CadLaunchMode } from '../../browser/editorModes';
import { parseCadClientRoute, type CadClientRoute } from '../../browser/routes';
import { LocalCadProjects, localCadProjectRecoveryKey, type LocalCadProject } from '../../host/LocalCadProjects';
import { AsaLabCadProjectHost } from '../../host/AsaLabCadProjectHost';
import { EditorModeContext } from '../EditorMode';
import { useUiScaleSettingsOpen } from '../UiScaleSettings';
import { LauncherPage } from './LauncherPage';
import { ProjectDialog } from './ProjectDialog';
import { CadNavigationContext, useCadNavigation } from './CadNavigation';
import { downloadLocalCadBackup } from './backup';
import './editor-navigation.css';

const Editor = lazy(() => import('../App').then(module => ({ default: module.App })));

export function LauncherApp() {
  const navigation = useCadNavigation(), settings = useUiScaleSettingsOpen();
  const catalog = useMemo(() => new LocalCadProjects(), []);
  const route = parseCadClientRoute(navigation.pathname);
  const [recent, setRecent] = useState<LocalCadProject[]>([]), [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'new' | 'open'; mode: CadEditorMode } | null>(null);
  const refresh = () => {
    try {
      const unreadable: string[] = [];
      setRecent(catalog.list(id => unreadable.push(id)));
      setError(unreadable.length
        ? `Не удалось прочитать проектов: ${unreadable.length}. Остальные доступны. Скачайте резервную копию, чтобы сохранить исходные данные.` : '');
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  useEffect(() => {
    document.title = route.kind === 'launcher' ? 'ASA CAD — Выбор редактора' : 'ASA CAD — Редактор';
    if (route.kind === 'launcher') refresh();
  }, [navigation.pathname]);
  useEffect(() => {
    const update = () => { if (parseCadClientRoute(navigation.pathname).kind === 'launcher') refresh(); };
    window.addEventListener('storage', update); window.addEventListener('focus', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update); };
  }, [navigation.pathname]);
  const launch = (kind: 'new' | 'open', mode: CadLaunchMode) => {
    if (mode === 'vassalite') { setError('Vassalite недоступен: исходники редактора отсутствуют в ASA-CAD.'); return; }
    refresh(); setDialog({ kind, mode });
  };
  const open = (id: string, mode: CadEditorMode) => {
    setDialog(null); void navigation.go(localCadEditorPath(mode, id));
  };
  const create = (title: string) => {
    if (!dialog) return;
    try { open(catalog.create(dialog.mode, title), dialog.mode); }
    catch (reason) { setError(String(reason)); setDialog(null); }
  };
  const identity = route.kind === 'local-editor' ? `local:${route.projectId}`
    : route.kind === 'editor' ? `server:${route.projectId}` : navigation.pathname;
  return <CadNavigationContext.Provider value={navigation}>
    {route.kind === 'launcher' ? <LauncherPage modes={CAD_MODES} recent={recent} error={error}
      onCreate={mode => launch('new', mode)} onOpen={mode => launch('open', mode)} onContinue={open}
      onSettings={settings} onBackup={() => {
        void downloadLocalCadBackup(catalog).then(result => setError(result.complete
          ? '' : `Создана частичная резервная копия: ${result.errors.map(error => error.message).join('; ')}`))
          .catch(reason => setError(`Резервная копия не создана: ${String(reason)}`));
      }} />
      : route.kind === 'unknown' ? <Unavailable title="Страница не найдена" onHome={() => void navigation.go('/')} />
      : route.kind === 'viewer' ? <Unavailable title="Просмотр опубликованной версии пока не подключён"
        detail="Этот адрес сохранён для интеграции с ASA Lab. Редактируемый локальный проект вместо версии не открывается."
        onHome={() => void navigation.go('/')} />
      : <EditorBoundary key={identity} onHome={() => void navigation.go('/')}>
        <ProjectEditor key={identity} route={route} catalog={catalog} />
      </EditorBoundary>}
    {dialog && <ProjectDialog {...dialog} projects={recent} onCreate={create}
      onOpen={id => open(id, dialog.mode)} onClose={() => setDialog(null)} />}
  </CadNavigationContext.Provider>;
}

function ProjectEditor({ route, catalog }: { route: CadClientRoute; catalog: LocalCadProjects }) {
  const mode = route.kind === 'local-editor' ? route.mode : 'kompas';
  const modeRef = useRef(mode); modeRef.current = mode;
  const projectId = route.kind === 'local-editor' || route.kind === 'editor' ? route.projectId : null;
  // Presentation changes keep this host, App instance, CadDocument and Undo history alive.
  const host = useMemo(() => route.kind === 'local-editor' ? catalog.host(route.projectId, () => modeRef.current)
    : route.kind === 'editor' ? new AsaLabCadProjectHost({ projectId: route.projectId }) : undefined,
  [projectId]);
  return <div className="asa-editor-root" data-mode={mode}>
    <EditorModeContext.Provider value={mode}>
      <Suspense fallback={<div className="cad-startup" role="status">Загрузка редактора…</div>}>
        <Editor projectHost={host} autoOpen={!!host}
          projectKey={route.kind === 'local-editor' ? localCadProjectRecoveryKey(route.projectId)
            : projectId ? `asa-cad:${projectId}` : undefined} />
      </Suspense>
    </EditorModeContext.Provider>
  </div>;
}

function Unavailable(props: { title: string; detail?: string; onHome(): void }) {
  return <main className="cad-startup"><h1>{props.title}</h1>{props.detail && <p>{props.detail}</p>}
    <button type="button" onClick={props.onHome}>На главную</button></main>;
}

class EditorBoundary extends React.Component<React.PropsWithChildren<{ onHome(): void }>, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error
    ? <Unavailable title="Проект не удалось открыть" detail={this.state.error} onHome={this.props.onHome} /> : this.props.children; }
}
