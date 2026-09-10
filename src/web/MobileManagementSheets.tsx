import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type MobileSheet = 'tree' | 'parameters' | 'tools' | null;

interface MobileToolDescriptor {
  key: string;
  label: string;
  group: string;
  title: string;
  disabled: boolean;
  source: HTMLButtonElement;
}

function buttonByLabel(root: ParentNode, label: string): HTMLButtonElement | null {
  return [...root.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.replace(/\s+/g, ' ').trim().includes(label)) ?? null;
}

function collectTools(): MobileToolDescriptor[] {
  const ribbon = document.querySelector('.command-ribbon');
  if (!ribbon) return [];
  const descriptors: MobileToolDescriptor[] = [];
  for (const group of ribbon.querySelectorAll<HTMLElement>('.command-group')) {
    const groupLabel = group.querySelector('.command-group-label')?.textContent?.trim() || 'Инструменты';
    for (const [index, button] of [...group.querySelectorAll<HTMLButtonElement>('button')].entries()) {
      const label = button.textContent?.replace(/позже/g, '').replace(/\s+/g, ' ').trim();
      if (!label) continue;
      descriptors.push({
        key: `${groupLabel}:${label}:${index}`,
        label,
        group: groupLabel,
        title: button.title || label,
        disabled: button.disabled,
        source: button,
      });
    }
  }
  return descriptors;
}

export function MobileManagementSheets() {
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [toolRevision, setToolRevision] = useState(0);
  const tools = useMemo(() => collectTools(), [toolRevision, sheet]);
  const mobileBar = typeof document !== 'undefined' ? document.querySelector('.mobile-bottom-bar') : null;

  useEffect(() => {
    const bar = document.querySelector('.mobile-bottom-bar');
    if (!bar) return;
    const treeButton = buttonByLabel(bar, 'Дерево');
    const parametersButton = buttonByLabel(bar, 'Параметры');
    if (!treeButton || !parametersButton) return;

    const openTree = () => setSheet((current) => current === 'tree' ? null : 'tree');
    const openParameters = () => setSheet((current) => current === 'parameters' ? null : 'parameters');
    treeButton.addEventListener('click', openTree);
    parametersButton.addEventListener('click', openParameters);
    return () => {
      treeButton.removeEventListener('click', openTree);
      parametersButton.removeEventListener('click', openParameters);
    };
  }, []);

  useEffect(() => {
    const ribbon = document.querySelector('.command-ribbon');
    if (!ribbon) return;
    const observer = new MutationObserver(() => setToolRevision((value) => value + 1));
    observer.observe(ribbon, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sheet === 'tree' || sheet === 'parameters') {
      document.documentElement.dataset.mobilePanelOpen = sheet;
    } else {
      delete document.documentElement.dataset.mobilePanelOpen;
    }
    return () => delete document.documentElement.dataset.mobilePanelOpen;
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setSheet(null);
    };
    const onResize = () => {
      if (window.innerWidth >= 900) setSheet(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [sheet]);

  const invokeTool = (tool: MobileToolDescriptor) => {
    if (tool.disabled) return;
    tool.source.click();
    setSheet(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const activeParameters = document.querySelector('.management-panel .parameter-panel:not(.empty-parameters)');
        if (activeParameters) setSheet('parameters');
      });
    });
  };

  const overlay = sheet ? createPortal(
    <>
      <button
        type="button"
        className="mobile-panel-backdrop"
        aria-label="Закрыть мобильную панель"
        onClick={() => setSheet(null)}
      />
      {(sheet === 'tree' || sheet === 'parameters') && (
        <button
          type="button"
          className="mobile-management-close"
          aria-label="Закрыть панель"
          onClick={() => setSheet(null)}
        >
          ×
        </button>
      )}
      {sheet === 'tools' && (
        <section className="mobile-tools-sheet" role="dialog" aria-modal="true" aria-label="Инструменты">
          <header>
            <div>
              <strong>Инструменты</strong>
              <span>Текущая рабочая область</span>
            </div>
            <button type="button" aria-label="Закрыть инструменты" onClick={() => setSheet(null)}>×</button>
          </header>
          <div className="mobile-tools-list">
            {tools.length ? tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className="mobile-tool-command"
                disabled={tool.disabled}
                title={tool.title}
                onClick={() => invokeTool(tool)}
              >
                <span>{tool.label}</span>
                <small>{tool.group}</small>
              </button>
            )) : (
              <p>Для этой рабочей области пока нет реализованных команд.</p>
            )}
          </div>
        </section>
      )}
    </>,
    document.body,
  ) : null;

  const toolsButton = mobileBar ? createPortal(
    <button
      type="button"
      className="mobile-tools-button"
      aria-pressed={sheet === 'tools'}
      onClick={() => setSheet((current) => current === 'tools' ? null : 'tools')}
    >
      ⌘<span>Инструменты</span>
    </button>,
    mobileBar,
  ) : null;

  return <>{toolsButton}{overlay}</>;
}
