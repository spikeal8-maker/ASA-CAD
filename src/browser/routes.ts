export const ASA_CAD_MOUNT_PATH = '/cad' as const;

export type CadClientRoute =
  | { kind: 'editor'; projectId: string }
  | { kind: 'viewer'; versionId: string }
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

export function parseCadClientRoute(pathname: string): CadClientRoute {
  const normalized = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (normalized === '/' || normalized === ASA_CAD_MOUNT_PATH) return { kind: 'standalone' };

  const editor = normalized.match(/^\/cad\/projects\/([^/]+)$/);
  if (editor) return { kind: 'editor', projectId: decodeURIComponent(editor[1]) };

  const viewer = normalized.match(/^\/cad\/view\/([^/]+)$/);
  if (viewer) return { kind: 'viewer', versionId: decodeURIComponent(viewer[1]) };

  return { kind: 'unknown', pathname: normalized };
}
