export const ASA_CAD_MOUNT_PATH = '/cad' as const;

export const CAD_PART_DEV_FIXTURE_NAMES = [
  'empty',
  'sketch',
  'line',
  'circle',
  'extrude',
  'reference',
  'rebuild-error',
] as const;

export type CadPartDevFixtureName = typeof CAD_PART_DEV_FIXTURE_NAMES[number];

export type CadClientRoute =
  | { kind: 'editor'; projectId: string }
  | { kind: 'viewer'; versionId: string }
  | { kind: 'dev-part'; fixture: CadPartDevFixtureName }
  | { kind: 'standalone' }
  | { kind: 'unknown'; pathname: string };

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
  if (normalized === '/' || normalized === ASA_CAD_MOUNT_PATH) return { kind: 'standalone' };

  const devPart = normalized.match(/^\/dev\/part\/([^/]+)$/);
  if (devPart) {
    const fixture = partDevFixture(decodeURIComponent(devPart[1]));
    if (fixture) return { kind: 'dev-part', fixture };
  }

  const mountedDevPart = normalized.match(/^\/cad\/dev\/part\/([^/]+)$/);
  if (mountedDevPart) {
    const fixture = partDevFixture(decodeURIComponent(mountedDevPart[1]));
    if (fixture) return { kind: 'dev-part', fixture };
  }

  const editor = normalized.match(/^\/cad\/projects\/([^/]+)$/);
  if (editor) return { kind: 'editor', projectId: decodeURIComponent(editor[1]) };

  const viewer = normalized.match(/^\/cad\/view\/([^/]+)$/);
  if (viewer) return { kind: 'viewer', versionId: decodeURIComponent(viewer[1]) };

  return { kind: 'unknown', pathname: normalized };
}
