import React, { useEffect, useRef, useState } from 'react';
import type { CadUiAction } from './CadUiAction';

const FILE_ACTION_IDS = ['system.new', 'system.open', 'system.save'] as const;

export function CadFileMenu(props: { getAction(id: string): CadUiAction }) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const actions = FILE_ACTION_IDS.map((id) => props.getAction(id));

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
        setFocusIndex(null);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open && focusIndex !== null) itemRefs.current[focusIndex]?.focus();
  }, [focusIndex, open]);

  const close = (returnFocus = false) => {
    setOpen(false);
    setFocusIndex(null);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const openAt = (index: number | null) => {
    setOpen(true);
    setFocusIndex(index);
  };
  const activate = (action: CadUiAction) => {
    if (!action.enabled) return;
    close(false);
    void action.execute();
  };
  const moveFocus = (index: number, delta: number) => {
    setFocusIndex((index + delta + actions.length) % actions.length);
  };

  return (
    <div className="file-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        className="file-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="cad-file-menu"
        onClick={() => open ? close(false) : openAt(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            openAt(0);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            open ? close(false) : openAt(null);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
        }}
      >
        Файл
      </button>
      {open && (
        <div id="cad-file-menu" className="file-menu-popup" role="menu" aria-label="Файл">
          {actions.map((action, index) => (
            <div
              key={action.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              className="file-menu-item"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={!action.enabled}
              data-command-id={action.id}
              title={action.enabled ? action.label : action.disabledReason}
              onClick={() => activate(action)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFocus(index, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  close(true);
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  activate(action);
                }
              }}
            >
              <span>{action.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
