import type { CadCommand, CadCommandAvailability, CadCommandId, CadCommandResult } from './commands';
import type { CadDocument } from './document';
import type { CadObjectId, CadStableReferenceId } from './ids';
import type { CadMeasurementRequest, CadMeasurementResult } from './measurement';
import type { CadReferenceCaptureRequest } from './runtime';

export type CadApplicationMode = 'idle' | 'command' | 'rebuilding' | 'error';

export interface CadSelectionItem {
  id: CadObjectId;
  kind: string;
}

export interface CadApplicationState {
  documentKind: CadDocument['kind'];
  mode: CadApplicationMode;
  activeCommandId?: CadCommandId;
  selection: CadSelectionItem[];
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  recompute: {
    status: 'clean' | 'dirty' | 'running' | 'warning' | 'error';
    message?: string;
  };
}

export type CadApplicationListener = (state: Readonly<CadApplicationState>) => void;

/**
 * The permanent ASA UI talks only to this application-level boundary.
 * Implementations may use imported Toubkal/OpenCascade services behind adapters,
 * but those types must never leak through this interface.
 */
export interface CadApplication {
  getDocument(): Readonly<CadDocument>;
  getState(): Readonly<CadApplicationState>;
  getCommandAvailability(id: CadCommandId): CadCommandAvailability;
  execute(command: CadCommand): Promise<CadCommandResult>;
  captureReference(request: CadReferenceCaptureRequest): Promise<CadStableReferenceId>;
  measure(request: CadMeasurementRequest): Promise<CadMeasurementResult>;
  undo(): Promise<CadCommandResult>;
  redo(): Promise<CadCommandResult>;
  replaceDocument(document: CadDocument): Promise<void>;
  subscribe(listener: CadApplicationListener): () => void;
  dispose(): void;
}

export interface CadProjectLoadResult {
  document: CadDocument;
  revision: number;
}

/**
 * Host/persistence seam. Standalone mode can use IndexedDB/local files; ASA Lab
 * maps it to Project Core. Geometry computation is intentionally absent here.
 */
export interface CadProjectHost {
  load(): Promise<CadProjectLoadResult>;
  save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }>;
  saveSnapshot?(input: {
    imageDataUrl: string;
    sourceRevision: number;
  }): Promise<void>;
}
