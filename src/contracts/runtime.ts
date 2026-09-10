import type { CadDocument } from './document';

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

/**
 * Kernel-neutral seam used by CadApplication. Implementations may call
 * Toubkal/OpenCascade/PlaneGCS internally, but native kernel objects must not
 * cross this boundary.
 */
export interface CadRuntimeAdapter {
  recompute(document: Readonly<CadDocument>): Promise<CadRuntimeRecomputeResult>;
  dispose(): void;
}
