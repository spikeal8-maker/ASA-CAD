import type { CadSketchId } from './ids';
import type { CadDocument, CadSketchEntity } from './document';

/**
 * Solved geometry retains the same entity discriminant as persisted Sketch DTOs
 * so callers can narrow `type` before reading entity-specific data.
 */
export type CadSolvedSketchEntity = CadSketchEntity;

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
