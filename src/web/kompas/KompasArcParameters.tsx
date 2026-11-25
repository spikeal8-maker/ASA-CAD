import React from 'react';
import type { SketchArcField, SketchArcNumericInput } from '../SketchArcNumericInput';
import { focusCadEditor } from '../CadKeyboardHandler';
import { KIcon } from './KompasIcon';
import { KompasParameterFrame } from './KompasParameterFrame';

/** Controlled fields read the Arc tool's single transient draft. */
export function KompasArcParameters(props: { input: SketchArcNumericInput; onCancel(): void }) {
  const { input } = props;
  const nodes = React.useRef<Partial<Record<SketchArcField, HTMLInputElement>>>({});
  React.useLayoutEffect(() => {
    if (!input.focusRevision) return;
    const node = nodes.current.radius;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [input.focusRevision]);
  const enter = (field?: SketchArcField) => {
    if (field !== 'radius') focusCadEditor(nodes.current.x ?? null);
    void input.enter(field);
  };
  const cancel = () => {
    focusCadEditor(nodes.current.x ?? null);
    props.onCancel();
  };
  const pointLabel = input.phase === 'awaiting-center' ? 'Центр' : input.phase === 'awaiting-start' ? 'Начало' : 'Конец';
  const fields: readonly SketchArcField[] = input.phase === 'awaiting-start' ? ['x', 'y', 'radius'] : ['x', 'y'];
  const prompt = input.phase === 'awaiting-center' ? 'Укажите центр дуги' : input.phase === 'awaiting-start'
    ? 'Укажите начальную точку дуги; Enter в радиусе не выбирает точку' : 'Укажите конечную точку дуги';
  return (
    <KompasParameterFrame title="Дуга" icon="arc" canCommit={input.canCommit}
      onCommit={() => enter()} onCancel={cancel} error={!!input.error} message={input.error ?? prompt}
      data={{ 'data-testid': 'sketch-arc-numeric', 'data-radius-locked': String(input.radiusLocked) }}>
      {fields.map((field) => {
        const value = input.fields[field];
        const radius = field === 'radius';
        const label = radius ? 'Радиус' : `${pointLabel}: ${field}`;
        return (
          <div key={field} className={`k-pp-row${radius && input.radiusLocked ? ' k-hl' : ''}`}>
            <label className="k-pp-label" htmlFor={`sketch-arc-${field}`}>{label}</label>
            <input ref={(node) => { if (node) nodes.current[field] = node; else delete nodes.current[field]; }}
              id={`sketch-arc-${field}`} data-arc-field={field} className={`k-pp-field${value.invalid ? ' k-invalid' : ''}`}
              type="text" inputMode="decimal" autoComplete="off" value={value.text}
              disabled={input.committing} aria-invalid={value.invalid} aria-label={radius ? 'Радиус, мм' : label}
              onFocus={(event) => event.currentTarget.select()}
              onInput={(event) => input.change(field, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                  event.stopPropagation();
                  return;
                }
                if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                  event.preventDefault();
                  event.stopPropagation();
                  enter(field);
                }
              }} />
            {radius ? (
              <button type="button" className="k-pp-side" tabIndex={-1}
                disabled={!value.edited || input.committing} aria-pressed={input.radiusLocked}
                aria-label="Снять фиксацию радиуса" onClick={input.unlockRadius}><KIcon name="fixed" size={15} /></button>
            ) : <span />}
          </div>
        );
      })}
      {input.phase === 'awaiting-end' && (
        <div className="k-pp-row">
          <label className="k-pp-label" htmlFor="sketch-arc-sweep">Угол дуги</label>
          <input id="sketch-arc-sweep" data-arc-field="sweep" className="k-pp-field" aria-label="Угол дуги, °"
            type="text" readOnly tabIndex={-1} value={input.sweepText} /><span />
        </div>
      )}
      <p className="k-sk-hint">X/Y задают точку указателя; при заданном радиусе — направление. Предпросмотр проецируется на окружность. Enter в X/Y выбирает точку; число после центра — радиус.</p>
    </KompasParameterFrame>
  );
}
