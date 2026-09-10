import type { CadSketchEntityId, CadSketchId } from './ids';
import type { CadDocument } from './document';

export interface CadSolvedSketchEntity {
  id: CadSketchEntityId;
  data: Record<string, unknown>;
}

export interface CadSketchSolveResult {
  ok: boolean;
  converged: boolean;
  residual: number;
  iterations: number;
  entities: CadSolvedSketchEntity[];
  diagnostics: Array<{
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
  }>;
}

/**
 * ASA-owned sketch solver seam. Concrete implementations may delegate to
 * PlaneGCS/SolveSpace/vendor adapters, but solver-native objects never cross it.
 */
export interface CadSketchSolverAdapter {
  init(): Promise<void>;
  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult;
  dispose(): void;
}
