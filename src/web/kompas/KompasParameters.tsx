import React from 'react';
import type { ParameterPanelProps } from '../ParameterPanel';
import { KIcon } from './KompasIcon';
import { kompasShell } from './kompasShellStore';

const NOT_YET = (what: string) => () => kompasShell.toast(`${what} в ASA-CAD пока нет`);

/** Parameters panel of the KOMPAS shell for the running product command (KOMPAS markup of #170). */
export function KompasParameters(props: { panel: ParameterPanelProps | null; legacy: React.ReactNode }) {
  const p = props.panel;
  if (!p?.activeCommand) {
    return (
      <>
        <PanelHead />
        <div className="k-muted-note">Параметры появятся, когда вы запустите команду.</div>
      </>
    );
  }
  switch (p.activeCommand) {
    case 'part.extrude': return <ExtrudePanel p={p} />;
    case 'part.sketch.create': return <PlaceSketchPanel p={p} />;
    case 'sketch.rectangle': return (
      <SketchToolPanel p={p} title="Прямоугольник" icon="rectangle" onCommit={p.onCreateRectangle} hint="Ширина"
        rows={[['Ширина', p.rectangleWidth, p.setRectangleWidth], ['Высота', p.rectangleHeight, p.setRectangleHeight]]} />
    );
    case 'sketch.circle': return (
      <SketchToolPanel p={p} title="Окружность" icon="circle" onCommit={p.onCreateCircle} hint="Диаметр"
        rows={[['Диаметр', p.circleDiameter, p.setCircleDiameter]]} />
    );
    default: return (
      <div className="k-params-panel">
        <PanelHead />
        <div className="k-params-body k-legacy-params">{props.legacy}</div>
      </div>
    );
  }
}

function PanelHead() {
  return (
    <div className="k-panel-head">
      <span>Параметры</span>
      <button type="button" aria-label="Настройки панели" onClick={NOT_YET('Настроек панели')}><KIcon name="gear" size={14} /></button>
    </div>
  );
}

function Frame(props: React.PropsWithChildren<{
  title: string; icon: string; tabs?: readonly string[];
  canCommit: boolean; commitLabel?: string; onCommit(): void; onCancel(): void; message: string;
}>) {
  return (
    <div className="k-params-panel k-pp" data-command-title={props.title}>
      <PanelHead />
      <div className="k-pp-cmd">
        <strong>{props.title}</strong>
        <button type="button" aria-label="Справка" onClick={NOT_YET('Справки')}><KIcon name="helpq" size={16} /></button>
        <button type="button" aria-label="Показать дерево" onClick={() => kompasShell.requestPanel('tree')}><KIcon name="tree" size={16} /></button>
      </div>
      <div className="k-pp-tabs">
        <button type="button" className="k-tab" aria-selected="true" title={props.title}><KIcon name={props.icon} size={17} /></button>
        {(props.tabs ?? []).map((icon) => (
          <button key={icon} type="button" className="k-tab" aria-selected="false" title="Вкладка не заполнена" onClick={NOT_YET('Этой вкладки')}><KIcon name={icon} size={17} /></button>
        ))}
        <span className="k-spacer" />
        <button type="button" className="k-pp-ok" data-param-commit="" disabled={!props.canCommit} data-tip={`${props.commitLabel ?? 'Создать объект'} (Enter)`} aria-label={props.commitLabel ?? 'Создать объект'} onClick={props.onCommit}><KIcon name="check" size={20} /></button>
        <button type="button" className="k-pp-cancel" data-param-cancel="" data-tip="Прервать команду (Esc)" aria-label="Прервать команду" onClick={props.onCancel}><KIcon name="cross" size={18} /></button>
      </div>
      <div className="k-pp-body">{props.children}</div>
      <div className="k-pp-msg" role="status">
        <KIcon name="bubble" size={16} /><span>{props.message}</span>
        <button type="button" aria-label="Скрыть сообщение" onClick={NOT_YET('Скрытия сообщения')}><KIcon name="cross" size={11} /></button>
      </div>
    </div>
  );
}

/** Numeric KOMPAS field: comma or dot, Enter creates the object, invalid values stay visible. */
function NumberField(props: { label: string; value: number; onChange(value: number): void; onEnter(): void; disabled?: boolean; unit?: string }) {
  const [text, setText] = React.useState(String(props.value));
  const parsed = Number(text.trim().replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  React.useEffect(() => {
    if (Number(text.replace(',', '.')) !== props.value) setText(String(props.value));
  }, [props.value]);
  return (
    <input
      className={`k-pp-field${valid ? '' : ' k-invalid'}`}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={props.disabled}
      aria-label={`${props.label}, ${props.unit ?? 'мм'}`}
      aria-invalid={!valid}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value.trim().replace(',', '.'));
        if (event.target.value.trim() !== '' && Number.isFinite(next) && next > 0) props.onChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (valid) props.onEnter(); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
      }}
    />
  );
}

function Toggle(props: { on: boolean; label: string; onClick(): void }) {
  return (
    <button type="button" className="k-toggle" role="switch" aria-checked={props.on} aria-label={props.label} onClick={props.onClick}>
      <i className="k-knob" /><i className="k-ring" />
    </button>
  );
}

const RESULTS = [['res_union', 'Объединение'], ['res_sub', 'Вычитание'], ['res_int', 'Пересечение'], ['res_new', 'Новое тело']] as const;
const METHODS = [['m_dist', 'На расстояние'], ['m_through', 'Через все'], ['m_vertex', 'До вершины'], ['m_surface', 'До поверхности']] as const;

function ExtrudePanel({ p }: { p: ParameterPanelProps }) {
  const e = p.extrude;
  const [open, setOpen] = React.useState({ thin: true, scope: false, props: false });
  const canCommit = Boolean(e.profileId) && !e.validationError;
  const commit = () => { if (canCommit) void e.commit(); };
  return (
    <Frame title="Элемент выдавливания" icon="extrude" tabs={['doc', 'stamp', 'user']} canCommit={canCommit} onCommit={commit} onCancel={p.onCancel}
      message={e.validationError ?? (e.profileId ? 'Создайте операцию или отредактируйте параметры' : e.disabledReason ?? 'Выберите эскиз с замкнутым контуром')}>
      <div className="k-pp-row">
        <div className="k-pp-label">Результат:<small>Объединение</small></div>
        <div className="k-pp-iconset">
          {RESULTS.map(([icon, label], index) => (
            <button key={icon} type="button" aria-pressed={index === 0} title={label} aria-label={label}
              onClick={index === 0 ? undefined : NOT_YET(`Результата «${label}»`)}><KIcon name={icon} size={17} /></button>
          ))}
        </div><span />
      </div>
      <div className="k-pp-row k-pp-select">
        <div className="k-pp-label" style={{ alignSelf: 'start', paddingTop: 2 }}><span className="k-pp-link">Сечение</span></div>
        <div className="k-pp-list"><div>{e.profileName ?? '—'}</div></div>
        <div style={{ alignSelf: 'start', display: 'grid', gap: 4 }}>
          <button type="button" className="k-pp-side" aria-label="Контур" onClick={NOT_YET('Выбора отдельного контура')}><KIcon name="contour" size={16} /></button>
          <button type="button" className="k-pp-side" aria-label="Эскиз" onClick={NOT_YET('Выбора другого эскиза из панели')}><KIcon name="ts_sketch" size={16} /></button>
        </div>
      </div>
      <div className="k-pp-row">
        <div className="k-pp-label"><span className="k-pp-link">Направляющий объект</span></div>
        <div className="k-pp-fieldwrap"><span className="k-v">{e.profileName ? `Нормаль к ${e.profileName}` : ''}</span></div>
        <button type="button" className="k-pp-side" aria-label="Указать направление" onClick={NOT_YET('Направления по объекту')}><KIcon name="arrowUR" size={16} /></button>
      </div>
      <div className="k-pp-row">
        <div className="k-pp-label">Способ:<small>На расстояние</small></div>
        <div className="k-pp-iconset">
          {METHODS.map(([icon, label], index) => (
            <button key={icon} type="button" aria-pressed={index === 0} title={label} aria-label={label}
              onClick={index === 0 ? undefined : NOT_YET(`Способа «${label}»`)}><KIcon name={icon} size={17} /></button>
          ))}
        </div><span />
      </div>
      <div className="k-pp-row k-hl">
        <div className="k-pp-label"><span className="k-pp-lbl-drop">Расстояние <KIcon name="caret" size={9} /></span></div>
        <NumberField label="Расстояние" value={e.distance} onChange={e.setDistance} onEnter={commit} />
        <button type="button" className="k-pp-side" data-tip="Обратное направление" aria-label="Обратное направление" aria-pressed={e.reverse}
          disabled={e.symmetric} style={{ transform: e.reverse ? 'scaleX(-1)' : 'none' }} onClick={e.toggleReverse}><KIcon name="arrowR" size={16} /></button>
      </div>
      <div className="k-pp-row">
        <div className="k-pp-label"><span className="k-pp-lbl-drop">Угол <KIcon name="caret" size={9} /></span></div>
        <div className="k-pp-fieldwrap"><span className="k-v">0</span></div>
        <button type="button" className="k-pp-side" aria-label="Направление уклона" onClick={NOT_YET('Уклона')}><KIcon name="arrowR" size={16} /></button>
      </div>
      <div className="k-pp-row"><div className="k-pp-label">Симметрично:</div><div><Toggle on={e.symmetric} label="Симметрично" onClick={() => e.setSymmetric(!e.symmetric)} /></div><span /></div>
      <div className="k-pp-row"><div className="k-pp-label">Второе направление:</div><div><Toggle on={false} label="Второе направление" onClick={NOT_YET('Второго направления')} /></div><span /></div>
      <Section title="Тонкостенный элемент" open={open.thin} onToggle={() => setOpen({ ...open, thin: !open.thin })}>
        <div className="k-pp-row"><div className="k-pp-label">Тонкостенный элемент:</div><div><Toggle on={false} label="Тонкостенный элемент" onClick={NOT_YET('Тонкостенного элемента')} /></div><span /></div>
      </Section>
      <Section title="Область применения" open={open.scope} onToggle={() => setOpen({ ...open, scope: !open.scope })}>
        <div className="k-muted-note">Все тела детали.</div>
      </Section>
      <Section title="Свойства" open={open.props} onToggle={() => setOpen({ ...open, props: !open.props })}>
        <div className="k-pp-row"><div className="k-pp-label">Наименование:</div><div className="k-pp-fieldwrap"><span className="k-v">Элемент выдавливания</span></div><span /></div>
      </Section>
    </Frame>
  );
}

function Section(props: React.PropsWithChildren<{ title: string; open: boolean; onToggle(): void }>) {
  return (
    <div className="k-pp-section">
      <button type="button" aria-expanded={props.open} onClick={props.onToggle}><KIcon name="caret" size={10} />{props.title}</button>
      {props.open && <div className="k-inner">{props.children}</div>}
    </div>
  );
}

function PlaceSketchPanel({ p }: { p: ParameterPanelProps }) {
  const face = p.requiresFaceSelection;
  const picked = face && p.selectedPick?.kind === 'face';
  const value = face ? (picked ? 'Грань тела' : '') : `Плоскость ${p.sketchPlane}`;
  return (
    <Frame title="Создать эскиз" icon="ts_sketch" canCommit={!face || picked} onCommit={p.onCreateSketch} onCancel={p.onCancel}
      message="Укажите плоскость или плоскую грань для размещения эскиза">
      <div className="k-pp-row k-pp-select">
        <div className="k-pp-label"><span className="k-pp-link">Опорный объект</span></div>
        <div className="k-pp-fieldwrap"><span className={`k-v${value ? '' : ' k-ph'}`}>{value || 'Укажите объект'}</span></div><span />
      </div>
      {!face && (
        <div className="k-pp-row">
          <div className="k-pp-label">Плоскость:</div>
          <div className="k-pp-iconset">
            {(['XY', 'XZ', 'YZ'] as const).map((plane) => (
              <button key={plane} type="button" aria-pressed={p.sketchPlane === plane} title={`Плоскость ${plane}`} aria-label={`Плоскость ${plane}`} onClick={() => p.setSketchPlane(plane)}>
                <KIcon name="planeTree" size={17} className={plane === 'XY' ? 'k-ic-xy' : plane === 'XZ' ? 'k-ic-zx' : 'k-ic-zy'} />
              </button>
            ))}
          </div><span />
        </div>
      )}
    </Frame>
  );
}

function SketchToolPanel(props: {
  p: ParameterPanelProps; title: string; icon: string; onCommit(): void; hint: string;
  rows: ReadonlyArray<readonly [string, number, (value: number) => void]>;
}) {
  return (
    <Frame title={props.title} icon={props.icon} canCommit onCommit={props.onCommit} onCancel={props.p.onCancel}
      message={`Задайте размеры и нажмите Enter или «Создать объект», либо укажите точки в окне`}>
      {props.rows.map(([label, value, set]) => (
        <div key={label} className="k-pp-row k-hl" data-param-row={label}>
          <label className="k-pp-label">{label}</label>
          <NumberField label={label} value={value} onChange={set} onEnter={props.onCommit} /><span />
        </div>
      ))}
      <p className="k-sk-hint">Значения вводятся в панели: «{props.hint}» — главный размер, Tab — следующее поле, Enter — создать объект.</p>
    </Frame>
  );
}
