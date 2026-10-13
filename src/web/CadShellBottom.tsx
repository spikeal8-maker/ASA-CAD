import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadShellPanel } from './CadShellMain';
import { KompasToast } from './kompas/KompasToast';
import { KompasMobileNavigation } from './kompas/KompasMobileNavigation';

interface CadShellBottomProps {
  recomputeStatus: string;
  notice: string;
  devFixture?: string | null;
  selectedPickKind?: 'face' | 'edge';
  selectedPointText?: string;
  selectedBodyName?: string;
  selectedSketchEntityId?: string | null;
  documentKind: CadDocumentKind;
  runtimeStatus: string;
  activePanel: CadShellPanel;
  setActivePanel: (panel: CadShellPanel) => void;
}

/** New KOMPAS status/toast and its compact command-navigation controls. */
export function CadShellBottom(props: CadShellBottomProps) {
  return (
    <>
      <KompasToast notice={props.notice} />
      <KompasMobileNavigation activePanel={props.activePanel} setActivePanel={props.setActivePanel} />
    </>
  );
}
