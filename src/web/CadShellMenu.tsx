import { useEffect, useRef, useState } from 'react';
import type { CadUiAction } from './CadUiAction';
import { keepShellKey } from './CadShellKeys';

export interface CadShellMenuProps {
  menuKey: string;
  label: string;
  actionIds: readonly string[];
  getAction(id: string): CadUiAction;
}

/** A menu is a presentation of existing typed actions, never a second executor. */
export function CadShellMenu({ menuKey, label, actionIds, getAction }: CadShellMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actions = actionIds.map(getAction);
  const enabledIndices = actions.map((action, index) => action.enabled ? index : -1).filter((index) => index >= 0);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  const focusFirst = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      const first = enabledIndices[0];
      if (first !== undefined) itemRefs.current[first]?.focus();
    });
  };
  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };
  const move = (currentIndex: number, direction: number) => {
    if (!enabledIndices.length) return;
    const current = enabledIndices.indexOf(currentIndex);
    const next = enabledIndices[(current + direction + enabledIndices.length) % enabledIndices.length];
    if (next !== undefined) itemRefs.current[next]?.focus();
  };
  const execute = (action: CadUiAction) => {
    if (!action.enabled) return;
    close();
    void action.execute();
  };

  return (
    <div className="file-menu-root cad-shell-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className="file-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={'cad-menu-' + menuKey}
        onClick={() => open ? close() : setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            keepShellKey(event);
            focusFirst();
          } else if (event.key === 'Escape' && open) {
            keepShellKey(event);
            close(true);
          }
        }}
      >
        {label}
      </button>
      {open && (
        <div
          id={'cad-menu-' + menuKey}
          className="file-menu-popup"
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            // An open menu owns plain keys: they must not reach CAD shortcuts
            // (Esc cancelling the active command, arrows panning the camera).
            if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); close(true); }
            else if (event.key === 'Tab') close();
          }}
        >
          {actions.map((action, index) => (
            <button
              key={action.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              className="file-menu-item"
              type="button"
              role="menuitem"
              disabled={!action.enabled}
              aria-disabled={!action.enabled}
              title={action.enabled ? action.label : action.label + ': ' + (action.disabledReason ?? 'Недоступно в текущем состоянии')}
              data-command-id={action.id}
              onClick={() => execute(action)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  move(index, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  itemRefs.current[enabledIndices[0] ?? 0]?.focus();
                } else if (event.key === 'End') {
                  event.preventDefault();
                  itemRefs.current[enabledIndices[enabledIndices.length - 1] ?? 0]?.focus();
                }
              }}
            >
              <span className="cad-menu-item-name">{action.label}</span>
              {!action.enabled && <span className="cad-menu-item-hint">недоступно</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
