import { useCallback } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadDocumentKind } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { findSketch, partDocument } from './PartSketchWorkspaceModel';
import type { CadWorkspacePanel, Workspace, SetWorkspace } from './PartSketchWorkspaceTypes';

interface PartWorkspaceNavigationOptions {
  app: CadApplication;
  setActiveCommand(command: string | null): void;
  setActiveWorkspace: SetWorkspace;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
  activateSketch(sketchId: CadSketchId): void;
  clearActiveSketch(): void;
  clearTransientSelection(): void;
  clearDimensionEdit(): void;
}

export function usePartWorkspaceNavigation(options: PartWorkspaceNavigationOptions) {
  const {
    app, setActiveCommand, setActiveWorkspace, setPanel, setNotice,
    activateSketch, clearActiveSketch, clearTransientSelection, clearDimensionEdit,
  } = options;

  const resetTransient = useCallback(() => {
    setActiveCommand(null);
    clearDimensionEdit();
    clearTransientSelection();
  }, [clearDimensionEdit, clearTransientSelection, setActiveCommand]);

  const resetToWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setActiveCommand(null);
    clearDimensionEdit();
    clearTransientSelection();
  }, [clearDimensionEdit, clearTransientSelection, setActiveCommand, setActiveWorkspace]);

  const resetForDocument = useCallback((kind: CadDocumentKind) => {
    clearActiveSketch();
    resetToWorkspace(kind === 'part' ? 'solid' : kind);
  }, [clearActiveSketch, resetToWorkspace]);

  const enterSketch = useCallback((sketchId: CadSketchId) => {
    const target = findSketch(partDocument(app.getDocument()), sketchId);
    if (!target) {
      setNotice('Эскиз больше не существует');
      clearActiveSketch();
      return;
    }
    activateSketch(sketchId);
    setActiveCommand(null);
    clearDimensionEdit();
    setPanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
    setNotice(`Открыт эскиз «${target.name}»`);
  }, [
    activateSketch, app, clearActiveSketch, clearDimensionEdit, clearTransientSelection,
    setActiveCommand, setActiveWorkspace, setNotice, setPanel,
  ]);

  return { resetTransient, resetToWorkspace, resetForDocument, enterSketch };
}
