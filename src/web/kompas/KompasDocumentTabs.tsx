import React from 'react';
import type { CadDocumentKind } from '../../contracts/document';
import { KIcon } from './KompasIcon';
import { M, S } from './kompasMenuTypes';
import { anchorOf, kompasShell, useKompasShell } from './kompasShellStore';

const KIND_ICON: Record<CadDocumentKind, string> = {
  part: 'part', assembly: 'collection', drawing: 'linkdraw', fragment: 'linkdraw', specification: 'grid', text: 'textT',
};
/** Document strip: start page, document list, the real document tab and reference tools. */
export function KompasDocumentTabs(props: { kind: CadDocumentKind; title: string; dirty: boolean; sketchMode: boolean }) {
  const shell = useKompasShell();
  const theme = shell.theme;

  React.useLayoutEffect(() => {
    document.documentElement.dataset.kStatus = shell.status ? 'on' : 'off';
    document.documentElement.dataset.kTheme = theme;
  }, [shell.status, theme]);

  return (
    <div className="k-ui k-document-tabs" role="tablist" aria-label="Документы" data-mode={props.sketchMode ? 'sketch' : undefined}>
      <button type="button" className="k-home-btn" data-tip="Начальная страница" aria-label="Начальная страница" onClick={() => kompasShell.toast('Начальной страницы в ASA-CAD пока нет')}><KIcon name="home" size={15} /></button>
      <button
        type="button"
        className="k-home-caret"
        data-k-pop-trigger=""
        data-tip="Список документов"
        aria-label="Список документов"
        onClick={(event) => {
          if (kompasShell.get().pops.length) { kompasShell.closeAll(); return; }
          kompasShell.openPop(0, {
            items: [M(props.title, { i: KIND_ICON[props.kind], ck: () => true }), S, M('Создать...', { i: 'new', id: 'system.new' })],
            anchor: anchorOf(event.currentTarget),
            below: true,
          }, { menu: null, drop: null });
        }}
      ><KIcon name="caret" size={10} /></button>
      <div className="k-doc-tab" role="tab" aria-selected="true" data-document-dirty={props.dirty}>
        <KIcon name={KIND_ICON[props.kind]} size={15} />
        <span className="k-doc-title">{props.title}{props.dirty ? ' *' : ''}</span>
        <button type="button" className="k-tab-x" aria-label="Закрыть документ" data-tip="Закрыть документ" onClick={() => kompasShell.toast('Закрытия вкладок в ASA-CAD пока нет: создайте или откройте документ')}><KIcon name="cross" size={11} /></button>
      </div>
      <div className="k-proto-tools">
        <button type="button" className="k-chip" aria-pressed={shell.status} title="Показать, какие команды уже есть в ASA-CAD" onClick={() => kompasShell.set({ status: !shell.status })}>
          <span className="k-dots"><i style={{ background: 'var(--k-st-impl)' }} /><i style={{ background: 'var(--k-st-plan)' }} /><i style={{ background: 'var(--k-st-def)' }} /></span>
          <span className="k-t">Статус в ASA-CAD</span>
        </button>
        <button type="button" className="k-icon-btn" title="Светлая / тёмная тема" aria-label="Переключить тему" onClick={() => kompasShell.setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <KIcon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
        </button>
      </div>
    </div>
  );
}
