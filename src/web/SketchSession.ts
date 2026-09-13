import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';

/**
 * Transient editor state for the active Sketch and its selected entity.
 * Neither value is persisted in CadDocument. Persisted identity always remains
 * the ASA-owned Sketch/entity IDs stored in the document itself.
 */
export interface SketchSessionState {
  activeSketchId: CadSketchId | null;
  selectedEntityId: CadSketchEntityId | null;
}

export function createSketchSessionState(): SketchSessionState {
  return { activeSketchId: null, selectedEntityId: null };
}

export function activateSketch(
  state: SketchSessionState,
  sketchId: CadSketchId,
): SketchSessionState {
  if (state.activeSketchId === sketchId) return state;
  return { activeSketchId: sketchId, selectedEntityId: null };
}

export function clearSketchSession(state: SketchSessionState): SketchSessionState {
  return state.activeSketchId === null && state.selectedEntityId === null
    ? state
    : { activeSketchId: null, selectedEntityId: null };
}

export function selectSketchEntity(
  state: SketchSessionState,
  sketchId: CadSketchId,
  entityId: CadSketchEntityId,
): SketchSessionState {
  if (state.activeSketchId === sketchId && state.selectedEntityId === entityId) return state;
  return { activeSketchId: sketchId, selectedEntityId: entityId };
}

export function clearSketchEntitySelection(state: SketchSessionState): SketchSessionState {
  return state.selectedEntityId === null ? state : { ...state, selectedEntityId: null };
}

export function resolveActiveSketch(
  part: Readonly<CadPartDocument> | null,
  activeSketchId: CadSketchId | null,
): Readonly<CadSketch> | null {
  if (!part || !activeSketchId) return null;
  return part.sketches.find((sketch) => sketch.id === activeSketchId) ?? null;
}

/** Clears stale transient context after undo/open/document replacement/delete. */
export function reconcileSketchSession(
  state: SketchSessionState,
  part: Readonly<CadPartDocument> | null,
): SketchSessionState {
  if (!state.activeSketchId) {
    return state.selectedEntityId === null ? state : { activeSketchId: null, selectedEntityId: null };
  }
  const sketch = resolveActiveSketch(part, state.activeSketchId);
  if (!sketch) return { activeSketchId: null, selectedEntityId: null };
  if (state.selectedEntityId && !sketch.entities.some((entity) => entity.id === state.selectedEntityId)) {
    return { ...state, selectedEntityId: null };
  }
  return state;
}
