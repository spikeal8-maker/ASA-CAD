import React, {useState} from 'react';
import type {CadUiAction} from '../../../src/web/CadUiAction';
import {LiveIcon} from './LiveIcon';
import {run} from './liveActions';

export type SketchDisplayOption = 'grid'|'snap'|'points'|'profiles'|'dimensions'|'constraints';
export interface SketchPaletteProps {
  settings: Record<SketchDisplayOption, boolean>;
  unavailable?: Partial<Record<SketchDisplayOption, string>>;
  onToggle(option: SketchDisplayOption): void;
  supportLabel: string;
  onLookAt(): void;
  parameters?: React.ReactNode;
  construction: CadUiAction|null;
  constructionChecked: boolean;
  finish: CadUiAction|null;
}

const options: ReadonlyArray<[SketchDisplayOption,string]> = [
  ['grid','Сетка эскиза'],
  ['snap','Привязка'],
  ['profiles','Показать профили'],
  ['points','Показать точки'],
  ['dimensions','Показать размеры'],
  ['constraints','Показать ограничения'],
];

/** View preferences never mutate the document; construction delegates to its product action. */
export function SketchPalette(p: SketchPaletteProps) {
  const [collapsed,setCollapsed]=useState(false);
  return <aside className={'live-sketch-palette'+(collapsed?' is-collapsed':'')}
    aria-label="Палитра эскиза" data-testid="sketch-palette" data-collapsed={collapsed}>
    <header>
      <button type="button" aria-label={collapsed?'Развернуть палитру эскиза':'Свернуть палитру эскиза'}
        aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'▸':'▾'}</button>
      <strong>ПАЛИТРА ЭСКИЗА</strong>
      <span title={'Опора: '+p.supportLabel}>{p.supportLabel}</span>
    </header>
    <div className="sketch-palette-content" hidden={collapsed}>
      <div className="sketch-palette-scroll">
        {p.parameters}
        <div className="sketch-palette-options">
          <div className="sketch-palette-view">
            <span>Вид</span><button type="button" onClick={p.onLookAt} aria-label="Вид на эскиз"
              title="Показать эскиз по нормали к его плоскости"><LiveIcon id="SketchCreate" size={19}/><span>На эскиз</span></button>
          </div>
          <label className="sketch-palette-toggle" title={p.construction?.enabled?'Переключить тип выбранного отрезка':'Выберите отрезок эскиза'}>
            <span>Вспомогательная геометрия</span>
            <input type="checkbox" aria-label="Вспомогательная геометрия" checked={p.constructionChecked}
              disabled={!p.construction?.enabled} onChange={()=>run('sketch.construction')}/>
          </label>
          <hr/>
          {options.map(([key,label])=><label key={key} className="sketch-palette-toggle" title={p.unavailable?.[key]}>
            <span>{label}</span><input type="checkbox" aria-label={label} data-sketch-option={key}
              checked={p.settings[key]} disabled={!!p.unavailable?.[key]} onChange={()=>p.onToggle(key)}/>
          </label>)}
        </div>
      </div>
      <footer><button type="button" data-palette-command="sketch.finish" disabled={!p.finish?.enabled}
        onClick={()=>run('sketch.finish')}><LiveIcon id="sketch.finish" size={22}/><span>Завершить эскиз</span></button></footer>
    </div>
  </aside>;
}
