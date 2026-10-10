import React from 'react';
import { createPortal } from 'react-dom';
import type { CadDocument } from '../../contracts/document';
import { documentNames } from '../CadDocumentPresentation';
import { useUiScaleSettingsOpen } from '../UiScaleSettings';
import { KIcon } from './KompasIcon';
import { kompasShell, useKompasShell } from './kompasShellStore';

const SETTINGS_TREE: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ['Система', [['general', 'Общие'], ['screen', 'Экран'], ['files', 'Файлы']]],
  ['Новые документы', [['newpart', 'Деталь'], ['newasm', 'Сборка'], ['newdrw', 'Чертеж']]],
  ['Текущая деталь', [['units', 'Единицы измерения']]],
];

/** KOMPAS windows of the shell: «Параметры», «Информация о документе», «О программе». */
export function KompasDialogs(props: { document: CadDocument }) {
  const shell = useKompasShell();
  if (!shell.dialog) return null;
  const close = () => kompasShell.set({ dialog: null });
  if (shell.dialog === 'settings') return <SettingsDialog onClose={close} />;
  if (shell.dialog === 'about') {
    return (
      <Dialog title="О программе" width={440} onClose={close}>
        <div className="k-set-pane">
          <h4>ASA-CAD — деталь</h4>
          <p>Оболочка по эталону #170: размеры зон — layout.json КОМПАС-3D v25, панели и меню сняты с КОМПАС-3D v23. Команды и их статусы — реестр ASA-CAD; построение — ядро OpenCascade и решатель PlaneGCS.</p>
          <p className="k-muted-note">Иконки нарисованы заново; логотипы и иконки КОМПАСа не используются.</p>
        </div>
      </Dialog>
    );
  }
  const part = props.document.kind === 'part' ? props.document : null;
  const rows: ReadonlyArray<readonly [string, string | number]> = [
    ['Тип документа', documentNames[props.document.kind]],
    ['Наименование', props.document.title],
    ['Единицы', 'мм'],
    ['Эскизов', part?.sketches.length ?? 0],
    ['Операций', part?.features.length ?? 0],
    ['Тел', part?.bodies.length ?? 0],
  ];
  return (
    <Dialog title="Информация о документе" width={420} onClose={close}>
      <div className="k-set-pane"><table className="k-var-table"><tbody>{rows.map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></table></div>
    </Dialog>
  );
}

function SettingsDialog(props: { onClose(): void }) {
  const shell = useKompasShell();
  const openUiScale = useUiScaleSettingsOpen();
  const [section, setSection] = React.useState('screen');
  const [theme, setTheme] = React.useState(shell.theme);
  const label = SETTINGS_TREE.flatMap(([, items]) => items).find(([key]) => key === section)?.[1] ?? '';
  return (
    <Dialog
      title="Параметры"
      width={640}
      onClose={props.onClose}
      actions={[
        { label: 'ОК', primary: true, run: () => { kompasShell.setTheme(theme); kompasShell.toast(`Тема: ${theme === 'dark' ? 'тёмная' : 'светлая'}`); props.onClose(); } },
        { label: 'Отмена', run: props.onClose },
      ]}
    >
      <div className="k-set-wrap">
        <div className="k-set-tree" role="tree" aria-label="Разделы параметров">
          {SETTINGS_TREE.map(([group, items]) => (
            <React.Fragment key={group}>
              <button type="button" className="k-grp" tabIndex={-1}>{group}</button>
              {items.map(([key, name]) => (
                <button key={key} type="button" className="k-sub" aria-selected={key === section} onClick={() => setSection(key)}>{name}</button>
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="k-set-pane">
          {section === 'screen' ? (
            <>
              <h4>Экран</h4>
              <fieldset>
                <legend>Тема интерфейса</legend>
                <label><input type="radio" name="k-theme" checked={theme === 'dark'} onChange={() => setTheme('dark')} /> Тёмная</label>
                <label><input type="radio" name="k-theme" checked={theme === 'light'} onChange={() => setTheme('light')} /> Светлая</label>
              </fieldset>
              <fieldset>
                <legend>Размер интерфейса</legend>
                <label>Сейчас: {document.documentElement.dataset.uiScale ?? '100'} % (эталон — 100 %, 1920×1080)</label>
                <button type="button" className="k-dlg-btn" onClick={() => { props.onClose(); openUiScale(); }}>Размер интерфейса…</button>
              </fieldset>
            </>
          ) : section === 'units' ? (
            <><h4>Единицы измерения</h4><label>Длина: миллиметры</label><label>Угол: градусы</label></>
          ) : (
            <><h4>{label}</h4><p className="k-muted-note">Раздел в ASA-CAD пока не заполнен.</p></>
          )}
        </div>
      </div>
    </Dialog>
  );
}

interface DialogAction { label: string; primary?: boolean; run(): void }

function Dialog(props: React.PropsWithChildren<{ title: string; width: number; onClose(): void; actions?: DialogAction[] }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const actions = props.actions ?? [{ label: 'ОК', primary: true, run: props.onClose }];

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.left = `${Math.max(8, (window.innerWidth - element.offsetWidth) / 2)}px`;
    element.style.top = `${Math.max(8, (window.innerHeight - element.offsetHeight) / 2.4)}px`;
    element.querySelector<HTMLElement>('.k-dlg-btn.k-primary')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || (event.target as Element).closest('button')) return;
    const box = element.getBoundingClientRect();
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      element.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, next.clientX - dx))}px`;
      element.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, next.clientY - dy))}px`;
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return createPortal(
    <>
      <div className="k-ui k-dlg-layer" />
      <div ref={ref} className="k-ui k-dlg" role="dialog" aria-modal="true" aria-label={props.title} style={{ width: Math.min(props.width, window.innerWidth - 16) }}>
        <div className="k-dlg-title" onPointerDown={drag}>
          <span>{props.title}</span>
          <button type="button" aria-label="Закрыть окно" onClick={props.onClose}><KIcon name="cross" size={12} /></button>
        </div>
        <div className="k-dlg-body">{props.children}</div>
        <div className="k-dlg-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className={`k-dlg-btn${action.primary ? ' k-primary' : ''}`} onClick={action.run}>{action.label}</button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
