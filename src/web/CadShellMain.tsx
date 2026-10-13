import React from 'react';
import { KompasMain } from './kompas/KompasMain';

export type CadShellPanel = 'tree' | 'parameters' | 'tools' | 'closed';

export interface CadShellMainProps {
  activePanel: CadShellPanel;
  setActivePanel: (panel: CadShellPanel) => void;
  requestView: (label: string) => void;
  viewName: string;
  selectionMode: 'none' | 'face' | 'edge';
  selectedBodyName?: string;
  selectedSketchEntityId?: string | null;
  activeCommand?: string | null;
  commitActiveCommand: () => void | Promise<void>;
  cancelCommand: () => void;
  treeContent: React.ReactNode;
  parametersContent: React.ReactNode;
  toolsContent: React.ReactNode;
  modelContent: React.ReactNode;
}

/** The KOMPAS #170 composition is canonical on desktop, tablet and phone. */
export function CadShellMain(props: CadShellMainProps) {
  return <KompasMain {...props} />;
}
