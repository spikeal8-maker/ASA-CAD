import type { CadDocumentKind } from '../contracts/document';

export type ShortcutActionId =
  | 'system.save'
  | 'system.undo'
  | 'system.redo'
  | 'system.rebuild'
  | 'interaction.cancel'
  | 'interaction.commit'
  | 'interaction.delete'
  | 'view.fit'
  | 'view.iso'
  | 'view.front'
  | 'view.top'
  | 'view.left'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.panLeft'
  | 'view.panRight'
  | 'view.panUp'
  | 'view.panDown';

export type ShortcutInputKind = 'none' | 'numeric' | 'text' | 'editable';

export interface ShortcutStroke {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface ShortcutContext {
  documentKind: CadDocumentKind;
  activeCommand: string | null;
  hasSelection: boolean;
  cadEditorFocused: boolean;
  inputKind: ShortcutInputKind;
}

export interface ResolvedShortcut {
  action: ShortcutActionId;
  preventDefault: boolean;
}

const BROWSER_CRITICAL_CTRL_KEYS = new Set(['r', 'l', 't', 'w']);

function normalizedKey(stroke: ShortcutStroke): string {
  return stroke.key.length === 1 ? stroke.key.toLocaleLowerCase('en-US') : stroke.key;
}

function ctrlOrMeta(stroke: ShortcutStroke): boolean {
  return Boolean(stroke.ctrlKey || stroke.metaKey);
}

function browserCritical(stroke: ShortcutStroke): boolean {
  const key = normalizedKey(stroke);
  if (ctrlOrMeta(stroke) && BROWSER_CRITICAL_CTRL_KEYS.has(key)) return true;
  if (stroke.altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
  return false;
}

/**
 * Central M2 keyboard resolver. It contains policy only: no DOM calls and no
 * direct application/runtime dependencies. React dispatches resolved actions
 * through the existing ASA command/application boundaries.
 */
export class ShortcutRegistry {
  resolve(stroke: ShortcutStroke, context: ShortcutContext): ResolvedShortcut | null {
    if (browserCritical(stroke)) return null;

    const key = normalizedKey(stroke);
    const ctrl = ctrlOrMeta(stroke);
    const shift = Boolean(stroke.shiftKey);
    const alt = Boolean(stroke.altKey);
    const editingValue = context.inputKind !== 'none';

    // Save is deliberately safe while editing text/numeric values.
    if (ctrl && !alt && key === 's') return { action: 'system.save', preventDefault: true };

    // Command lifecycle keys are explicitly allowed from parameter fields.
    if (key === 'Escape' && context.activeCommand) {
      return { action: 'interaction.cancel', preventDefault: true };
    }
    if (ctrl && !alt && key === 'Enter' && context.activeCommand) {
      return { action: 'interaction.commit', preventDefault: true };
    }

    // Everything else preserves native text/value editing semantics.
    if (editingValue) return null;

    if (ctrl && !alt && key === 'z' && shift) return { action: 'system.redo', preventDefault: true };
    if (ctrl && !alt && key === 'z') return { action: 'system.undo', preventDefault: true };
    if (ctrl && !alt && key === 'y') return { action: 'system.redo', preventDefault: true };

    if (key === 'Escape') {
      if (context.hasSelection) return { action: 'interaction.cancel', preventDefault: true };
      return null;
    }

    if (key === 'Delete' && context.hasSelection) {
      return { action: 'interaction.delete', preventDefault: true };
    }

    if (key === 'F5' && context.cadEditorFocused && ['part', 'assembly', 'drawing'].includes(context.documentKind)) {
      return { action: 'system.rebuild', preventDefault: true };
    }

    if (ctrl && !alt && (key === '+' || key === '=')) return { action: 'view.zoomIn', preventDefault: true };
    if (ctrl && !alt && key === '-') return { action: 'view.zoomOut', preventDefault: true };

    if (!ctrl && !alt && !shift && key === 'ArrowLeft') return { action: 'view.panLeft', preventDefault: true };
    if (!ctrl && !alt && !shift && key === 'ArrowRight') return { action: 'view.panRight', preventDefault: true };
    if (!ctrl && !alt && !shift && key === 'ArrowUp') return { action: 'view.panUp', preventDefault: true };
    if (!ctrl && !alt && !shift && key === 'ArrowDown') return { action: 'view.panDown', preventDefault: true };

    if (!ctrl && !alt && !shift && key === 'f') return { action: 'view.fit', preventDefault: true };
    if (!ctrl && !alt && !shift && key === '0') return { action: 'view.iso', preventDefault: true };
    if (!ctrl && !alt && !shift && key === '1') return { action: 'view.front', preventDefault: true };
    if (!ctrl && !alt && !shift && key === '2') return { action: 'view.top', preventDefault: true };
    if (!ctrl && !alt && !shift && key === '3') return { action: 'view.left', preventDefault: true };

    return null;
  }
}

export function shortcutInputKind(target: EventTarget | null): ShortcutInputKind {
  if (!(target instanceof HTMLElement)) return 'none';
  if (target.isContentEditable) return 'editable';
  if (target instanceof HTMLTextAreaElement) return 'text';
  if (target instanceof HTMLInputElement) {
    return target.type === 'number' || target.type === 'range' ? 'numeric' : 'text';
  }
  return 'none';
}
