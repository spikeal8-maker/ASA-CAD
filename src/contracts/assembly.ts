import type {
  CadAssemblyDocument,
  CadDocument,
  CadDocumentReference,
  CadTransform,
} from './document';
import type { CadMateId, CadOccurrenceId } from './ids';

export interface CadAssemblyResolvedComponent {
  occurrenceId: CadOccurrenceId;
  source: CadDocumentReference;
  document: CadDocument;
}

/** Host/runtime seam for resolving exact pinned component documents. */
export interface CadAssemblyComponentResolver {
  resolve(reference: CadDocumentReference): Promise<CadDocument>;
}

export interface CadSolvedOccurrenceTransform {
  occurrenceId: CadOccurrenceId;
  transform: CadTransform;
}

export interface CadAssemblySolveResult {
  ok: boolean;
  transforms: CadSolvedOccurrenceTransform[];
  unresolvedMateIds: CadMateId[];
  diagnostics: Array<{
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
  }>;
}

/**
 * Kernel/solver-neutral Assembly seam reserved in M1. M4A supplies the concrete
 * mate implementation. No server-side solving or vendor solver objects are part
 * of this contract.
 */
export interface CadAssemblySolverAdapter {
  solve(
    assembly: Readonly<CadAssemblyDocument>,
    components: readonly CadAssemblyResolvedComponent[],
  ): Promise<CadAssemblySolveResult>;
  dispose(): void;
}
