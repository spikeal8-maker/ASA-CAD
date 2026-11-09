import { useEffect, useRef, useState } from 'react';
import type { CadPlaneName } from '../../contracts/commands';
import type { CadViewportPick } from '../../contracts/render';

/**
 * Fusion alone: selecting a support completes the existing Sketch Create action.
 * Keep support selection in the shared Part controller; never create a second CAD
 * document, fake sketch entity, or bypass application command validation.
 */
type PendingSupport =
  | { kind: 'plane'; plane: CadPlaneName; sequence: number }
  | { kind: 'face'; featureId: string; point: string; sequence: number };

interface SketchStartOptions {
  activeCommand: string | null;
  selectedPlane: CadPlaneName | null;
  selectedPick: CadViewportPick | null;
  commitCreateSketch?: (() => void | Promise<void>) | null;
}

export function useFusionSketchAutoCreate(options: SketchStartOptions) {
  const { activeCommand, selectedPlane, selectedPick, commitCreateSketch } = options;
  const nextSequence = useRef(0);
  const committing = useRef(false);
  const [pending, setPending] = useState<PendingSupport | null>(null);

  function planeSelected(plane: CadPlaneName) {
    if (activeCommand !== 'part.sketch.create') return;
    setPending({ kind: 'plane', plane, sequence: ++nextSequence.current });
  }

  function faceSelected(pick: CadViewportPick) {
    if (activeCommand !== 'part.sketch.create' || pick.kind !== 'face' || !pick.sourceFeatureId) return;
    setPending({
      kind: 'face', featureId: pick.sourceFeatureId,
      point: pick.point.join(','), sequence: ++nextSequence.current,
    });
  }

  // An old click must never complete a later, different Sketch command.
  useEffect(() => {
    if (activeCommand !== 'part.sketch.create') setPending(null);
  }, [activeCommand]);

  useEffect(() => {
    if (!pending || activeCommand !== 'part.sketch.create' || committing.current || !commitCreateSketch) return;
    const ready = pending.kind === 'plane'
      ? selectedPlane === pending.plane
      : selectedPlane === null && selectedPick?.kind === 'face'
        && selectedPick.sourceFeatureId === pending.featureId
        && selectedPick.point.join(',') === pending.point;
    if (!ready) return;

    committing.current = true;
    setPending(null);
    // The app command still owns the real sketch, stable face reference, Undo
    // history, persistence and workspace activation; we only trigger it after
    // the selection state has committed to React.
    void Promise.resolve().then(commitCreateSketch).catch((error: unknown) => {
      window.dispatchEvent(new CustomEvent('asa-live-error', { detail: String(error) }));
    }).finally(() => { committing.current = false; });
  }, [pending, activeCommand, selectedPlane, selectedPick, commitCreateSketch]);

  return { planeSelected, faceSelected };
}
