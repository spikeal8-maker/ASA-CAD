import React from 'react';
import type { ParameterPanelProps } from '../ParameterPanel';
import { KIcon } from './KompasIcon';
import { KompasParameterFrame as Frame, KompasParameterHead as PanelHead, parameterNotYet as NOT_YET } from './KompasParameterFrame';
import { KompasLineParameters } from './KompasLineParameters';
import { KompasArcParameters } from './KompasArcParameters';
import { NumberField, SketchToolPanel } from './KompasSketchToolPanel';

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
    case 'sketch.line': return <KompasLineParameters input={p.lineInput} onCancel={p.onCancel} />;
    case 'sketch.arc': return <KompasArcParameters input={p.arcInput} onCancel={p.onCancel} />;
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
      data={{ 'data-extrude-profile-id': e.profileId ?? '' }} error={Boolean(e.validationError)}
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
        <div className="k-pp-fieldwrap"><span className="k-v">{e.profileName ? 'Нормаль к плоскости эскиза' : ''}</span></div>
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
        <div className="k-pp-label"><span className="k-pp-lbl-drop">Расстояние <KIcon name="caret" size={9} /></span><small>{e.reverse ? 'Обратное' : 'Прямое'}</small></div>
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
  const value = face ? (picked ? 'Грань выбрана' : '') : `Плоскость ${p.sketchPlane}`;
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
