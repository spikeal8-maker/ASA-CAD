import React from 'react';
import { createPortal } from 'react-dom';
import { KIcon } from './KompasIcon';
import { M, S, type KompasMenuEntry } from './kompasMenuTypes';
import { kompasModelingMenu } from './kompasModelingMenus';
import { KOMPAS_MORE_TOOLSETS, KOMPAS_TOOLSETS, type KompasCommand, type KompasPanel, type KompasToolsetId, type KompasVariantKey } from './kompasToolsets';
import { anchorOf, kompasShell, useKompasShell } from './kompasShellStore';

const TOOLSET_ORDER: readonly KompasToolsetId[] = ['solid', 'surfaces', 'sketch'];

/* Варианты команды по ◢ — те же пункты, что в меню «Моделирование». */
function submenuOf(label: string): KompasMenuEntry[] {
  const item = kompasModelingMenu().find((entry) => entry !== S && entry.l === label);
  return item && item !== S && item.s ? item.s() : [];
}
const VARIANTS: Record<KompasVariantKey, () => KompasMenuEntry[]> = {
  add: () => submenuOf('Добавить элемент'),
  cut: () => submenuOf('Вырезать элемент'),
  hole: () => submenuOf('Отверстия'),
  arrays: () => submenuOf('Массивы'),
  planes: () => submenuOf('Плоскости'),
  axes: () => submenuOf('Оси'),
  fillet: () => submenuOf('Дополнительные элементы').filter((entry) => entry !== S && /^(Скругление|Фаска)$/.test(entry.l)),
  draft: () => submenuOf('Дополнительные элементы').filter((entry) => entry !== S && /Уклон/.test(entry.l)),
};

function openVariants(button: Element, key: KompasVariantKey) {
  kompasShell.closePops(0);
  kompasShell.openPop(0, { items: VARIANTS[key](), anchor: anchorOf(button), below: true }, { menu: null, drop: null });
  requestAnimationFrame(() => document.querySelector<HTMLElement>('.k-pop[data-level="0"] .k-mi:not([aria-disabled="true"])')?.focus({ preventScroll: true }));
}

export interface KompasRibbonProps {
  toolset: KompasToolsetId;
  setToolset(toolset: KompasToolsetId): void;
  /** Registry id of the command in progress (pressed button). */
  activeCommand: string | null;
}

/** Instrument area: toolset column and the panels of the active toolset. */
export function KompasRibbon(props: KompasRibbonProps) {
  const shell = useKompasShell();
  const ribbon = React.useRef<HTMLDivElement>(null);
  const panels = KOMPAS_TOOLSETS[props.toolset].panels;

  React.useEffect(() => {
    const element = ribbon.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && element.scrollWidth > element.clientWidth) {
        element.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <section className="k-ui k-instrument-area" aria-label="Инструментальная область">
      <div className="k-toolsets" role="toolbar" aria-label="Наборы инструментов">
        {TOOLSET_ORDER.map((id) => (
          <button key={id} type="button" className="k-toolset" data-toolset={id} aria-pressed={props.toolset === id} onClick={() => { kompasShell.set({ panelDrop: null }); props.setToolset(id); }}>
            <KIcon name={KOMPAS_TOOLSETS[id].icon} size={16} /><span>{KOMPAS_TOOLSETS[id].label}</span>
          </button>
        ))}
        <button
          type="button"
          className="k-toolset-more"
          data-k-pop-trigger=""
          data-tip="Другие наборы инструментов"
          aria-label="Другие наборы инструментов"
          aria-haspopup="menu"
          onClick={(event) => {
            if (kompasShell.get().pops.length) { kompasShell.closeAll(); return; }
            kompasShell.set({ panelDrop: null });
            kompasShell.openPop(0, {
              items: KOMPAS_MORE_TOOLSETS.map((name) => M(name, { i: 'ts_generic', a: () => kompasShell.toast(`Набора «${name}» в ASA-CAD пока нет`) })),
              anchor: anchorOf(event.currentTarget),
              below: true,
            }, { menu: null, drop: null });
          }}
        ><KIcon name="caret" size={10} /></button>
      </div>
      <div className="k-command-ribbon" ref={ribbon} role="toolbar" aria-label="Панели набора" onScroll={() => kompasShell.get().panelDrop !== null && kompasShell.set({ panelDrop: null })}>
        {panels.map((panel, index) => (
          <section key={`${props.toolset}-${index}`} className="k-cmd-panel" data-pi={index} aria-label={panel.label}>
            <div className="k-cmd-panel-body">
              {panel.cols.map((column, columnIndex) => (
                <div key={columnIndex} className="k-cmd-col">
                  {column.map((command) => <CommandButton key={`${command.label}-${command.id}`} command={command} activeCommand={props.activeCommand} />)}
                </div>
              ))}
            </div>
            <PanelLabel panel={panel} index={index} expanded={false} />
          </section>
        ))}
      </div>
      {shell.panelDrop !== null && panels[shell.panelDrop] && (
        <PanelDrop panel={panels[shell.panelDrop]!} index={shell.panelDrop} ribbon={ribbon.current} activeCommand={props.activeCommand} />
      )}
    </section>
  );
}

function PanelLabel(props: { panel: KompasPanel; index: number; expanded: boolean }) {
  const { panel, expanded } = props;
  return (
    <div className="k-cmd-panel-label" data-tip={panel.label}>
      <span>{panel.label}</span>
      {panel.x && (
        <button
          type="button"
          className="k-caret-btn"
          data-k-pop-trigger=""
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Свернуть' : 'Показать все команды'} панели «${panel.label}»`}
          data-tip={expanded ? 'Свернуть панель' : 'Показать все команды панели'}
          onClick={(event) => {
            event.stopPropagation();
            kompasShell.closePops(0);
            kompasShell.set({ panelDrop: expanded ? null : props.index });
          }}
        ><KIcon name="caret" size={9} className="k-caret" /></button>
      )}
      <i className="k-grip" />
    </div>
  );
}

/** ▾: the panel grows down and shows the commands KOMPAS hides in the collapsed panel; ▲ collapses. */
function PanelDrop(props: { panel: KompasPanel; index: number; ribbon: HTMLElement | null; activeCommand: string | null }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const section = props.ribbon?.querySelector(`.k-cmd-panel[data-pi="${props.index}"]`);
  const box = section?.getBoundingClientRect();
  const columns = props.panel.cols.map((column, index) => [...column, ...(props.panel.x?.[index] ?? [])]);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !box) return;
    element.style.left = `${Math.max(4, Math.min(box.left - 1, window.innerWidth - element.offsetWidth - 4))}px`;
    element.style.top = `${box.top - 1}px`;
    element.querySelector('button')?.focus({ preventScroll: true });
  }, [box?.left, box?.top]);

  React.useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.k-panel-drop, .k-pop, [data-k-pop-trigger]')) return;
      kompasShell.set({ panelDrop: null });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !kompasShell.get().pops.length) { event.stopPropagation(); kompasShell.set({ panelDrop: null }); }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  if (!box) return null;
  return createPortal(
    <div ref={ref} className="k-ui k-panel-drop" role="group" aria-label={`${props.panel.label}: все команды`} style={{ minWidth: box.width + 2 }}>
      <div className="k-cmd-panel-body">
        {columns.map((column, index) => (
          <div key={index} className="k-cmd-col">
            {column.map((command) => <CommandButton key={`${command.label}-${command.id}`} command={command} activeCommand={props.activeCommand} />)}
          </div>
        ))}
      </div>
      <PanelLabel panel={props.panel} index={props.index} expanded />
    </div>,
    document.body,
  );
}

/** A reference command button over the product action of the same registry id. */
function CommandButton(props: { command: KompasCommand; activeCommand: string | null }) {
  const { command } = props;
  const commands = kompasShell.commands;
  const status = commands.status(command.id);
  const unavailable = command.dis ?? (status === 'implemented' ? commands.unavailable(command.id) : undefined);
  const pressed = Boolean(command.id && command.id === props.activeCommand);
  return (
    <button
      type="button"
      className={`k-btn-${command.kind}${pressed ? ' k-on' : ''}${unavailable ? ' k-dim' : ''}`}
      data-command-id={command.id ?? undefined}
      data-st={status}
      data-tip={command.label}
      data-dis={unavailable}
      aria-disabled={unavailable ? true : undefined}
      aria-pressed={pressed || undefined}
      aria-label={`${command.label}${command.v ? ' (есть варианты: правая кнопка или ◢)' : ''}`}
      onClick={(event) => {
        if ((event.target as Element).closest('.k-var') && command.v) { openVariants(event.currentTarget, command.v); return; }
        if (unavailable) { kompasShell.closeAll(); kompasShell.toast(`«${command.label}»: ${unavailable}`); return; }
        kompasShell.run(command.id, command.label);
      }}
      onContextMenu={(event) => {
        if (!command.v) return;
        event.preventDefault();
        openVariants(event.currentTarget, command.v);
      }}
    >
      <KIcon name={command.icon} size={16} />
      {command.kind === 't' && <span>{command.label}</span>}
      {command.v && <span className="k-var" data-k-pop-trigger="" data-tip="Варианты команды" />}
    </button>
  );
}
