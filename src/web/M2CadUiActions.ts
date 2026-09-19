import type { CadUiActionBinding, CadUiActionBindings } from './CadUiAction';
import type { ShortcutActionId } from './ShortcutRegistry';

export interface M2CadUiActionHandlers {
  open(): void | Promise<void>;
  save(): void | Promise<void>;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
  rebuild(): void | Promise<void>;
  createSketch(): void | Promise<void>;
  line(): void | Promise<void>;
  rectangle(): void | Promise<void>;
  circle(): void | Promise<void>;
  arc(): void | Promise<void>;
  deleteSketchEntity(): void | Promise<void>;
  constructionToggle(): void | Promise<void>;
  horizontalConstraint(): void | Promise<void>;
  verticalConstraint(): void | Promise<void>;
  fixedConstraint(): void | Promise<void>;
  coincidentConstraint(): void | Promise<void>;
  parallelConstraint(): void | Promise<void>;
  perpendicularConstraint(): void | Promise<void>;
  tangentConstraint(): void | Promise<void>;
  concentricConstraint(): void | Promise<void>;
  equalConstraint(): void | Promise<void>;
  symmetricConstraint(): void | Promise<void>;
  pointOnCurveConstraint(): void | Promise<void>;
  linearDimension(): void | Promise<void>;
  horizontalDimension(): void | Promise<void>;
  verticalDimension(): void | Promise<void>;
  diameterDimension(): void | Promise<void>;
  radiusDimension(): void | Promise<void>;
  angularDimension(): void | Promise<void>;
  finishSketch(): void | Promise<void>;
  extrude(): void | Promise<void>;
  cutExtrude(): void | Promise<void>;
  fillet(): void | Promise<void>;
  fit(): void | Promise<void>;
  front(): void | Promise<void>;
  back(): void | Promise<void>;
  top(): void | Promise<void>;
  bottom(): void | Promise<void>;
  left(): void | Promise<void>;
  right(): void | Promise<void>;
  isometric(): void | Promise<void>;
}

export interface M2CadUiActionState {
  canUndo: boolean;
  canRedo: boolean;
  hasSketch: boolean;
  hasSketchEntitySelection: boolean;
  canToggleConstruction: boolean;
  canApplyOrientationConstraint: boolean;
  canApplyFixedConstraint: boolean;
  canApplyCoincidentConstraint: boolean;
  canApplyParallelConstraint: boolean;
  canApplyPerpendicularConstraint: boolean;
  canApplyTangentConstraint: boolean;
  canApplyConcentricConstraint: boolean;
  canApplyEqualConstraint: boolean;
  canApplySymmetryConstraint: boolean;
  canApplyPointOnCurveConstraint: boolean;
  canApplyLineDimension: boolean;
  canApplyDiameterDimension: boolean;
  canApplyRadiusDimension: boolean;
  canApplyAngularDimension: boolean;
  canExtrude: boolean;
  canCutExtrude: boolean;
  canFillet: boolean;
}

function binding(
  execute: () => void | Promise<void>,
  enabled = true,
  disabledReason?: string,
): CadUiActionBinding {
  return { execute, enabled, disabledReason };
}

/** Permanent execution/enablement bindings shared by desktop, mobile and search. */
export function createM2CadUiActionBindings(
  handlers: M2CadUiActionHandlers,
  state: M2CadUiActionState,
): CadUiActionBindings {
  const lineConstraintReason = state.canApplyOrientationConstraint ? undefined : 'Выберите отрезок эскиза';
  const fixedConstraintReason = state.canApplyFixedConstraint ? undefined : 'Выберите незакреплённый отрезок эскиза';
  const pairConstraintReason = 'Создайте два отрезка эскиза';
  const tangentConstraintReason = 'Создайте отрезок и окружность эскиза';
  const lineDimensionReason = state.canApplyLineDimension ? undefined : 'Выберите отрезок эскиза';
  const diameterDimensionReason = state.canApplyDiameterDimension ? undefined : 'Выберите окружность эскиза';
  const radiusDimensionReason = state.canApplyRadiusDimension ? undefined : 'Выберите окружность или дугу эскиза';
  const angularDimensionReason = state.canApplyAngularDimension ? undefined : 'Создайте два отрезка эскиза';
  return {
    'system.open': binding(handlers.open),
    'system.save': binding(handlers.save),
    'system.undo': binding(handlers.undo, state.canUndo, 'Нечего отменять'),
    'system.redo': binding(handlers.redo, state.canRedo, 'Нечего повторять'),
    'system.rebuild': binding(handlers.rebuild),

    'part.sketch.create': binding(handlers.createSketch),
    'sketch.line': binding(handlers.line, state.hasSketch, 'Сначала создайте эскиз'),
    'sketch.rectangle': binding(handlers.rectangle, state.hasSketch, 'Сначала создайте эскиз'),
    'sketch.circle': binding(handlers.circle, state.hasSketch, 'Сначала создайте эскиз'),
    'sketch.arc': binding(handlers.arc, state.hasSketch, 'Сначала создайте эскиз'),
    'sketch.entity.delete': binding(handlers.deleteSketchEntity, state.hasSketchEntitySelection, 'Выберите элемент эскиза'),
    'sketch.construction': binding(handlers.constructionToggle, state.canToggleConstruction, 'Select a Sketch Line'),
    'constraint.horizontal': binding(handlers.horizontalConstraint, state.canApplyOrientationConstraint, lineConstraintReason),
    'constraint.vertical': binding(handlers.verticalConstraint, state.canApplyOrientationConstraint, lineConstraintReason),
    'constraint.fixed': binding(handlers.fixedConstraint, state.canApplyFixedConstraint, fixedConstraintReason),
    'constraint.coincident': binding(handlers.coincidentConstraint, state.canApplyCoincidentConstraint, pairConstraintReason),
    'constraint.parallel': binding(handlers.parallelConstraint, state.canApplyParallelConstraint, pairConstraintReason),
    'constraint.perpendicular': binding(handlers.perpendicularConstraint, state.canApplyPerpendicularConstraint, pairConstraintReason),
    'constraint.tangent': binding(handlers.tangentConstraint, state.canApplyTangentConstraint, tangentConstraintReason),
    'constraint.concentric': binding(handlers.concentricConstraint, state.canApplyConcentricConstraint, 'Создайте две окружности эскиза'),
    'constraint.equal': binding(handlers.equalConstraint, state.canApplyEqualConstraint, pairConstraintReason),
    'constraint.symmetric': binding(handlers.symmetricConstraint, state.canApplySymmetryConstraint, 'Создайте три отрезка эскиза'),
    'constraint.pointOnCurve': binding(handlers.pointOnCurveConstraint, state.canApplyPointOnCurveConstraint, pairConstraintReason),
    'dimension.linear': binding(handlers.linearDimension, state.canApplyLineDimension, lineDimensionReason),
    'dimension.horizontal': binding(handlers.horizontalDimension, state.canApplyLineDimension, lineDimensionReason),
    'dimension.vertical': binding(handlers.verticalDimension, state.canApplyLineDimension, lineDimensionReason),
    'dimension.diameter': binding(handlers.diameterDimension, state.canApplyDiameterDimension, diameterDimensionReason),
    'dimension.radius': binding(handlers.radiusDimension, state.canApplyRadiusDimension, radiusDimensionReason),
    'dimension.angular': binding(handlers.angularDimension, state.canApplyAngularDimension, angularDimensionReason),
    'sketch.finish': binding(handlers.finishSketch, state.hasSketch, 'Сначала создайте эскиз'),
    'part.extrude': binding(handlers.extrude, state.canExtrude, 'Завершите прямоугольный эскиз'),
    'part.cutExtrude': binding(handlers.cutExtrude, state.canCutExtrude, 'Создайте окружность на грани и завершите эскиз'),
    'part.fillet': binding(handlers.fillet, state.canFillet, 'Сначала постройте сквозной вырез'),

    'view.fit': binding(handlers.fit),
    'view.front': binding(handlers.front),
    'view.back': binding(handlers.back),
    'view.top': binding(handlers.top),
    'view.bottom': binding(handlers.bottom),
    'view.left': binding(handlers.left),
    'view.right': binding(handlers.right),
    'view.iso': binding(handlers.isometric),
  };
}

const SHORTCUT_TO_COMMAND_ACTION: Partial<Record<ShortcutActionId, string>> = {
  'system.save': 'system.save',
  'system.undo': 'system.undo',
  'system.redo': 'system.redo',
  'system.rebuild': 'system.rebuild',
  'view.fit': 'view.fit',
  'view.iso': 'view.iso',
  'view.front': 'view.front',
  'view.top': 'view.top',
  'view.left': 'view.left',
};

/** Returns a shared CadUiAction id only for shortcuts that are real commands. */
export function cadUiActionIdForShortcut(action: ShortcutActionId): string | null {
  return SHORTCUT_TO_COMMAND_ACTION[action] ?? null;
}
