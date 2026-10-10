import React from 'react';
import { KIcon } from './KompasIcon';
import type { KompasMenuLists } from './kompasMenus';
import { KOMPAS_TOOLSETS, type KompasCommand } from './kompasToolsets';
import { anchorOf, kompasShell, useKompasShell } from './kompasShellStore';

interface SearchHit extends KompasCommand { toolset: string }

/** Every command of every toolset once, as the reference search lists them. */
function allCommands(): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const toolset of Object.values(KOMPAS_TOOLSETS)) {
    for (const panel of toolset.panels) {
      for (const column of [...panel.cols, ...(panel.x ?? [])]) {
        for (const command of column) {
          const key = `${command.label}|${command.id ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ ...command, toolset: toolset.label });
        }
      }
    }
  }
  return out;
}
const ALL_COMMANDS = allCommands();

export function focusKompasPop(level: number) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`.k-pop[data-level="${level}"] .k-mi:not([aria-disabled="true"])`)?.focus());
}

/** Main menu strip: app mark, KOMPAS menus (click opens, hover switches), title tools and command search. */
export function KompasMenuBar(props: { names: readonly string[]; lists: KompasMenuLists }) {
  const shell = useKompasShell();
  const nav = React.useRef<HTMLElement>(null);
  const names = props.names;
  const lists = props.lists;

  const open = React.useCallback((name: string) => {
    const button = nav.current?.querySelector(`[data-menu="${name}"]`);
    const factory = lists.menus[name];
    if (!button || !factory) return;
    kompasShell.set({ panelDrop: null });
    kompasShell.openPop(0, { items: factory(), anchor: anchorOf(button), below: true }, { menu: name, drop: null });
  }, [lists]);

  React.useEffect(() => {
    kompasShell.setMenuBar({
      step(direction) {
        const current = names.indexOf(kompasShell.get().menu ?? '');
        const next = names[(current + direction + names.length) % names.length];
        if (next) { open(next); focusKompasPop(0); }
      },
      focus(name) { nav.current?.querySelector<HTMLElement>(`[data-menu="${name}"]`)?.focus(); },
    });
    return () => kompasShell.setMenuBar(null);
  }, [names, open]);

  return (
    <header className="k-ui k-main-menu-bar">
      <div className="k-app-mark" title="ASA-CAD">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#1f6fd1" /><path d="M7 18 12 5.5 17 18M8.9 13.5h6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <nav className="k-main-menu-items" ref={nav} aria-label="Главное меню">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            className="k-menu-item"
            data-menu={name}
            data-k-pop-trigger=""
            aria-haspopup="menu"
            aria-expanded={shell.menu === name}
            onClick={() => (kompasShell.get().menu === name ? kompasShell.closeAll() : open(name))}
            onMouseOver={() => { const menu = kompasShell.get().menu; if (menu && menu !== name) open(name); }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              open(name);
              focusKompasPop(0);
            }}
          >{name}</button>
        ))}
      </nav>
      <div className="k-title-tools">
        <button type="button" data-tip="Раскладка окна" aria-label="Раскладка окна" onClick={() => kompasShell.toast('Раскладка окна в ASA-CAD пока нет')}><KIcon name="layout" size={15} /></button>
        <button type="button" data-tip="Параметры" aria-label="Параметры" onClick={() => kompasShell.set({ dialog: 'settings' })}><KIcon name="gear" size={15} /></button>
      </div>
      <KompasCommandSearch />
    </header>
  );
}

function KompasCommandSearch() {
  const [query, setQuery] = React.useState('');
  const results = React.useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const hits = q ? ALL_COMMANDS.filter((command) => command.label.toLowerCase().includes(q)).slice(0, 9) : [];
  const pick = (hit: SearchHit) => {
    setQuery('');
    if (hit.dis) kompasShell.toast(`«${hit.label}»: ${hit.dis}`);
    else kompasShell.run(hit.id, hit.label);
  };

  return (
    <label className="k-command-search" id="k-command-search">
      <KIcon name="search" size={13} />
      <input
        type="text"
        value={query}
        placeholder="Поиск по командам (Alt+/)"
        aria-label="Поиск по командам"
        autoComplete="off"
        onFocus={() => kompasShell.closeAll()}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); setQuery(''); event.currentTarget.blur(); }
          else if (event.key === 'Enter' && hits[0]) { event.preventDefault(); event.stopPropagation(); pick(hits[0]); }
          else if (event.key === 'ArrowDown' && hits.length) { event.preventDefault(); event.stopPropagation(); results.current?.querySelector('button')?.focus(); }
        }}
      />
      {q && (
        <div className="k-search-results" ref={results} role="listbox" aria-label="Найденные команды">
          {hits.length ? hits.map((hit, index) => (
            <button
              key={`${hit.label}-${index}`}
              type="button"
              role="option"
              aria-selected={false}
              data-command-id={hit.id ?? undefined}
              onClick={(event) => { event.preventDefault(); pick(hit); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setQuery(''); }
                else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  event.stopPropagation();
                  const sibling = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
                  (sibling as HTMLElement | null)?.focus();
                }
              }}
            >
              <KIcon name={hit.icon} size={15} /><span>{hit.label}</span><small>{hit.toolset}</small>
            </button>
          )) : <div className="k-search-empty">Ничего не найдено</div>}
        </div>
      )}
    </label>
  );
}
