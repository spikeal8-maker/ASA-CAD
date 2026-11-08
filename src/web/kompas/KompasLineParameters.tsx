import React from 'react';
import type { SketchLineField, SketchLineNumericInput } from '../SketchLineNumericInput';
import { focusCadEditor } from '../CadKeyboardHandler';
import { KIcon } from './KompasIcon';
import { KompasParameterFrame } from './KompasParameterFrame';

const FIELDS: readonly SketchLineField[] = ['x', 'y', 'length', 'angle'];

/** The left Parameters panel reads the Line owner's single transient state. */
export function KompasLineParameters(props: { input: SketchLineNumericInput; onCancel(): void }) {
  const { input } = props;
  const nodes = React.useRef<Partial<Record<SketchLineField, HTMLInputElement>>>({});
  React.useLayoutEffect(() => {
    if (!input.focusRevision) return;
    const node = nodes.current.length;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [input.focusRevision]);
  const enter = (field?: SketchLineField) => {
    focusCadEditor(nodes.current.length ?? null);
    void input.enter(field);
  };
  const cancel = () => {
    focusCadEditor(nodes.current.length ?? null);
    props.onCancel();
  };
  const labels: Record<SketchLineField, string> = {
    x: `т${input.anchored ? 2 : 1}: x`, y: `т${input.anchored ? 2 : 1}: y`,
    length: 'Длина', angle: 'Угол',
  };
  return (
    <KompasParameterFrame title="Отрезок" icon="line" data={{ 'data-testid': 'sketch-line-numeric' }}
      canCommit={input.canCommit} onCommit={() => enter()} onCancel={cancel} error={!!input.error}
      message={input.error ?? (input.anchored ? 'Укажите конечную точку отрезка'
        : 'Укажите первую точку либо задайте длину и угол')}>
      {FIELDS.map((field) => {
        const value = input.fields[field];
        const dimension = field === 'length' || field === 'angle';
        const label = labels[field];
        return (
          <div key={field} className={`k-pp-row${value.locked ? ' k-hl' : ''}`}
            data-line-lock={dimension ? field : undefined} data-locked={String(value.locked)}>
            <label className="k-pp-label" htmlFor={`sketch-line-${field}`}>{label}</label>
            <input ref={(node) => { if (node) nodes.current[field] = node; else delete nodes.current[field]; }}
              id={`sketch-line-${field}`} data-line-field={field}
              className={`k-pp-field${value.invalid ? ' k-invalid' : ''}`}
              type="text" inputMode="decimal" autoComplete="off" value={value.text}
              disabled={input.committing} aria-invalid={value.invalid}
              aria-label={dimension ? `${label}, ${field === 'length' ? 'мм' : '°'}` : label}
              onFocus={(event) => event.currentTarget.select()}
              onInput={(event) => {
                // Replacing a derived value with identical text is still explicit input.
                input.change(field, event.currentTarget.value);
              }}
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
            {dimension ? (
              <button type="button" className="k-pp-side" tabIndex={-1}
                disabled={!value.edited || input.committing} aria-pressed={value.locked}
                aria-label={field === 'length' ? 'Снять фиксацию длины' : 'Снять фиксацию угла'}
                onClick={() => input.unlock(field)}><KIcon name="fixed" size={15} /></button>
            ) : <span />}
          </div>
        );
      })}
      <p className="k-sk-hint">Число — длина, Tab — следующее поле, Enter — подтвердить. Угол отсчитывается от оси X.</p>
    </KompasParameterFrame>
  );
}
