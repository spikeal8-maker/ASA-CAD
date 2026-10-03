import { useCallback, useState } from 'react';
import type { CadPlaneName } from '../contracts/commands';
import type { CadBodyId } from '../contracts/ids';
import type { CadViewportPick } from '../contracts/render';

export interface PartSelectionTarget {
  pick?: CadViewportPick;
  bodyId?: CadBodyId | null;
  plane?: CadPlaneName;
}

/**
 * Mutually exclusive Part selection targets: a command B-Rep pick, a body or a
 * document origin plane. Selecting one replaces the others and any Sketch
 * entity selection, so scene, tree and parameters read one state.
 */
export function usePartSelectionTargets(clearSketchEntitySelection: () => void) {
  const [selectedPick, setSelectedPick] = useState<CadViewportPick | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<CadBodyId | null>(null);
  const [selectedPlane, setSelectedPlane] = useState<CadPlaneName | null>(null);

  const select = useCallback((target: PartSelectionTarget) => {
    clearSketchEntitySelection();
    setSelectedPick(target.pick ?? null);
    setSelectedBodyId(target.bodyId ?? null);
    setSelectedPlane(target.plane ?? null);
  }, [clearSketchEntitySelection]);

  return { selectedPick, setSelectedPick, selectedBodyId, setSelectedBodyId, selectedPlane, select };
}
