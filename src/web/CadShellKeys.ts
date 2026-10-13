import type React from 'react';

/**
 * Shell navigation keys (menus, command search) are handled locally and must
 * not bubble to the central CAD shortcut handler, where Esc cancels the active
 * command and arrows pan the camera.
 */
export function keepShellKey(event: React.KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** Moves focus between enabled buttons of a list in DOM order; returns false if the key is not a list key. */
export function moveListFocus(container: HTMLElement | null, current: Element | null, key: string): boolean {
  if (!container || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return false;
  const items = Array.from(container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (!items.length) return true;
  const index = items.indexOf(current as HTMLButtonElement);
  const step = key === 'ArrowDown' ? 1 : -1;
  const next = key === 'Home' ? 0
    : key === 'End' || (index < 0 && step < 0) ? items.length - 1
      : (index + step + items.length) % items.length;
  items[next]?.focus();
  return true;
}
