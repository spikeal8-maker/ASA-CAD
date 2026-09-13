import { useCallback, useState } from 'react';
import type { CadPartDocument } from '../contracts/document';
import type { CadBodyId, CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';
import type { PartSketchSelectionMode } from './PartSketchWorkspaceTypes';

export interface PartSelectionControllerOptions {
  part: Readonly<CadPartDocument> | null;
  activeSketchId: CadSketchId | null;
  clearSketchEntitySelection(): void;
  selectSketchEntity(sketchId: CadSketchId, entityId: CadSketchEntityId): void;
  setNotice(message: string): void;
}

export function usePartSelectionController(options: PartSelectionControllerOptions) {
  const {
    part,
    activeSketchId,
    clearSketchEntitySelection,
    selectSketchEntity,
    setNotice,
  } = options;
  const [selectionMode, setSelectionMode] = useState<PartSketchSelectionMode>('none');
  const [selectedPick, setSelectedPick] = useState<CadViewportPick | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<CadBodyId | null>(null);

  const selectedPointText = selectedPick
    ? selectedPick.point.map((value) => Number(value).toFixed(2)).join(', ')
    : '';
  const selectedBody = selectedBodyId && part
    ? part.bodies.find((body) => body.id === selectedBodyId) ?? null
    : null;

  const clearTransientSelection = useCallback(() => {
    setSelectionMode('none');
    setSelectedPick(null);
    setSelectedBodyId(null);
    clearSketchEntitySelection();
  }, [clearSketchEntitySelection]);

  const clearSelectedPick = useCallback(() => {
    setSelectedPick(null);
  }, []);

  const beginPartSelection = useCallback((mode: PartSketchSelectionMode) => {
    setSelectionMode(mode);
    setSelectedPick(null);
    setSelectedBodyId(null);
    clearSketchEntitySelection();
  }, [clearSketchEntitySelection]);

  const handleViewportPick = useCallback((pick: CadViewportPick) => {
    clearSketchEntitySelection();
    setSelectedPick(pick);
    if (pick.kind === 'face') {
      setNotice(`Грань выбрана: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    } else {
      setNotice(`Ребро выбрано: ${pick.point.map((value) => value.toFixed(1)).join(', ')}`);
    }
  }, [clearSketchEntitySelection, setNotice]);

  const handleBodySelect = useCallback((bodyId: CadBodyId | null) => {
    clearSketchEntitySelection();
    setSelectedBodyId(bodyId);
    setSelectedPick(null);
    setNotice(bodyId ? 'Тело выбрано' : 'Выбор очищен');
  }, [clearSketchEntitySelection, setNotice]);

  const handleSketchEntitySelect = useCallback((entityId: CadSketchEntityId) => {
    if (!activeSketchId) return;
    setSelectionMode('none');
    setSelectedPick(null);
    setSelectedBodyId(null);
    selectSketchEntity(activeSketchId, entityId);
    setNotice('Элемент эскиза выбран');
  }, [activeSketchId, selectSketchEntity, setNotice]);

  return {
    selectionMode,
    selectedPick,
    selectedBodyId,
    selectedPointText,
    selectedBody,
    clearTransientSelection,
    clearSelectedPick,
    beginPartSelection,
    handleViewportPick,
    handleBodySelect,
    handleSketchEntitySelect,
  };
}
