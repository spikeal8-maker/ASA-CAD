import type { CadDocumentKind } from '../contracts/document';

export type Workspace = 'solid' | 'sketch' | 'surfaces' | 'diagnostics' | 'view'
  | Exclude<CadDocumentKind, 'part'>;
export type SetWorkspace = (workspace: Workspace) => void;

export type CadWorkspacePanel = 'tree' | 'parameters' | 'tools' | 'closed';
export type PartSketchSelectionMode = 'none' | 'face' | 'edge';
