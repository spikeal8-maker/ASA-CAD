// A05 v2: one readiness predicate for all shared sketch mutation callbacks.
// Fusion Sketch requires a current matching camera registration (fail closed);
// non-Fusion (KOMPAS) passes through unchanged. Rejection is notice-only: no
// draft loss, no history, no document revision change.
import { isSketchMutationReady } from './SketchMutationReadiness';
import type { CadDocumentKind } from '../contracts/document';
import type { CadWorkspacePanel, Workspace } from './PartSketchWorkspaceTypes';

export interface SketchMutationGate {
  isReady(): boolean;
  reject(): void;
}

export function sketchGate(options: {
  fusionActive: boolean;
  documentId: string;
  sketchId: string | null;
  reject(message: string): void;
}): SketchMutationGate {
  return {
    isReady() {
      if (!options.fusionActive) return true;
      return isSketchMutationReady(options.documentId, options.sketchId);
    },
    reject() { options.reject('Камера не готова: ввод координат заблокирован'); },
  };
}

/** Pass-through outside Fusion; inside Fusion the live registry decides at attempt time. */
export function guardSketchMutation<A extends unknown[], R>(gate: SketchMutationGate, fn: (...args: A) => R): (...args: A) => R | void {
  return (...args: A) => {
    if (!gate.isReady()) { gate.reject(); return; }
    return fn(...args);
  };
}

/** Pick a named set of exposed callbacks and route each through the gate. */
function gateKeys(gate: SketchMutationGate, source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'function') out[key] = guardSketchMutation(gate, value as (...args: unknown[]) => unknown);
  }
  return out;
}

type CommandResult = boolean | void | Promise<boolean | void>;

export interface ActiveCommandContext {
  activeCommand: string | null;
  commitLinePreview(): CommandResult;
  commitArcPreview(): CommandResult;
  commitCreateSketch(): CommandResult;
  commitRectanglePreview(): CommandResult;
  commitRectangle(): CommandResult;
  commitCirclePreview(): CommandResult;
  commitCircle(): CommandResult;
  hasRectangleDraft: boolean;
  hasCircleDraft: boolean;
  commitExtrude(): CommandResult;
  commitCut(): CommandResult;
  commitFillet(): CommandResult;
  dimensionCreationMode: string | null;
  commitDimensionCreation(): CommandResult;
  commitDimensionEdit(): CommandResult;
}

/**
 * Extracted from usePartSketchWorkspace with branch logic unchanged; sketch
 * branches run through the shared readiness predicate. Solid-feature and
 * create-sketch branches, and all cancel/reset/exit actions, are preserved.
 */
export async function dispatchCmd(gate: SketchMutationGate, ctx: ActiveCommandContext): Promise<boolean | void> {
  const sketch = (attempt: () => CommandResult): CommandResult => (gate.isReady() ? attempt() : (gate.reject(), undefined));
  if (ctx.activeCommand === 'sketch.line') return sketch(() => ctx.commitLinePreview());
  if (ctx.activeCommand === 'sketch.arc') return sketch(() => ctx.commitArcPreview());
  if (ctx.activeCommand === 'part.sketch.create') return ctx.commitCreateSketch();
  if (ctx.activeCommand === 'sketch.rectangle') return sketch(() => (ctx.hasRectangleDraft ? ctx.commitRectanglePreview() : ctx.commitRectangle()));
  if (ctx.activeCommand === 'sketch.circle') return sketch(() => (ctx.hasCircleDraft ? ctx.commitCirclePreview() : ctx.commitCircle()));
  if (ctx.activeCommand === 'part.extrude') return ctx.commitExtrude();
  if (ctx.activeCommand === 'part.cutExtrude') return ctx.commitCut();
  if (ctx.activeCommand === 'part.fillet') return ctx.commitFillet();
  if (ctx.dimensionCreationMode) return sketch(() => ctx.commitDimensionCreation());
  if (ctx.activeCommand === 'dimension.edit') return sketch(() => ctx.commitDimensionEdit());
  return undefined;
}

/**
 * Gated copies of the exposed sketch mutation callbacks: dispatcher sketch
 * branches, commit/commitPreview, point-confirm, Line/Arc/Circle numeric enter,
 * dimension create/edit, translation, constraint apply. Cancel/reset/exit and
 * navigation/Undo/Redo are never gated.
 */
export function gateAll(
  gate: SketchMutationGate,
  editing: Record<string, unknown>,
  constraints: Record<string, unknown>,
  entityMutations: Record<string, unknown>,
  dimensions: Record<string, unknown>,
  creation: Record<string, unknown>,
): Record<string, unknown> {
  const editingMutations = ['commitRectangle', 'commitCircle', 'commitLinePreview', 'commitRectanglePreview',
    'commitCirclePreview', 'commitArcPreview', 'handleSketchLinePoint', 'handleSketchRectanglePoint',
    'handleSketchCirclePoint', 'handleSketchArcPoint'];
  const constraintMutations = ['applyHorizontalConstraint', 'applyVerticalConstraint', 'applyFixedConstraint',
    'applyCoincidentConstraint', 'applyParallelConstraint', 'applyPerpendicularConstraint',
    'applyTangentConstraint', 'applyConcentricConstraint', 'applyEqualConstraint',
    'applySymmetryConstraint', 'applyPointOnCurveConstraint'];
  const dimensionCreation = creation.dimensionCreation as { commit: (...args: unknown[]) => unknown };
  const out: Record<string, unknown> = {
    ...gateKeys(gate, editing, editingMutations),
    ...gateKeys(gate, constraints, constraintMutations),
    ...gateKeys(gate, entityMutations, ['translateSketchEntity']),
    ...gateKeys(gate, dimensions, ['commitDimensionEdit']),
    dimensionCreation: { ...dimensionCreation, commit: guardSketchMutation(gate, dimensionCreation.commit) },
  };
  for (const key of ['lineInput', 'arcInput', 'circleInput'] as const) {
    const input = editing[key] as { enter: (...args: unknown[]) => unknown };
    out[key] = { ...input, enter: guardSketchMutation(gate, input.enter) };
  }
  return out;
}

export interface CancelCommandContext {
  activeCommand: string | null;
  dimensionCreationMode: string | null;
  cancelDimensionCreation(): void;
  resetActiveTool(command: string | null): void;
  resetExtrude(): void;
  clearDimensionEdit(): void;
  clearTransientSelection(): void;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setActiveWorkspace(workspace: Workspace): void;
  notice(message: string): void;
  documentKind: CadDocumentKind;
}

/** Existing cancel behavior, extracted unchanged; always usable when gated. */
export function cancelCmd(ctx: CancelCommandContext): void {
  if (ctx.dimensionCreationMode) { ctx.cancelDimensionCreation(); return; }
  ctx.resetActiveTool(ctx.activeCommand);
  if (ctx.activeCommand === 'part.extrude') ctx.resetExtrude();
  const stayInSketch = ctx.activeCommand === 'constraint.coincident' || /^(sketch|constraint)\./.test(ctx.activeCommand ?? '');
  ctx.setActiveCommand(null);
  ctx.clearDimensionEdit();
  ctx.setPanel('tree');
  ctx.clearTransientSelection();
  ctx.setActiveWorkspace(ctx.documentKind === 'part' ? (stayInSketch ? 'sketch' : 'solid') : ctx.documentKind);
  ctx.notice('Команда отменена');
}
