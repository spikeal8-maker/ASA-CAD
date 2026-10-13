import React from 'react';
import type { CadUiAction } from '../CadUiAction';
import type { CadShellTopProps } from '../CadShellTop';
import { KompasDocumentTabs } from './KompasDocumentTabs';
import { KompasMenuBar, focusKompasPop } from './KompasMenuBar';
import { KompasPopups } from './KompasPopups';
import { KompasRibbon } from './KompasRibbon';
import { KompasTooltip } from './KompasTooltip';
import { kompasMenus, KOMPAS_PART_MENU, KOMPAS_SKETCH_MENU } from './kompasMenus';
import type { KompasViewName } from './kompasMenuTypes';
import type { KompasToolsetId } from './kompasToolsets';
import { KOMPAS_STATUS_TEXT, kompasShell, useKompasShell, type KompasCommandResolver, type KompasCommandStatus } from './kompasShellStore';

const VIEW_ACTIONS: Partial<Record<KompasViewName, string>> = {
  front: 'view.front', back: 'view.back', top: 'view.top', bottom: 'view.bottom', left: 'view.left', right: 'view.right', iso: 'view.iso',
};

function lookup(getAction: (id: string) => CadUiAction, id: string | null): CadUiAction | null {
  if (!id) return null;
  try { return getAction(id); } catch { return null; }
}

/**
 * Top of the KOMPAS shell (frozen reference #170): main menu, document strip and
 * instrument area. Every button resolves to the product typed action with the
 * same registry id; commands that ASA-CAD does not have yet explain their status.
 */
export function KompasTop(props: CadShellTopProps) {
  const { getAction } = props;
  const [toolset, setToolset] = React.useState<KompasToolsetId>('solid');
  const previous = React.useRef<KompasToolsetId>('solid');
  const shell = useKompasShell();
  const sketchMode = shell.sketchMode;

  React.useEffect(() => { kompasShell.set({ toolset }); }, [toolset]);

  React.useLayoutEffect(() => {
    setToolset((current) => {
      if (sketchMode) { if (current !== 'sketch') previous.current = current; return 'sketch'; }
      return current === 'sketch' ? previous.current : current;
    });
  }, [sketchMode]);

  const resolver = React.useMemo<KompasCommandResolver>(() => ({
    status(id) {
      const action = lookup(getAction, id);
      if (!action) return 'none';
      return (action.status === 'experimental' ? 'implemented' : action.status) as KompasCommandStatus;
    },
    unavailable(id) {
      const action = lookup(getAction, id);
      return action && !action.enabled ? action.disabledReason ?? 'Команда сейчас недоступна' : undefined;
    },
    run(id, label) {
      const target = id === 'part.sketch.create' && sketchMode ? 'sketch.finish' : id;
      const action = lookup(getAction, target);
      if (!action) { kompasShell.toast(`«${label}»: ${KOMPAS_STATUS_TEXT.none}`); return; }
      if (!action.enabled) { kompasShell.toast(`«${label}»: ${action.disabledReason ?? KOMPAS_STATUS_TEXT[resolver.status(target)]}`); return; }
      void action.execute();
    },
  }), [getAction, sketchMode]);
  kompasShell.setResolver(resolver);

  const canUndo = lookup(getAction, 'system.undo')?.enabled ?? false;
  const canRedo = lookup(getAction, 'system.redo')?.enabled ?? false;
  const lists = React.useMemo(() => kompasMenus({
    canUndo,
    canRedo,
    get panelsOpen() { return kompasShell.get().panelOpen; },
    fit: () => resolver.run('view.fit', 'Показать все'),
    zoom: () => kompasShell.toast('Масштабируйте колесом мыши: команды масштаба в меню ASA-CAD пока нет'),
    view: (name) => { const id = VIEW_ACTIONS[name]; if (id) resolver.run(id, name); else kompasShell.toast('Диметрии в ASA-CAD пока нет'); },
    normal: () => kompasShell.hooks.normal?.(),
    refreshView: () => kompasShell.toast('Изображение обновлено'),
    togglePanels: () => kompasShell.requestPanel('toggle'),
    showTab: (tab) => kompasShell.requestPanel(tab),
    openSettings: () => kompasShell.set({ dialog: 'settings' }),
    openAbout: () => kompasShell.set({ dialog: 'about' }),
    openDocInfo: () => kompasShell.set({ dialog: 'docinfo' }),
  }), [canUndo, canRedo, resolver]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === '/' || event.code === 'Slash')) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('#k-command-search input')?.focus();
      } else if (event.key === 'F10' && !kompasShell.get().pops.length) {
        event.preventDefault();
        document.querySelector<HTMLElement>('.k-main-menu-items [data-menu="Файл"]')?.click();
        focusKompasPop(0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <KompasMenuBar names={sketchMode ? KOMPAS_SKETCH_MENU : KOMPAS_PART_MENU} lists={lists} />
      <KompasDocumentTabs kind={props.documentKind} title={props.documentTitle} dirty={props.dirty} sketchMode={sketchMode} />
      <KompasRibbon toolset={toolset} setToolset={setToolset} activeCommand={shell.activeCommand} />
      <KompasPopups />
      <KompasTooltip />
    </>
  );
}
