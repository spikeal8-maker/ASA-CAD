import { useSyncExternalStore } from 'react';
import type { KompasMenuEntry, KompasPanelTab, KompasViewName } from './kompasMenuTypes';

export interface KompasAnchor { left: number; top: number; right: number; bottom: number; width: number }

/** One open popup level: a main menu, submenu, quick-access list or command variants. */
export interface KompasPopLevel {
  items: KompasMenuEntry[];
  anchor: KompasAnchor;
  /** Drop below the anchor (lists, variants); submenus open to the right. */
  below: boolean;
  /** Orientation grid of the «Ориентация» list. */
  onView?: (view: KompasViewName) => void;
  minWidth?: number;
  /** Accessible name: the main menu that opened this list. */
  label?: string;
  /** Index of the item in the previous level that opened this submenu. */
  parent?: number;
}

export type KompasDialog = 'settings' | 'about' | 'docinfo' | null;

export interface KompasShellState {
  pops: KompasPopLevel[];
  /** Main menu whose popup is open (hover over a neighbour switches it). */
  menu: string | null;
  /** Quick-access list whose popup is open. */
  drop: string | null;
  /** Ribbon panel expanded by ▾: index inside the active toolset. */
  panelDrop: number | null;
  toast: { text: string; seq: number } | null;
  panelRequest: { tab: KompasPanelTab | 'toggle'; seq: number } | null;
  /** «Статус в ASA-CAD»: status marks on commands. */
  status: boolean;
  dialog: KompasDialog;
  theme: 'light' | 'dark';
  /** Management panel open (written by the work-area region for the «Настройка → Панели» menu). */
  panelOpen: boolean;
  /** Registry id of the product command in progress (pressed ribbon button). */
  activeCommand: string | null;
  /** Active toolset of the instrument area (legend counts). */
  toolset: 'solid' | 'surfaces' | 'sketch';
  /** A sketch is open for editing (written by the work-area region). */
  sketchMode: boolean;
}

export type KompasCommandStatus = 'implemented' | 'planned' | 'deferred' | 'none';
export const KOMPAS_STATUS_TEXT: Record<KompasCommandStatus, string> = {
  implemented: 'в ASA-CAD реализовано',
  planned: 'в ASA-CAD запланировано',
  deferred: 'в ASA-CAD отложено',
  none: 'в реестре ASA-CAD нет',
};

/** Bridge from shell buttons to the product's typed actions (installed by the top region). */
export interface KompasCommandResolver {
  run(id: string | null, label: string): void;
  status(id: string | null): KompasCommandStatus;
  /** Why an implemented command cannot run right now; undefined when it can. */
  unavailable(id: string | null): string | undefined;
}

const NO_RESOLVER: KompasCommandResolver = { run: () => undefined, status: () => 'none', unavailable: () => undefined };

const THEME_KEY = 'asa-cad.kompas-theme';
function storedTheme(): 'light' | 'dark' {
  try { return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

let state: KompasShellState = {
  pops: [], menu: null, drop: null, panelDrop: null, toast: null, panelRequest: null, status: false, dialog: null,
  theme: storedTheme(), panelOpen: true, activeCommand: null, toolset: 'solid', sketchMode: false,
};
/** Work-area callbacks the menus reuse (set by the region that owns the data). */
const hooks: { normal?: () => void } = {};
let resolver: KompasCommandResolver = NO_RESOLVER;
let menuBar: { step(direction: number): void; focus(name: string): void } | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function set(patch: Partial<KompasShellState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/**
 * Shell-only UI state shared by the KOMPAS top, work area and bottom regions
 * (popups, toast, status marks). Document and command state stay in the product.
 */
export const kompasShell = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  set,
  toast(text: string) { set({ toast: { text, seq: ++seq } }); },
  openPop(level: number, pop: KompasPopLevel, owner: { menu?: string | null; drop?: string | null } = {}) {
    set({ pops: [...state.pops.slice(0, level), pop], ...('menu' in owner ? { menu: owner.menu } : {}), ...('drop' in owner ? { drop: owner.drop } : {}) });
  },
  closePops(from = 0) {
    if (from > 0) set({ pops: state.pops.slice(0, from) });
    else if (state.pops.length || state.menu || state.drop) set({ pops: [], menu: null, drop: null });
  },
  closeAll() {
    if (state.pops.length || state.menu || state.drop || state.panelDrop !== null) set({ pops: [], menu: null, drop: null, panelDrop: null });
  },
  requestPanel(tab: KompasPanelTab | 'toggle') { set({ panelRequest: { tab, seq: ++seq } }); },
  /** Light is the product default; the dark token set comes from the reference. */
  setTheme(theme: 'light' | 'dark') {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* storage may be blocked */ }
    set({ theme });
  },
  setResolver(next: KompasCommandResolver | null) { resolver = next ?? NO_RESOLVER; },
  get commands(): KompasCommandResolver { return resolver; },
  setMenuBar(next: typeof menuBar) { menuBar = next; },
  get menuBar() { return menuBar; },
  hooks,
  /** Runs a registry command through the product actions (or explains why it cannot run). */
  run(id: string | null, label: string) {
    kompasShell.closeAll();
    resolver.run(id, label);
  },
};

export function useKompasShell(): KompasShellState {
  return useSyncExternalStore(kompasShell.subscribe, kompasShell.get, kompasShell.get);
}

export function anchorOf(element: Element): KompasAnchor {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width };
}
