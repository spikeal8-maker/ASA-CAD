import React from 'react';
import { createPortal } from 'react-dom';
import { KIcon } from './KompasIcon';
import { S, type KompasMenuEntry, type KompasMenuItem, type KompasViewName } from './kompasMenuTypes';
import { anchorOf, kompasShell, useKompasShell, type KompasPopLevel } from './kompasShellStore';

const VIEW_CELLS: ReadonlyArray<readonly [KompasViewName, string, string] | null> = [
  null, ['top', 'Сверху', 'v_top'], null, null,
  ['left', 'Слева', 'v_left'], ['front', 'Спереди', 'v_front'], ['right', 'Справа', 'v_right'], ['back', 'Сзади', 'v_back'],
  null, ['bottom', 'Снизу', 'v_bottom'],
];

function popElement(level: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.k-pop[data-level="${level}"]`);
}

function focusFirst(level: number) {
  requestAnimationFrame(() => popElement(level)?.querySelector<HTMLElement>('.k-mi:not([aria-disabled="true"])')?.focus());
}

function openSub(level: number, index: number, item: KompasMenuItem, button: Element) {
  if (!item.s) return;
  kompasShell.openPop(level + 1, { items: item.s(), anchor: anchorOf(button), below: false, parent: index });
}

/** Menu item activation exactly as in the reference: submenu, toggle that keeps the list, shell action or command. */
function activate(level: number, index: number, item: KompasMenuItem, button: Element, refresh: () => void) {
  if (item.d) return;
  if (item.s) {
    openSub(level, index, item, button);
    focusFirst(level + 1);
    return;
  }
  if (item.keep) {
    item.a?.();
    refresh();
    return;
  }
  kompasShell.closeAll();
  if (item.a) item.a();
  else if (item.id) kompasShell.commands.run(item.id, item.l);
  else kompasShell.toast(`«${item.l}»: в ASA-CAD пока нет`);
}

function handlePopKey(event: KeyboardEvent, pops: readonly KompasPopLevel[], refresh: () => void) {
  const level = pops.length - 1;
  const element = popElement(level);
  const pop = pops[level];
  if (!element || !pop) return;
  const buttons = Array.from(element.querySelectorAll<HTMLElement>('.k-mi:not([aria-disabled="true"])'));
  const current = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>('.k-mi') : null;
  const inside = current && element.contains(current);
  const index = inside ? buttons.indexOf(current) : -1;
  const item = inside ? pop.items[Number(current.dataset.idx)] : undefined;
  const back = () => {
    kompasShell.closePops(level);
    popElement(level - 1)?.querySelector<HTMLElement>(`.k-mi[data-idx="${pop.parent}"]`)?.focus();
  };
  const menu = kompasShell.get().menu;
  let handled = true;
  switch (event.key) {
    case 'ArrowDown': if (buttons.length) buttons[(index + 1) % buttons.length]?.focus(); break;
    case 'ArrowUp': if (buttons.length) buttons[(index - 1 + buttons.length) % buttons.length]?.focus(); break;
    case 'ArrowRight':
      if (item && item !== S && item.s && !item.d && current) { openSub(level, Number(current.dataset.idx), item, current); focusFirst(level + 1); }
      else if (menu) kompasShell.menuBar?.step(1);
      break;
    case 'ArrowLeft':
      if (level > 0) back(); else if (menu) kompasShell.menuBar?.step(-1);
      break;
    case 'Escape':
      if (level > 0) back();
      else { kompasShell.closeAll(); if (menu) kompasShell.menuBar?.focus(menu); }
      break;
    case 'Enter':
    case ' ':
      if (item && item !== S && current) activate(level, Number(current.dataset.idx), item, current, refresh);
      break;
    case 'Tab': kompasShell.closeAll(); handled = false; break;
    default: handled = false;
  }
  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/** All open popup levels of the KOMPAS shell, rendered above the application. */
export function KompasPopups() {
  const shell = useKompasShell();
  const [, refresh] = React.useReducer((value: number) => value + 1, 0);
  const pops = shell.pops;

  React.useEffect(() => {
    if (!pops.length) return;
    const onKey = (event: KeyboardEvent) => handlePopKey(event, kompasShell.get().pops, refresh);
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.k-pop, [data-k-pop-trigger]')) return;
      kompasShell.closePops(0);
    };
    const onResize = () => kompasShell.closeAll();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pops.length]);

  return createPortal(
    <div className="k-ui k-pop-layer">
      {pops.map((pop, level) => (
        <PopLevel key={level} pop={pop} level={level} openChild={pops[level + 1]?.parent} refresh={refresh} />
      ))}
    </div>,
    document.body,
  );
}

function PopLevel(props: { pop: KompasPopLevel; level: number; openChild?: number; refresh(): void }) {
  const { pop, level } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const hoverTimer = React.useRef(0);
  const [place, setPlace] = React.useState<{ left: number; top: number; maxHeight?: number }>({ left: -9999, top: -9999 });

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { anchor } = pop;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    const sub = level > 0 && !pop.below;
    let left = sub ? anchor.right - 2 : anchor.left;
    let top = sub ? anchor.top - 2 : anchor.bottom;
    let maxHeight: number | undefined;
    if (left + w > vw - 4) left = sub ? Math.max(4, anchor.left - w + 2) : Math.max(4, vw - 4 - w);
    if (top + h > vh - 4) {
      if (sub) top = Math.max(4, vh - 4 - h);
      else if (vh - 4 - top >= 160) maxHeight = vh - 4 - top;
      else top = Math.max(4, vh - 4 - h);
    }
    if (h > vh - 8) { maxHeight = vh - 8; top = Math.min(top, 4); }
    setPlace({ left, top, maxHeight });
  }, [pop, level]);

  React.useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const onHover = (event: React.MouseEvent) => {
    const button = (event.target as Element).closest<HTMLElement>('.k-mi');
    if (!button) return;
    const index = Number(button.dataset.idx);
    const item = pop.items[index];
    window.clearTimeout(hoverTimer.current);
    const opensSub = item && item !== S && item.s && !item.d;
    hoverTimer.current = window.setTimeout(() => {
      if (kompasShell.get().pops[level] !== pop) return;
      if (opensSub) { if (props.openChild !== index) openSub(level, index, item, button); }
      else kompasShell.closePops(level + 1);
    }, opensSub ? 120 : 220);
  };

  return (
    <div
      ref={ref}
      className={`k-pop${pop.onView ? ' k-views' : ''}`}
      role="menu"
      aria-label={pop.label}
      data-level={level}
      style={{ left: place.left, top: place.top, maxHeight: place.maxHeight, minWidth: pop.minWidth }}
      onMouseOver={onHover}
      onClick={(event) => {
        event.stopPropagation();
        const button = (event.target as Element).closest<HTMLElement>('.k-mi');
        const item = button ? pop.items[Number(button.dataset.idx)] : undefined;
        if (button && item && item !== S) activate(level, Number(button.dataset.idx), item, button, props.refresh);
      }}
    >
      {pop.onView && (
        <div className="k-view-grid">
          {VIEW_CELLS.map((cell, index) => cell ? (
            <button key={cell[0]} type="button" aria-label={cell[1]} data-tip={cell[1]} data-command-id={`view.${cell[0]}`} onClick={(event) => {
              event.stopPropagation();
              kompasShell.closeAll();
              pop.onView?.(cell[0]);
            }}><KIcon name={cell[2]} size={17} /></button>
          ) : <span key={`gap-${index}`} />)}
        </div>
      )}
      {pop.items.map((item, index) => item === S
        ? <hr key={index} />
        : <MenuItem key={index} item={item} index={index} open={props.openChild === index} />)}
    </div>
  );
}

function MenuItem(props: { item: KompasMenuItem; index: number; open: boolean }) {
  const { item } = props;
  const on = item.on?.() ?? false;
  const checked = item.ck?.();
  const status = item.id ? kompasShell.commands.status(item.id) : item.s || item.a ? undefined : 'none';
  const icon = item.i
    ? on ? <span className="k-mi-on"><KIcon name={item.i} size={15} /></span> : <KIcon name={item.i} size={15} />
    : checked ? <span className="k-mi-ck">✓</span> : <span />;
  const checkable = item.ck !== undefined || item.on !== undefined;
  return (
    <button
      type="button"
      className={`k-mi${props.open ? ' k-open' : ''}`}
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? Boolean(checked ?? on) : undefined}
      aria-disabled={item.d ? true : undefined}
      aria-haspopup={item.s ? 'menu' : undefined}
      aria-expanded={item.s ? props.open : undefined}
      data-idx={props.index}
      data-st={status}
      data-command-id={item.id ?? undefined}
      aria-label={item.l}
      aria-keyshortcuts={item.k}
    >
      {icon}
      <span className="k-mi-l">{item.l}</span>
      <span className="k-mi-k">{item.k ?? ''}</span>
      <span className="k-mi-ar">{item.s ? '▶' : ''}</span>
    </button>
  );
}

export type { KompasMenuEntry };
