import type { CadUiActionExecutor } from './CadUiAction';
import { useM2CadUiActions } from './useM2CadUiActions';
import type { usePartSketchWorkspace } from './usePartSketchWorkspace';

type PartSketchWorkspace = ReturnType<typeof usePartSketchWorkspace>;
type ResultExecutor = () => unknown | Promise<unknown>;

const ignoreResult = (executor: ResultExecutor): CadUiActionExecutor => async () => {
  await executor();
};

export interface PartCadUiActionCatalogOptions {
  workspace: PartSketchWorkspace;
  canUndo: boolean;
  canRedo: boolean;
  open: CadUiActionExecutor;
  save: CadUiActionExecutor;
  undo: CadUiActionExecutor;
  redo: CadUiActionExecutor;
  rebuild: CadUiActionExecutor;
  horizontalConstraint: ResultExecutor;
  verticalConstraint: ResultExecutor;
  fixedConstraint: ResultExecutor;
  concentricConstraint: ResultExecutor;
  equalConstraint: ResultExecutor;
  symmetricConstraint: ResultExecutor;
  pointOnCurveConstraint: ResultExecutor;
  requestView(label: string): void;
}

/** App-level wiring for the one shared desktop/mobile/search CadUiAction catalog. */
export function usePartCadUiActionCatalog(options: PartCadUiActionCatalogOptions) {
  const {
    workspace, canUndo, canRedo, open, save, undo, redo, rebuild,
    horizontalConstraint, verticalConstraint, fixedConstraint,
    concentricConstraint, equalConstraint, symmetricConstraint, pointOnCurveConstraint,
    requestView,
  } = options;
  return useM2CadUiActions({
    open, save, undo, redo, rebuild,
    createSketch: workspace.beginCreateSketch,
    line: workspace.beginLine,
    rectangle: workspace.beginRectangle,
    circle: workspace.beginCircle,
    arc: workspace.beginArc,
    deleteSketchEntity: ignoreResult(workspace.deleteSelectedSketchEntity),
    constructionToggle: ignoreResult(workspace.toggleSelectedConstruction),
    horizontalConstraint: ignoreResult(horizontalConstraint),
    verticalConstraint: ignoreResult(verticalConstraint),
    fixedConstraint: ignoreResult(fixedConstraint),
    coincidentConstraint: ignoreResult(workspace.beginCoincidentConstraint),
    parallelConstraint: ignoreResult(workspace.beginParallelConstraint),
    perpendicularConstraint: ignoreResult(workspace.beginPerpendicularConstraint),
    tangentConstraint: ignoreResult(workspace.beginTangentConstraint),
    concentricConstraint: ignoreResult(concentricConstraint),
    equalConstraint: ignoreResult(equalConstraint),
    symmetricConstraint: ignoreResult(symmetricConstraint),
    pointOnCurveConstraint: ignoreResult(pointOnCurveConstraint),
    horizontalDimension: ignoreResult(workspace.beginHorizontalDimension),
    verticalDimension: ignoreResult(workspace.beginVerticalDimension),
    finishSketch: workspace.finishSketch,
    extrude: workspace.beginExtrude,
    cutExtrude: workspace.beginCut,
    fillet: workspace.beginFillet,
    fit: () => requestView('Показать всё'),
    front: () => requestView('Спереди'),
    back: () => requestView('Сзади'),
    top: () => requestView('Сверху'),
    bottom: () => requestView('Снизу'),
    left: () => requestView('Слева'),
    right: () => requestView('Справа'),
    isometric: () => requestView('Изометрия'),
  }, {
    canUndo,
    canRedo,
    hasSketch: Boolean(workspace.sketch),
    hasSketchEntitySelection: Boolean(workspace.selectedSketchEntityId),
    canToggleConstruction: Boolean(
      workspace.sketch?.entities.some(
        (entity) => entity.id === workspace.selectedSketchEntityId && entity.type === 'line',
      ),
    ),
    canApplyOrientationConstraint: workspace.canApplyOrientationConstraint,
    canApplyFixedConstraint: workspace.canApplyFixedConstraint,
    canApplyCoincidentConstraint: workspace.canApplyCoincidentConstraint,
    canApplyParallelConstraint: workspace.canApplyParallelConstraint,
    canApplyPerpendicularConstraint: workspace.canApplyPerpendicularConstraint,
    canApplyTangentConstraint: workspace.canApplyTangentConstraint,
    canApplyConcentricConstraint: workspace.canApplyConcentricConstraint,
    canApplyEqualConstraint: workspace.canApplyEqualConstraint,
    canApplySymmetryConstraint: workspace.canApplySymmetryConstraint,
    canApplyPointOnCurveConstraint: workspace.canApplyPointOnCurveConstraint,
    canApplyDirectionalDimension: workspace.canApplyDirectionalDimension,
    canExtrude: workspace.canExtrude,
    canCutExtrude: workspace.canCut,
    canFillet: workspace.canFillet,
  });
}
