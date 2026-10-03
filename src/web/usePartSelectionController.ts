import { useCallback, useState } from 'react';
import type { CadPlaneName } from '../contracts/commands';
import type { CadPartDocument } from '../contracts/document';
import type { CadBodyId, CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import type { PartSketchSelectionMode } from './PartSketchWorkspaceTypes';
import { usePartSelectionTargets } from './usePartSelectionTargets';

export interface PartSelectionControllerOptions {
  part: Readonly<CadPartDocument> | null;
  activeSketchId: CadSketchId | null;
  clearSketchEntitySelection(): void;
  selectSketchEntity(sketchId: CadSketchId, entityId: CadSketchEntityId): void;
  setNotice(message: string): void;
}

export function usePartSelectionController(options: PartSelectionControllerOptions) {
  const { part, activeSketchId, clearSketchEntitySelection, selectSketchEntity, setNotice } = options;
  const [selectionMode, setSelectionMode] = useState<PartSketchSelectionMode>('none');
  const { selectedPick, setSelectedPick, selectedBodyId, setSelectedBodyId, selectedPlane, select } =
    usePartSelectionTargets(clearSketchEntitySelection);

  const selectedPointText = selectedPick ? selectedPick.point.map((value) => Number(value).toFixed(2)).join(', ') : '';
  const selectedBody = selectedBodyId && part ? part.bodies.find((body) => body.id === selectedBodyId) ?? null : null;

  const clearTransientSelection = useCallback(() => {
    setSelectionMode('none');
    select({});
  }, [select]);

  const clearSelectedPick = useCallback(() => setSelectedPick(null), []);

  // Keeps a selected origin plane: it is the Sketch support (select, then command).
  const beginPartSelection = useCallback((mode: PartSketchSelectionMode) => {
    setSelectionMode(mode);
    setSelectedPick(null);
    setSelectedBodyId(null);
    clearSketchEntitySelection();
  }, [clearSketchEntitySelection]); // state setters are stable

  const handleViewportPick = useCallback((pick: CadViewportPick) => {
    select({ pick });
    setNotice(`${pick.kind === 'face' ? 'Грань выбрана' : 'Ребро выбрано'}: ${pick.point.map((v) => v.toFixed(1)).join(', ')}`);
  }, [select, setNotice]);

  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    select({ bodyId });
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, [select, setNotice]);

  const selectBasePlane = useCallback((plane: CadPlaneName) => {
    select({ plane });
    setNotice(`Плоскость ${plane} выбрана`);
  }, [select, setNotice]);

  const handleSketchEntitySelect = useCallback((entityId: CadSketchEntityId) => {
    if (!activeSketchId) return;
    setSelectionMode('none');
    select({});
    selectSketchEntity(activeSketchId, entityId);
    setNotice('Элемент эскиза выбран');
  }, [activeSketchId, select, selectSketchEntity, setNotice]);

  return {
    selectionMode, selectedPick, selectedBodyId, selectedPlane, selectedPointText, selectedBody,
    clearTransientSelection, clearSelectedPick, beginPartSelection,
    handleViewportPick, handleBodySelect, selectBasePlane, handleSketchEntitySelect,
  };
}
