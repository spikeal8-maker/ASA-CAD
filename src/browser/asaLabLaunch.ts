const ASA_LAB_ORIGIN = 'https://asa-lab.ru';

/** ASA Lab owns account identity and project creation. No cross-origin credential transfer. */
export function asaLabProjectsUrl(): string {
  return `${ASA_LAB_ORIGIN}/#/projects?kind=personal&filter=three-d`;
}

export function asaLabAccountUrl(): string { return `${ASA_LAB_ORIGIN}/#/account`; }

export function asaLabThreeDEditorUrl(projectId: string): string {
  if (!projectId || projectId.length > 200) throw new Error('Нужен идентификатор проекта ASA Lab');
  const returnTo = encodeURIComponent('/projects?kind=personal&filter=three-d');
  return `${ASA_LAB_ORIGIN}/#/3d/${encodeURIComponent(projectId)}?returnTo=${returnTo}`;
}

/** Keep the CAD document and launcher available in their original tab. */
export function openAsaLabProjects(): void {
  window.open(asaLabProjectsUrl(), '_blank', 'noopener,noreferrer');
}
