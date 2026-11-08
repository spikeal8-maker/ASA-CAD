import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CAD_MODES, localCadEditorPath, type CadEditorMode, type CadLaunchMode } from '../../browser/editorModes';
import { asaLabAccountUrl, asaLabProjectsUrl } from '../../browser/asaLabLaunch';
import { parseCadClientRoute, type CadClientRoute } from '../../browser/routes';
import { LocalCadProjects, type LocalCadProject } from '../../host/LocalCadProjects';
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
  const [external, setExternal] = useState<'new' | 'open' | null>(null);
  const refresh = () => {
    try { setRecent(catalog.list()); setError(''); }
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
    if (mode === 'blocks3d') { setExternal(kind); return; }
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
      onSettings={settings} accountHref={asaLabAccountUrl()} onBackup={() => {
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
    {external && <div className="modal-backdrop" role="presentation">
      <section className="new-document-dialog launcher-project-dialog" role="dialog" aria-modal="true"
        aria-labelledby="external-title" onKeyDown={event => { if (event.key === 'Escape') setExternal(null); }}>
        <h2 id="external-title">3D-конструктор ASA Lab</h2>
        <p>Редактор откроется в отдельной вкладке. {external === 'new'
          ? 'В ASA Lab нажмите «Создать» и выберите «3D модель».'
          : 'Выберите свою 3D-модель в списке проектов.'} Если потребуется, войдите в свой аккаунт.</p>
        <p>Модели сохраняются в ASA Lab. Главная ASA CAD останется в этой вкладке. Документы Компаса и Fusion автоматически не конвертируются.</p>
        <footer><button type="button" onClick={() => setExternal(null)}>Отмена</button>
          <a className="primary" href={asaLabProjectsUrl()} target="_blank" rel="noopener noreferrer"
            onClick={() => setExternal(null)}>Открыть ASA Lab</a></footer>
      </section>
    </div>}
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
          projectKey={projectId ? `asa-cad:${route.kind === 'local-editor' ? 'local:' : ''}${projectId}` : undefined} />
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
