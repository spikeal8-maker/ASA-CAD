import React, {useState} from 'react';
import type {CadUiAction} from '../../../src/web/CadUiAction';
import type {CadSketchSolveSnapshot} from '../../../src/application/SketchSolveSession';
import {run} from './liveActions';
import {requestSketchCompute, useSketchView} from './sketchView';
import type {SketchDisplayOption} from './sketchView';
import './sketchPalette.css';

export type {SketchDisplayOption} from './sketchView';
export interface SketchPaletteProps {
  settings: Readonly<Record<SketchDisplayOption, boolean>>;
  unavailable?: Readonly<Partial<Record<SketchDisplayOption, string>>>;
  onToggle(option: SketchDisplayOption): void;
  supportLabel: string;
  onLookAt(): void;
  parameters?: React.ReactNode;
  construction: CadUiAction|null;
  constructionChecked: boolean;
  finish: CadUiAction|null;
}

const options: ReadonlyArray<[SketchDisplayOption, string, string]> = [
  ['profiles', 'Профили', 'Показать профили'],
  ['points', 'Точки', 'Показать точки'],
  ['dimensions', 'Размеры', 'Показать размеры'],
  ['constraints', 'Ограничения', 'Показать ограничения'],
  ['projected', 'Проецированная геометрия', 'Показать проецированную геометрию'],
  ['construction', 'Вспомогательная геометрия', 'Показать вспомогательную геометрию'],
];
const sliceReason = 'Сечение модели плоскостью эскиза пока не поддерживается.';
const spatialReason = 'Пространственный эскиз пока не поддерживается: геометрия создаётся в плоскости выбранной опоры.';
const centerlineReason = 'Осевые линии пока не поддерживаются; выбранный отрезок можно сделать вспомогательным.';

function PaletteGlyph({kind}: {kind: 'compute'|'construction'|'centerline'|'look-at'|'find-under'|'auto-constraint'}) {
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {kind === 'compute' && <>
      <path d="M4 3v18M3 5h5M3 11h5M3 19h17M8 4v6m0 4v5M13 6v12" fill="none" stroke="#858585" strokeWidth="1.7"/>
      <rect x="15" y="3" width="6" height="16" rx="1" fill="#ededed" stroke="#858585"/>
      <circle cx="18" cy="7" r="1.7" fill="#c67371"/><circle cx="18" cy="13" r="1.7" fill="#7ba57b"/>
    </>}
    {kind === 'construction' && <>
      <path d="M3 12h18M15 2v21" fill="none" stroke="#8c8c8c" strokeWidth="1.2" strokeDasharray="3 2"/>
      <path d="m3 10 14-7M5 15l14 6" fill="none" stroke="#d54d4d" strokeWidth="1.4"/>
      <path d="m5 12 12 5M6 9l10-5" fill="none" stroke="#686868" strokeWidth="1.1" strokeDasharray="2 2"/>
    </>}
    {kind === 'centerline' && <>
      <path d="M6 5h12l3 7-3 7H6l-3-7Z" fill="none" stroke="#a5a5a5" strokeWidth="1.4"/>
      <path d="M1 12h22" stroke="#ce6c6c" strokeWidth="1.2" strokeDasharray="8 2 2 2"/>
    </>}
    {kind === 'look-at' && <>
      <path d="M4 10h17v11H4Z" fill="#dadada" stroke="#888" strokeWidth="1.5"/>
      <path d="M6 12h13v7H6Z" fill="#92c7df" stroke="#7b9baa"/>
      <path d="M11 2v7H6m0 0 5-7" fill="none" stroke="#818181" strokeWidth="1.5" strokeLinejoin="round"/>
    </>}
    {kind === 'find-under' && <>
      <path d="M4 4v16h15M4 12h10v8" fill="none" stroke="#84969d" strokeWidth="1.5"/>
      <path d="m15 8 6 6" stroke="#8b8b8b" strokeWidth="2"/><circle cx="13" cy="6" r="4" fill="#f5f5f5" stroke="#8b8b8b"/>
      <path d="M2 2h4v4H2ZM2 18h4v4H2Zm15 0h4v4h-4Z" fill="#9fcbd9" stroke="#83a4ae"/>
    </>}
    {kind === 'auto-constraint' && <>
      <path d="M4 4v16h15M8 6v10h11" fill="none" stroke="#8a979d" strokeWidth="1.5"/>
      <path d="m17 1-7 11h6l-2 10 9-14h-6l4-7Z" fill="#eab65b"/>
      <path d="M2 18h4v4H2Z" fill="#9fcbd9" stroke="#83a4ae"/>
    </>}
  </svg>;
}

function solverLabel(snapshot: Readonly<CadSketchSolveSnapshot>|null, entityCount: number): string {
  if (!snapshot) return 'Нет данных';
  if (snapshot.status === 'solving') return 'Вычисление…';
  if (snapshot.status === 'error') return 'Ошибка решения';
  switch (snapshot.constraintState) {
    case 'under-constrained': return 'Недоопределён';
    case 'fully-constrained': return 'Полностью определён';
    case 'over-constrained': return 'Переопределён';
  }
  if (snapshot.status === 'solved') return 'Решён';
  return entityCount === 0 ? 'Пустой эскиз' : 'Не рассчитан';
}

/** Native-observed layout; solver, geometry changes and finish remain product actions. */
export function SketchPalette(p: SketchPaletteProps) {
  const view = useSketchView();
  const [collapsed, setCollapsed] = useState(false);
  const [statusOpen, setStatusOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const solving = view.solve?.status === 'solving';
  const underConstrained = view.solve?.constraintState === 'under-constrained';
  const entityCount = view.active?.entityCount ?? 0;
  const computeEnabled = view.computeReady && !solving;
  const computeReason = solving ? 'Вычисление уже выполняется.' : entityCount === 0
    ? 'Пустой эскиз: вычислять нечего.' : !view.computeReady
      ? 'Завершите текущий ввод или перемещение, чтобы пересчитать эскиз.'
      : 'Пересчитать активный эскиз существующим решателем.';
  const diagnostic = view.solve?.diagnostics[0]?.message;
  const solveDetails = [view.solve?.degreesOfFreedom === null || view.solve?.degreesOfFreedom === undefined
    ? null : 'Степеней свободы: '+view.solve.degreesOfFreedom, diagnostic].filter(Boolean).join('. ');
  const collapseLabel = collapsed ? 'Развернуть палитру эскиза' : 'Свернуть палитру эскиза';

  function displayToggle(key: SketchDisplayOption, label: string, accessibleLabel: string) {
    const unavailable = p.unavailable?.[key];
    return <label key={key} className="sketch-palette-native-row sketch-palette-toggle" title={unavailable}>
      <span>{label}</span><input type="checkbox" aria-label={accessibleLabel} data-sketch-option={key}
        aria-describedby={unavailable ? 'sketch-option-reason-'+key : undefined}
        checked={p.settings[key]} disabled={!!unavailable} onChange={()=>p.onToggle(key)}/>
      {unavailable && <span className="sketch-palette-a11y" id={'sketch-option-reason-'+key}>{unavailable}</span>}
    </label>;
  }
  function unavailableToggle(key: string, label: string, reason: string) {
    return <label className="sketch-palette-native-row sketch-palette-toggle" title={reason}>
      <span>{label}</span><input type="checkbox" aria-label={label} data-sketch-unavailable={key}
        aria-describedby={'sketch-option-reason-'+key} checked={false} disabled readOnly/>
      <span className="sketch-palette-a11y" id={'sketch-option-reason-'+key}>{reason}</span>
    </label>;
  }

  return <aside className={'live-sketch-palette'+(collapsed?' is-collapsed':'')}
    aria-label="Палитра эскиза" data-testid="sketch-palette" data-collapsed={collapsed}>
    <header>
      <button type="button" aria-label={collapseLabel} aria-expanded={!collapsed}
        onClick={()=>setCollapsed(value=>!value)}>{collapsed?'+':'−'}</button>
      <strong>ПАЛИТРА ЭСКИЗА</strong>
      <button type="button" className="sketch-palette-dock" aria-label={collapsed?'Показать содержимое палитры':'Свернуть содержимое палитры'}
        title={collapseLabel} onClick={()=>setCollapsed(value=>!value)}><span aria-hidden="true">{collapsed?'‹‹':'››'}</span></button>
    </header>
    <div className="sketch-palette-content" hidden={collapsed}>
      <div className="sketch-palette-scroll">
        <section className="sketch-palette-status" data-open={statusOpen} data-under-constrained={underConstrained} aria-label="Состояние решения эскиза">
          <button type="button" className="sketch-palette-section-heading" aria-expanded={statusOpen}
            onClick={()=>setStatusOpen(value=>!value)} title={solveDetails || undefined}>
            <i aria-hidden="true"/><span data-testid="sketch-palette-solve-status"
              data-solve-status={view.solve?.status ?? 'unavailable'} data-constraint-state={view.solve?.constraintState ?? 'unknown'}>
              Статус: {solverLabel(view.solve, entityCount)}
            </span>
          </button>
          {statusOpen && <><div className="sketch-palette-native-row sketch-palette-compute" title={computeReason}>
            <span>Вычислить эскиз</span><button type="button" aria-label="Вычислить эскиз" data-palette-command="sketch.compute"
              disabled={!computeEnabled} onClick={()=>requestSketchCompute()}><PaletteGlyph kind="compute"/></button>
          </div>{underConstrained && <>
            <div className="sketch-palette-native-row sketch-palette-solver-extra" title="Поиск недоопределённых элементов пока не подключён; доступен общий статус решателя.">
              <span>Найти недоопределённые</span><button type="button" aria-label="Найти недоопределённые элементы" data-palette-unavailable="find-under-constrained" disabled><PaletteGlyph kind="find-under"/></button>
            </div>
            <div className="sketch-palette-native-row sketch-palette-solver-extra" title="Автоматическое добавление ограничений пока не поддерживается.">
              <span>Автоограничения</span><button type="button" aria-label="Автоограничения" data-palette-unavailable="auto-constraint" disabled><PaletteGlyph kind="auto-constraint"/></button>
            </div>
          </>}</>}
        </section>
        {p.parameters}
        <section className="sketch-palette-options" aria-label="Параметры отображения эскиза">
          <button type="button" className="sketch-palette-section-heading" aria-expanded={optionsOpen}
            onClick={()=>setOptionsOpen(value=>!value)}><i aria-hidden="true"/><span>Параметры</span></button>
          {optionsOpen && <div className="sketch-palette-option-rows">
            <div className="sketch-palette-native-row sketch-palette-linetype">
              <span>Тип линии</span>
              <div className="sketch-palette-line-buttons">
                <label title={p.construction?.enabled?'Переключить тип выбранного отрезка':'Выберите отрезок эскиза'}>
                  <input type="checkbox" aria-label="Вспомогательная геометрия" checked={p.constructionChecked}
                    disabled={!p.construction?.enabled} onChange={()=>run('sketch.construction')}/>
                  <PaletteGlyph kind="construction"/>
                </label>
                <button type="button" aria-label="Осевая линия" title={centerlineReason} disabled><PaletteGlyph kind="centerline"/></button>
              </div>
            </div>
            <div className="sketch-palette-native-row sketch-palette-look-at">
              <span>Вид на эскиз</span><button type="button" aria-label="Вид на эскиз" onClick={p.onLookAt}
                disabled={!view.navigationReady} title={'Показать эскиз по нормали к опоре '+p.supportLabel}><PaletteGlyph kind="look-at"/></button>
            </div>
            {displayToggle('grid', 'Сетка эскиза', 'Сетка эскиза')}
            {displayToggle('snap', 'Привязка', 'Привязка')}
            {unavailableToggle('slice', 'Сечение', sliceReason)}
            {options.map(([key, label, accessibleLabel])=>displayToggle(key, label, accessibleLabel))}
            {unavailableToggle('spatial', '3D-эскиз', spatialReason)}
          </div>}
        </section>
      </div>
      <footer><button type="button" data-palette-command="sketch.finish" disabled={!p.finish?.enabled}
        onClick={()=>run('sketch.finish')}>Завершить эскиз</button></footer>
    </div>
  </aside>;
}
