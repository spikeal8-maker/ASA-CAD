/* Типы и помощники главного меню КОМПАС-оболочки. */
export const S = '-' as const;
export interface KompasMenuItem {
  l: string;
  i?: string;
  k?: string;
  id?: string | null;
  d?: boolean;
  s?: () => KompasMenuEntry[];
  a?: () => void;
  on?: () => boolean;
  ck?: () => boolean;
  keep?: boolean;
}
export type KompasMenuEntry = KompasMenuItem | typeof S;
export type KompasViewName = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'iso' | 'dim';
export type KompasPanelTab = 'tree' | 'params' | 'vars' | 'libs';

/** Product state and shell actions the menus read; commands go through their registry id. */
export interface KompasMenuContext {
  canUndo: boolean;
  canRedo: boolean;
  panelsOpen: boolean;
  fit(): void;
  zoom(direction: 'in' | 'out'): void;
  view(name: KompasViewName): void;
  normal(): void;
  refreshView(): void;
  togglePanels(): void;
  showTab(tab: KompasPanelTab): void;
  openSettings(): void;
  openAbout(): void;
  openDocInfo(): void;
}

export const M = (l: string, o: Omit<KompasMenuItem, 'l'> = {}): KompasMenuItem => ({ l, ...o });
export const leaf = (list: ReadonlyArray<string | KompasMenuEntry>): KompasMenuEntry[] => list.map((l) => typeof l === 'string' ? (l === S ? S : M(l)) : l);
export const NOT_CAPTURED = (): KompasMenuEntry[] => [M('Содержимое подменю не снято с эталона', { d: true })];

