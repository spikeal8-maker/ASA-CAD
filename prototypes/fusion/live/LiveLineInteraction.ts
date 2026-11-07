import type { CadSketchSolveSnapshot } from '../../../src/application/SketchSolveSession';
import type { CadCommandId } from '../../../src/contracts/commands';
import type { CadPoint2 } from '../../../src/contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../../src/contracts/ids';

export type LiveLinePhase =
  | 'IDLE'
  | 'AWAITING_START'
  | 'PREVIEW_SEGMENT'
  | 'NUMERIC_INPUT'
  | 'COMMITTING_SEGMENT'
  | 'CONTINUING_CHAIN'
  | 'CLOSING_CHAIN'
  | 'CANCELLED';
export type LiveLineNumericField = 'length' | 'angle';
export type LiveLineAngleMode = 'absolute' | 'chain-interior';

export interface LiveLineEndpointReference {
  entityId: CadSketchEntityId;
  point: 'a' | 'b';
}

/** Endpoint refs are supplied from the stage's actual solved-geometry pick. */
export interface LiveLineSnap {
  kind: 'endpoint' | 'chain-start' | 'horizontal' | 'vertical' | 'origin' | 'midpoint';
  point: CadPoint2;
  ref?: LiveLineEndpointReference;
  sourceEntityId?: CadSketchEntityId;
}

export interface LiveLinePointerContext {
  point: CadPoint2;
  snap: LiveLineSnap | null;
}

export interface LiveLineCommit {
  entityId: CadSketchEntityId | null;
  from: CadPoint2;
  to: CadPoint2;
  closed: boolean;
  completed: boolean;
  createdIds: readonly string[];
  commands: readonly CadCommandId[];
  /** Existing CadApplication gives every changed execute its own Undo frame. */
  undoFrames: number;
  coincidentIds: readonly string[];
  orientationConstraintId: string | null;
  lengthDimensionId: string | null;
  /** Typed angle, measured from the previous segment's reverse ray in a chain. */
  inputAngleDegrees: number | null;
  angleMode: LiveLineAngleMode;
  /** Global bearing used to construct coordinates; this is not a dimension. */
  coordinateAngleDegrees: number | null;
  angleDriving: false;
  error: string | null;
}

export interface LiveLineSnapshot {
  phase: LiveLinePhase;
  active: boolean;
  committing: boolean;
  sketchId: CadSketchId | null;
  from: CadPoint2 | null;
  to: CadPoint2 | null;
  /** Last canvas pick before numeric locks; overlay interactions do not move it. */
  pointerPoint: CadPoint2 | null;
  fromReference: LiveLineEndpointReference | null;
  chainStart: CadPoint2 | null;
  chainStartReference: LiveLineEndpointReference | null;
  chainSegmentIds: readonly CadSketchEntityId[];
  /** Start of the preceding actual segment, copied from the solved geometry. */
  previousSegmentFrom: CadPoint2 | null;
  angleMode: LiveLineAngleMode;
  length: number;
  angleDegrees: number;
  lengthText: string;
  angleText: string;
  lengthEdited: boolean;
  angleEdited: boolean;
  lengthLocked: boolean;
  angleLocked: boolean;
  lengthValid: boolean;
  angleValid: boolean;
  numericTextValid: boolean;
  /** An angle lock controls the transient coordinates; it is not a dimension. */
  angleDriving: false;
  focusedField: LiveLineNumericField | null;
  snap: LiveLineSnap | null;
  error: string | null;
  lastCommit: LiveLineCommit | null;
}

export interface LiveLineOwnerActions {
  setPointerContext(context: LiveLinePointerContext): void;
  focusNumeric(field: LiveLineNumericField | null): void;
  setNumeric(field: LiveLineNumericField, text: string): void;
  lockNumeric(field: LiveLineNumericField): boolean;
  unlockNumeric(field: LiveLineNumericField): void;
  commitPreview(): Promise<boolean>;
  finishChain(): void;
  cancelPreview(): void;
  exitTool(): void;
}

export function createLiveLineSnapshot(
  active = false,
  sketchId: CadSketchId | null = null,
): LiveLineSnapshot {
  return {
    phase: active ? 'AWAITING_START' : 'IDLE',
    active, committing: false, sketchId,
    from: null, to: null, pointerPoint: null, fromReference: null,
    chainStart: null, chainStartReference: null, chainSegmentIds: [],
    previousSegmentFrom: null, angleMode: 'absolute',
    length: 0, angleDegrees: 0, lengthText: '', angleText: '',
    lengthEdited: false, angleEdited: false,
    lengthLocked: false, angleLocked: false,
    lengthValid: true, angleValid: true, numericTextValid: true,
    angleDriving: false, focusedField: null, snap: null, error: null,
    lastCommit: null,
  };
}

const listeners = new Set<() => void>();
let snapshot = createLiveLineSnapshot();
let owner: { token: symbol; actions: LiveLineOwnerActions } | null = null;

function emit(): void {
  for (const listener of [...listeners]) listener();
}

/** There is no document or application proxy in this transient UI bridge. */
export function publishLiveLineInteraction(token: symbol, value: LiveLineSnapshot): void {
  if (owner?.token !== token) return;
  snapshot = value;
  emit();
}

export function bindLiveLineInteraction(
  token: symbol,
  actions: LiveLineOwnerActions,
  value: LiveLineSnapshot,
): () => void {
  owner = { token, actions };
  publishLiveLineInteraction(token, value);
  return () => {
    if (owner?.token !== token) return;
    owner = null;
    snapshot = createLiveLineSnapshot();
    emit();
  };
}

/** Stable functions and cached snapshots support React.useSyncExternalStore. */
export const liveLineInteraction = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot(): LiveLineSnapshot { return snapshot; },
  setPointerContext(context: LiveLinePointerContext): void {
    owner?.actions.setPointerContext(context);
  },
  focusNumeric(field: LiveLineNumericField | null): void {
    owner?.actions.focusNumeric(field);
  },
  setNumeric(field: LiveLineNumericField, text: string): void {
    owner?.actions.setNumeric(field, text);
  },
  lockNumeric(field: LiveLineNumericField): boolean {
    return owner?.actions.lockNumeric(field) ?? false;
  },
  unlockNumeric(field: LiveLineNumericField): void {
    owner?.actions.unlockNumeric(field);
  },
  commitPreview(): Promise<boolean> {
    return owner?.actions.commitPreview() ?? Promise.resolve(false);
  },
  finishChain(): void { owner?.actions.finishChain(); },
  cancelPreview(): void { owner?.actions.cancelPreview(); },
  exitTool(): void { owner?.actions.exitTool(); },
};

/** The existing stage owns the only solver; this bridge only awaits its result. */
type LiveLineSolverResolver = () => Promise<Readonly<CadSketchSolveSnapshot>>;
let solver: { token: symbol; sketchId: CadSketchId; resolve: LiveLineSolverResolver } | null = null;

export function registerLiveLineSolver(sketchId: CadSketchId, resolve: LiveLineSolverResolver): () => void {
  const token = Symbol('live-line-stage-solver');
  solver = { token, sketchId, resolve };
  return () => { if (solver?.token === token) solver = null; };
}

export async function resolveLiveLineCommit(sketchId: CadSketchId): Promise<Readonly<CadSketchSolveSnapshot>> {
  const registered = solver;
  if (!registered || registered.sketchId !== sketchId) {
    throw new Error('Решение текущего эскиза недоступно: stage resolver не зарегистрирован');
  }
  return registered.resolve();
}
