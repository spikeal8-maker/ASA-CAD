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

/**
 * Permanent M2 product bindings. Stable identity/labels/presentation stay in
 * command-registry; this function owns only current editor enablement and
 * execution. Desktop, mobile and search must consume actions built from these
 * bindings instead of copying command logic.
 */
export function createM2CadUiActionBindings(
  handlers: M2CadUiActionHandlers,
  state: M2CadUiActionState,
): CadUiActionBindings {
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
