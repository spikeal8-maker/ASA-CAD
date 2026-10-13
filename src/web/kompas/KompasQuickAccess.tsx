import React from 'react';
import { KIcon } from './KompasIcon';
import { M, type KompasMenuEntry, type KompasViewName } from './kompasMenuTypes';
import type { KompasMenuLists } from './kompasMenus';
import { anchorOf, kompasShell, useKompasShell } from './kompasShellStore';

export interface KompasQuickAccessProps {
  sketch: boolean;
  lists: KompasMenuLists;
  view(name: KompasViewName): void;
  fit(): void;
  normal(): void;
  /** A product command waits for ✓ / ✗. */
  commandActive: boolean;
  commit(): void;
  cancel(): void;
}

const NOT_YET = (label: string) => () => kompasShell.toast(`«${label}» в ASA-CAD пока нет`);

/** Quick-access toolbar of the graphics area: 16 buttons, widths 26/47 as in layout.json v25. */
export function KompasQuickAccess(props: KompasQuickAccessProps) {
  const shell = useKompasShell();
  const drops: Record<string, () => KompasMenuEntry[]> = {
    zoom: props.lists.zoom,
    display: () => props.lists.display(false),
    hide: props.lists.hide,
    vis: props.lists.vis,
    section: () => [M('Управление сечениями...', { i: 'sectionview' })],
    filter: props.lists.filter,
    grid: () => [M('Показывать сетку'), M('Шаг — по масштабу вида', { d: true })],
    views: () => [M('Изометрия', { i: 'orient', a: () => props.view('iso') }), M('Диметрия', { i: 'orient', a: () => props.view('dim') }), '-', M('Настройка', { i: 'gear' })],
  };

  const openDrop = (key: string, button: HTMLElement) => {
    if (shell.drop === key) { kompasShell.closeAll(); return; }
    kompasShell.closeAll();
    const anchor = anchorOf(button.parentElement ?? button);
    kompasShell.openPop(0, {
      items: drops[key]!(),
      anchor,
      below: true,
      onView: key === 'views' ? props.view : undefined,
    }, { menu: null, drop: key });
  };

  const B = (key: string, icon: string, label: string, run: () => void, opts: { on?: boolean; pressed?: boolean; className?: string; commandId?: string } = {}) => (
    <button
      key={key}
      type="button"
      className={`k-qa-b${opts.on ? ' k-on' : ''}${opts.className ? ` ${opts.className}` : ''}`}
      data-qa={key}
      data-tip={label}
      data-command-id={opts.commandId}
      aria-label={label}
      aria-pressed={opts.pressed}
      onClick={run}
    ><KIcon name={icon} size={16} /></button>
  );
  const SB = (key: string, icon: string, label: string, run: () => void, drop: string, opts: { on?: boolean; pressed?: boolean; w46?: boolean; commandId?: string } = {}) => (
    <div key={key} className={`k-qa-split${opts.w46 ? ' k-w46' : ''}`}>
      {B(key, icon, label, run, opts)}
      <button
        type="button"
        className="k-qa-caret"
        data-k-pop-trigger=""
        data-qdrop={drop}
        aria-haspopup="menu"
        aria-expanded={shell.drop === drop}
        aria-label={`${label}: варианты`}
        data-tip={`${label}: варианты`}
        onClick={(event) => openDrop(drop, event.currentTarget)}
      ><KIcon name="caret" size={8} /></button>
    </div>
  );
  const sep = (key: string) => <span key={key} className="k-qa-sep" />;

  const items: React.ReactNode[] = [<span key="grip" className="k-qgrip" aria-hidden="true" />];
  items.push(B('sketch', 'ts_sketch', props.sketch ? 'Выйти из эскиза' : 'Создать эскиз',
    () => kompasShell.run('part.sketch.create', props.sketch ? 'Выйти из эскиза' : 'Создать эскиз'),
    { className: props.sketch ? 'k-sk-on' : undefined, pressed: props.sketch, commandId: props.sketch ? 'sketch.finish' : 'part.sketch.create' }));
  if (props.sketch) {
    items.push(B('cons', 'showcons', 'Показать ограничения', NOT_YET('Показ ограничений'), { on: true }));
    items.push(SB('grid', 'grid', 'Сетка', NOT_YET('Сетка'), 'grid'));
    items.push(B('snap', 'snap', 'Привязки', NOT_YET('Управление привязками'), { on: true, pressed: true }));
  }
  items.push(SB('fit', 'zoom', 'Показать все', props.fit, 'zoom', { commandId: 'view.fit' }));
  items.push(B('normal', 'normal', 'Нормально к...', props.normal));
  items.push(B('iso', 'orient', 'Изометрия', () => props.view('iso'), { commandId: 'view.iso' }));
  items.push(SB('orient', 'triad', 'Ориентация', () => props.view('iso'), 'views', { w46: true }));
  items.push(sep('s1'));
  items.push(B('shadedEdges', 'shaded', 'Полутоновое с каркасом', () => undefined, { on: true, pressed: true }));
  items.push(SB('display', 'ts_solid', 'Отображение модели', NOT_YET('Другие режимы отображения'), 'display'));
  items.push(SB('hide', 'hide', 'Скрыть', NOT_YET('Скрытие объектов'), 'hide'));
  items.push(SB('vis', 'eye', 'Видимость', NOT_YET('Управление видимостью'), 'vis'));
  items.push(sep('s2'));
  if (!props.sketch) {
    items.push(B('snaps', 'snap', 'Привязки', NOT_YET('Привязки')));
    items.push(B('gridOn', 'grid', 'Сетка', NOT_YET('Сетка')));
  }
  items.push(B('layers', 'layers', 'Слои', NOT_YET('Слои')));
  items.push(SB('section', 'sectionview', 'Сечение модели', NOT_YET('Сечение модели'), 'section'));
  items.push(sep('s3'));
  items.push(SB('filter', 'filter', 'Фильтр выбора', NOT_YET('Фильтр выбора'), 'filter', { on: true }));
  items.push(B('measure', 'measure', 'Расстояние и угол', () => kompasShell.run('part.measureDistanceAngle', 'Расстояние и угол')));
  items.push(B('pipette', 'pipette', 'Копировать свойства', NOT_YET('Копирование свойств')));
  if (props.commandActive) {
    items.push(sep('s4'));
    items.push(
      <button key="ok" type="button" className="k-qa-b k-qa-ok" data-qa="ok" data-tip="Создать объект" aria-label="Создать объект" onClick={props.commit}><KIcon name="check" size={18} /></button>,
      <button key="cancel" type="button" className="k-qa-b k-qa-cancel" data-qa="cancel" data-tip="Прервать команду" aria-label="Прервать команду" onClick={props.cancel}><KIcon name="cross" size={16} /></button>,
    );
  }
  return <div className="k-qa" role="toolbar" aria-label="Панель быстрого доступа">{items}</div>;
}
