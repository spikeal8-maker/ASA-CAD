export type CadEditorMode = 'kompas' | 'fusion';
export type CadLaunchMode = CadEditorMode | 'vassalite';

export interface CadModeDefinition {
  id: CadLaunchMode;
  title: string;
  description: string;
  available: boolean;
  external: boolean;
  connection: 'local' | 'unavailable';
  projectType: 'cad-document' | 'three-d';
  saving: 'local-revision' | 'unavailable';
  operations: readonly string[];
  status: string;
  launch: { kind: 'local'; projectPath(projectId: string): string }
    | { kind: 'unavailable' };
  returnHome: 'guarded-home-route' | 'retained-launcher-tab';
}

export const CAD_MODES: readonly CadModeDefinition[] = [
  { id: 'kompas', title: 'Компас', description: 'Инженерное параметрическое моделирование',
    available: true, external: false, connection: 'local', projectType: 'cad-document',
    saving: 'local-revision', operations: ['sketch', 'dimensions', 'extrude', 'save', 'undo'],
    status: 'Локальные проекты · без регистрации',
    launch: { kind: 'local', projectPath: id => localCadEditorPath('kompas', id) }, returnHome: 'guarded-home-route' },
  { id: 'fusion', title: 'Fusion', description: 'Параметрическое 3D-моделирование',
    available: true, external: false, connection: 'local', projectType: 'cad-document',
    saving: 'local-revision', operations: ['sketch', 'dimensions', 'extrude', 'save', 'undo'],
    status: 'Локальные проекты · без регистрации',
    launch: { kind: 'local', projectPath: id => localCadEditorPath('fusion', id) }, returnHome: 'guarded-home-route' },
  { id: 'vassalite', title: 'Vassalite', description: 'Отдельный CAD-редактор ASA-CAD',
    available: false, external: false, connection: 'unavailable', projectType: 'cad-document',
    saving: 'unavailable', operations: [],
    status: 'Недоступен: исходники Vassalite отсутствуют в ASA-CAD',
    launch: { kind: 'unavailable' }, returnHome: 'guarded-home-route' },
];

export const CAD_LAUNCHER_PATH = '/';

export function localCadEditorPath(mode: CadEditorMode, projectId: string): string {
  if (!isLocalCadProjectId(projectId)) throw new Error('Некорректный идентификатор локального проекта');
  return `/cad/${mode}/${encodeURIComponent(projectId)}`;
}

export function isLocalCadProjectId(value: string): boolean {
  return value === 'legacy' || /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);
}

/** Candidate packages may be inspected beside an installed build without replacing its root. */
export function cadBasePath(): string {
  const value = document.querySelector<HTMLMetaElement>('meta[name="asa-cad-base"]')?.content ?? '';
  return /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(value) ? value.replace(/\/$/, '') : '';
}

export function cadPath(path: string): string { return `${cadBasePath()}${path}`; }
export function unmountCadPath(pathname: string): string {
  const base = cadBasePath();
  return base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/' : pathname;
}
