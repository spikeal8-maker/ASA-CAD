import type React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import { ShortcutRegistry, shortcutInputKind, type ShortcutActionId } from './ShortcutRegistry';
import type { SketchLineNumericInput } from './SketchLineNumericInput';

interface CadKeyboardOptions {
  registry: ShortcutRegistry;
  documentKind: CadDocumentKind;
  activeCommand: string | null;
  hasSelection: boolean;
  dispatch(action: ShortcutActionId): void | Promise<void>;
  lineInput: SketchLineNumericInput;
  showLineParameters(): void;
}

export function focusCadEditor(node: Element | null): void {
  node?.closest<HTMLElement>('.cad-app')?.focus({ preventScroll: true });
}

/** Existing central shortcut policy, with scoped direct-Line placement keys. */
export function cadKeyboardHandler(options: CadKeyboardOptions) {
  return (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const inputKind = shortcutInputKind(event.target);
    const target = event.target instanceof Element ? event.target : null;
    const line = options.activeCommand === 'sketch.line' ? options.lineInput : null;
    const isolated = target?.closest('[role="dialog"], [role="menu"]');
    if (line && !isolated && !event.defaultPrevented && !event.nativeEvent.isComposing) {
      if (event.key === 'Escape') {
        focusCadEditor(event.currentTarget);
        if (line.cancelDraft()) { event.preventDefault(); return; }
      }
      if (event.key === 'Enter' && !event.altKey) {
        if (event.ctrlKey || event.metaKey) focusCadEditor(event.currentTarget);
        else if (inputKind === 'none' && !target?.closest('button, a')) {
          event.preventDefault();
          focusCadEditor(event.currentTarget);
          void line.enter();
          return;
        }
      }
      if (inputKind === 'none' && !event.ctrlKey && !event.metaKey && !event.altKey
        && /^[0-9.,-]$/.test(event.key)) {
        event.preventDefault();
        options.showLineParameters();
        line.beginEntry(event.key);
        return;
      }
    }
    const resolved = options.registry.resolve(event, {
      documentKind: options.documentKind, activeCommand: options.activeCommand,
      hasSelection: options.hasSelection && !options.activeCommand,
      cadEditorFocused: true, inputKind,
    });
    if (!resolved) return;
    if (resolved.preventDefault) event.preventDefault();
    void options.dispatch(resolved.action);
  };
}
