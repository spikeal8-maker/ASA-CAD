import type { CadBodyId } from '../../contracts/ids';
import type {
  ViewportPickCandidate,
  ViewportSelectionMode,
} from './ViewportPicking';

export interface ViewportSelectionSnapshot {
  mode: ViewportSelectionMode;
  selectedBodyId: CadBodyId | null;
  hoverCandidate: ViewportPickCandidate | null;
  selectedCommandCandidate: ViewportPickCandidate | null;
}

/**
 * Pure selection state owner shared by current B-Rep picking and future Sketch
 * overlay picking. Three.js objects/DOM events intentionally never enter it.
 */
export class ViewportSelectionController {
  private snapshot: ViewportSelectionSnapshot;

  constructor(
    mode: ViewportSelectionMode = 'none',
    selectedBodyId: CadBodyId | null = null,
  ) {
    this.snapshot = {
      mode,
      selectedBodyId,
      hoverCandidate: null,
      selectedCommandCandidate: null,
    };
  }

  getSnapshot(): Readonly<ViewportSelectionSnapshot> {
    return this.snapshot;
  }

  setMode(mode: ViewportSelectionMode): void {
    this.snapshot = {
      ...this.snapshot,
      mode,
      hoverCandidate: null,
      selectedCommandCandidate: null,
    };
  }

  setExternalBodySelection(bodyId: CadBodyId | null): void {
    this.snapshot = {
      ...this.snapshot,
      selectedBodyId: bodyId,
      hoverCandidate: null,
    };
  }

  setHover(candidate: ViewportPickCandidate | null): void {
    this.snapshot = { ...this.snapshot, hoverCandidate: candidate };
  }

  clearHover(): void {
    if (!this.snapshot.hoverCandidate) return;
    this.snapshot = { ...this.snapshot, hoverCandidate: null };
  }

  select(candidate: ViewportPickCandidate | null): void {
    if (this.snapshot.mode === 'none') {
      this.snapshot = {
        ...this.snapshot,
        selectedBodyId: candidate?.kind === 'body' ? candidate.bodyId : null,
        hoverCandidate: null,
        selectedCommandCandidate: null,
      };
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      hoverCandidate: null,
      selectedCommandCandidate: candidate,
    };
  }

  resetCommandSelection(): void {
    this.snapshot = {
      ...this.snapshot,
      hoverCandidate: null,
      selectedCommandCandidate: null,
    };
  }
}
