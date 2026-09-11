import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';

/**
 * Transient editor state for choosing the Sketch targeted by Sketch/Part tools.
 * It is deliberately not persisted in CadDocument and does not imply that the
 * Sketch is currently in edit mode; workspace/tool state owns that distinction.
 */
export interface SketchSessionState {
  activeSketchId: CadSketchId | null;
}

export function createSketchSessionState(): SketchSessionState {
  return { activeSketchId: null };
}

export function activateSketch(
  state: SketchSessionState,
  sketchId: CadSketchId,
): SketchSessionState {
  return state.activeSketchId === sketchId ? state : { activeSketchId: sketchId };
}

export function clearSketchSession(state: SketchSessionState): SketchSessionState {
  return state.activeSketchId === null ? state : { activeSketchId: null };
}

export function resolveActiveSketch(
  part: Readonly<CadPartDocument> | null,
  activeSketchId: CadSketchId | null,
): Readonly<CadSketch> | null {
  if (!part || !activeSketchId) return null;
  return part.sketches.find((sketch) => sketch.id === activeSketchId) ?? null;
}

/** Clears stale transient selection after undo/open/document replacement. */
export function reconcileSketchSession(
  state: SketchSessionState,
  part: Readonly<CadPartDocument> | null,
): SketchSessionState {
  if (!state.activeSketchId) return state;
  return resolveActiveSketch(part, state.activeSketchId)
    ? state
    : { activeSketchId: null };
}
