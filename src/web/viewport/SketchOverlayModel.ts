import type {
  CadSketch,
  CadSketchEntity,
} from '../../contracts/document';
import type { CadSketchId } from '../../contracts/ids';
import type {
  CadSketchConstraintState,
  CadSketchSolveSnapshot,
  CadSketchSolveStatus,
} from '../../application/SketchSolveSession';

export type SketchOverlaySource = 'document' | 'solver-preview';

export interface SketchOverlayDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

/**
 * Kernel-neutral transient 2D presentation model for one active Sketch.
 *
 * It deliberately does not extend CadRenderModel: B-Rep tessellation and Sketch
 * preview are separate presentation surfaces with different lifecycles.
 */
export interface SketchOverlayModel {
  sketchId: CadSketchId;
  source: SketchOverlaySource;
  entities: CadSketchEntity[];
  solveStatus: CadSketchSolveStatus;
  constraintState: CadSketchConstraintState;
  degreesOfFreedom: number | null;
  diagnostics: SketchOverlayDiagnostic[];
}

export function buildSketchOverlayModel(
  sketch: Readonly<CadSketch> | null,
  solveSnapshot?: Readonly<CadSketchSolveSnapshot> | null,
): SketchOverlayModel | null {
  if (!sketch) return null;

  const useSolvedPreview = Boolean(
    solveSnapshot
    && solveSnapshot.sketchId === sketch.id
    && solveSnapshot.status === 'solved'
    && solveSnapshot.previewEntities.length > 0,
  );

  return {
    sketchId: sketch.id,
    source: useSolvedPreview ? 'solver-preview' : 'document',
    entities: structuredClone(
      useSolvedPreview ? solveSnapshot!.previewEntities : sketch.entities,
    ),
    solveStatus: solveSnapshot?.sketchId === sketch.id
      ? solveSnapshot.status
      : 'idle',
    constraintState: solveSnapshot?.sketchId === sketch.id
      ? solveSnapshot.constraintState
      : 'unknown',
    degreesOfFreedom: solveSnapshot?.sketchId === sketch.id
      ? solveSnapshot.degreesOfFreedom
      : null,
    diagnostics: solveSnapshot?.sketchId === sketch.id
      ? structuredClone(solveSnapshot.diagnostics)
      : [],
  };
}
