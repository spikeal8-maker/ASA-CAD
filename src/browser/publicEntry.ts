import type { CadApplication, CadProjectHost } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import type { CadBrowserCapabilityResult } from './capabilities';

export interface CadEditorMountOptions {
  projectId?: string;
  host: CadProjectHost;
  readOnly?: boolean;
  assignmentContext?: Record<string, unknown>;
}

export interface CadViewerMountOptions {
  document: CadDocument;
  readOnly: true;
  versionId?: string;
}

export interface CadMountedSurface {
  dispose(): void;
}

/**
 * Public browser entry contract that M2 implements visually. Hosts know only
 * this ASA surface and never import vendor React/store/kernel code.
 */
export interface CadEditorEntry {
  capabilities(): CadBrowserCapabilityResult;
  mount(element: HTMLElement, options: CadEditorMountOptions): Promise<CadMountedSurface>;
}

export interface CadViewerEntry {
  capabilities(): CadBrowserCapabilityResult;
  mount(element: HTMLElement, options: CadViewerMountOptions): Promise<CadMountedSurface>;
}

export interface CadEditorSessionContext {
  application: CadApplication;
  projectId?: string;
  revision: number;
  readOnly: boolean;
}
