import { isLocalCadProjectId, unmountCadPath, type CadEditorMode } from './editorModes';
export const ASA_CAD_MOUNT_PATH = '/cad' as const;

export const CAD_PART_DEV_FIXTURE_NAMES = [
  'empty',
  'sketch',
  'line',
  'circle',
  'arc',
  'rectangle',
  'extrude',
  'reference',
  'rebuild-error',
] as const;

export type CadPartDevFixtureName = typeof CAD_PART_DEV_FIXTURE_NAMES[number];

export type CadClientRoute =
  | { kind: 'launcher' }
  | { kind: 'local-editor'; mode: CadEditorMode; projectId: string }
  | { kind: 'editor'; projectId: string }
  | { kind: 'viewer'; versionId: string }
  | { kind: 'dev-part'; fixture: CadPartDevFixtureName }
  | { kind: 'standalone' }
  | { kind: 'unknown'; pathname: string };

/** Shared initial route for root deployments and explicitly mounted candidate previews. */
export function currentCadClientRoute(): CadClientRoute {
  return parseCadClientRoute(unmountCadPath(window.location.pathname));
}

export function cadEditorPath(projectId: string): string {
  if (!projectId) throw new Error('projectId is required');
  return `${ASA_CAD_MOUNT_PATH}/projects/${encodeURIComponent(projectId)}`;
}

export function cadViewerPath(versionId: string): string {
  if (!versionId) throw new Error('versionId is required');
  return `${ASA_CAD_MOUNT_PATH}/view/${encodeURIComponent(versionId)}`;
}

export function cadPartDevFixturePath(fixture: CadPartDevFixtureName): string {
  return `/dev/part/${fixture}`;
}

function partDevFixture(value: string): CadPartDevFixtureName | null {
  return (CAD_PART_DEV_FIXTURE_NAMES as readonly string[]).includes(value)
    ? value as CadPartDevFixtureName
    : null;
}

export function parseCadClientRoute(pathname: string): CadClientRoute {
  const normalized = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (normalized === '/') return { kind: 'launcher' };
  if (normalized === ASA_CAD_MOUNT_PATH) return { kind: 'standalone' };

  const local = normalized.match(/^\/cad\/(kompas|fusion)\/([^/]+)$/);
  if (local) {
    const projectId = decodeRouteSegment(local[2]);
    if (projectId && isLocalCadProjectId(projectId)) return {
      kind: 'local-editor', mode: local[1] as CadEditorMode, projectId,
    };
    return { kind: 'unknown', pathname: normalized };
  }

  const devPart = normalized.match(/^\/dev\/part\/([^/]+)$/);
  if (devPart) {
    const fixture = partDevFixture(decodeRouteSegment(devPart[1]) ?? '');
    if (fixture) return { kind: 'dev-part', fixture };
  }

  const mountedDevPart = normalized.match(/^\/cad\/dev\/part\/([^/]+)$/);
  if (mountedDevPart) {
    const fixture = partDevFixture(decodeRouteSegment(mountedDevPart[1]) ?? '');
    if (fixture) return { kind: 'dev-part', fixture };
  }

  const editor = normalized.match(/^\/cad\/projects\/([^/]+)$/);
  if (editor && decodeRouteSegment(editor[1])) return { kind: 'editor', projectId: decodeRouteSegment(editor[1])! };

  const viewer = normalized.match(/^\/cad\/view\/([^/]+)$/);
  if (viewer && decodeRouteSegment(viewer[1])) return { kind: 'viewer', versionId: decodeRouteSegment(viewer[1])! };

  return { kind: 'unknown', pathname: normalized };
}

function decodeRouteSegment(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
