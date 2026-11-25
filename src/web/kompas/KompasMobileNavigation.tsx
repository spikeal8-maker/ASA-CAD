import React from 'react';
import type { CadShellPanel } from '../CadShellMain';
import { KIcon } from './KompasIcon';

const NAV: ReadonlyArray<{ id: Exclude<CadShellPanel, 'closed'>; label: string; icon: string }> = [
  { id: 'tree', label: 'Дерево', icon: 'tree' },
  { id: 'parameters', label: 'Параметры', icon: 'params' },
  { id: 'tools', label: 'Инструменты', icon: 'ts_solid' },
];

/** Narrow-screen layout of the same #170 product shell, not the retired ASA UI. */
export function KompasMobileNavigation(props: {
  activePanel: CadShellPanel;
  setActivePanel(panel: CadShellPanel): void;
}) {
  return (
    <nav className="k-ui k-mobile-navigation" aria-label="Мобильные панели" data-testid="kompas-mobile-navigation">
      {NAV.map(({ id, label, icon }) => (
        <button key={id} type="button" className="k-mobile-nav-btn" aria-pressed={props.activePanel === id}
          onClick={() => props.setActivePanel(props.activePanel === id ? 'closed' : id)}>
          <KIcon name={icon} size={18} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
