import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';
import type { Workspace } from './CadWorkspaceTypes';
import { KompasTop } from './kompas/KompasTop';
import { CadShellTop as FusionTop } from './fusion/LiveTop';
import { useEditorMode } from './EditorMode';

export type CadWorkspaceId = Workspace;

export interface CadShellTopProps {
  documentKind: CadDocumentKind; documentTitle: string; dirty: boolean;
  activeWorkspace: CadWorkspaceId; setActiveWorkspace: (workspace: CadWorkspaceId) => void;
  search: string; setSearch: (value: string) => void; searchableActions: CadUiAction[];
  getAction: (id: string) => CadUiAction;
  showRoadmapCommands: boolean;
  rectangleReady: boolean; rectangleWidth: number; rectangleHeight: number;
  circleReady: boolean; circleDiameter: number; viewName: string;
}

/** One product shell on every viewport; its layout adapts without swapping CAD UI implementations. */
export function CadShellTop(props: CadShellTopProps) {
  return useEditorMode() === 'fusion' ? <FusionTop {...props} /> : <KompasTop {...props} />;
}
