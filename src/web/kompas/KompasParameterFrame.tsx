import React from 'react';
import { KIcon } from './KompasIcon';
import { kompasShell } from './kompasShellStore';

export const parameterNotYet = (what: string) => () => kompasShell.toast(`${what} в ASA-CAD пока нет`);

export function KompasParameterHead() {
  return (
    <div className="k-panel-head">
      <span>Параметры</span>
      <button type="button" aria-label="Настройки панели" onClick={parameterNotYet('Настроек панели')}><KIcon name="gear" size={14} /></button>
    </div>
  );
}

export function KompasParameterFrame(props: React.PropsWithChildren<{
  title: string; icon: string; tabs?: readonly string[]; data?: Record<string, string>;
  canCommit: boolean; commitLabel?: string; onCommit(): void; onCancel(): void; message: string; error?: boolean;
}>) {
  return (
    <div className="k-params-panel k-pp" data-command-title={props.title} {...props.data}>
      <KompasParameterHead />
      <div className="k-pp-cmd">
        <strong>{props.title}</strong>
        <button type="button" aria-label="Справка" onClick={parameterNotYet('Справки')}><KIcon name="helpq" size={16} /></button>
        <button type="button" aria-label="Показать дерево" onClick={() => kompasShell.requestPanel('tree')}><KIcon name="tree" size={16} /></button>
      </div>
      <div className="k-pp-tabs">
        <button type="button" className="k-tab" aria-selected="true" title={props.title}><KIcon name={props.icon} size={17} /></button>
        {(props.tabs ?? []).map((icon) => (
          <button key={icon} type="button" className="k-tab" aria-selected="false" title="Вкладка не заполнена" onClick={parameterNotYet('Этой вкладки')}><KIcon name={icon} size={17} /></button>
        ))}
        <span className="k-spacer" />
        <button type="button" className="k-pp-ok" data-param-commit="" disabled={!props.canCommit} data-tip={`${props.commitLabel ?? 'Создать объект'} (Enter)`} aria-label={props.commitLabel ?? 'Создать объект'} onClick={props.onCommit}><KIcon name="check" size={20} /></button>
        <button type="button" className="k-pp-cancel" data-param-cancel="" data-tip="Прервать команду (Esc)" aria-label="Прервать команду" onClick={props.onCancel}><KIcon name="cross" size={18} /></button>
      </div>
      <div className="k-pp-body">{props.children}</div>
      <div className="k-pp-msg" role={props.error ? 'alert' : 'status'}>
        <KIcon name="bubble" size={16} /><span>{props.message}</span>
        <button type="button" aria-label="Скрыть сообщение" onClick={parameterNotYet('Скрытия сообщения')}><KIcon name="cross" size={11} /></button>
      </div>
    </div>
  );
}
