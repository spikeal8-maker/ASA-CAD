import type { CadDocument } from './document';
import type { CadFeatureId } from './ids';

export interface CadRuntimeDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  objectId?: string;
}

export interface CadRuntimeRecomputeResult {
  ok: boolean;
  diagnostics: CadRuntimeDiagnostic[];
  /** Runtime-owned render/B-Rep revision. Never serialize native pointers here. */
  runtimeRevision?: string;
}

export type CadReferenceKind = 'face' | 'edge' | 'vertex';

/**
 * Product-level request derived from a viewport pick. `point` is a world-space
 * hit hint, not a raw OCC ordinal/pointer.
 */
export interface CadReferenceCaptureRequest {
  kind: CadReferenceKind;
  sourceFeatureId: CadFeatureId;
  point: readonly [number, number, number];
  semanticRole: string;
}

export interface CadRuntimeReferenceCaptureResult {
  ownerFeatureId: CadFeatureId;
  semanticRole: string;
  locator: Record<string, unknown>;
}

/**
 * Kernel-neutral seam used by CadApplication. Implementations may call
 * Toubkal/OpenCascade/PlaneGCS internally, but native kernel objects must not
 * cross this boundary.
 */
/** Transient ownership check. Never serialize it or retain a stale request as document state. */
export interface CadRuntimeRequest {
  readonly isCurrent: () => boolean;
}

export interface CadRuntimeAdapter {
  recompute(document: Readonly<CadDocument>, request?: CadRuntimeRequest): Promise<CadRuntimeRecomputeResult>;
  captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
    ownership?: CadRuntimeRequest,
  ): Promise<CadRuntimeReferenceCaptureResult>;
  dispose(): void;
}
