import React from 'react';
import type { SketchCircleField, SketchCircleNumericInput } from '../SketchCircleNumericInput';
import { focusCadEditor } from '../CadKeyboardHandler';
import { KIcon } from './KompasIcon';
import { KompasParameterFrame } from './KompasParameterFrame';

/** Controlled fields read the Circle tool's single transient draft. */
export function KompasCircleParameters(props: { input: SketchCircleNumericInput; onCancel(): void }) {
  const { input } = props;
  const nodes = React.useRef<Partial<Record<SketchCircleField, HTMLInputElement>>>({});
  React.useLayoutEffect(() => {
    if (!input.focusRevision) return;
    const node = nodes.current.diameter;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [input.focusRevision]);
  // Unlike Arc (which stays open after commit), Circle closes the command:
  // move focus to the editor first, or the unmounted field strands it on <body>.
  const enter = (field?: SketchCircleField) => {
    focusCadEditor(nodes.current.x ?? null);
    void input.enter(field);
  };
  const cancel = () => {
    focusCadEditor(nodes.current.x ?? null);
    props.onCancel();
  };
  const pointLabel = input.phase === 'awaiting-center' ? 'Центр' : 'Точка';
  const prompt = input.phase === 'awaiting-center'
    ? 'Укажите центр окружности; Enter в диаметре без центра — окружность в начале координат с управляющим размером'
    : 'Укажите точку на окружности или введите диаметр';
  return (
    <KompasParameterFrame title="Окружность" icon="circle" canCommit={input.canCommit}
      onCommit={() => enter('diameter')} onCancel={cancel} error={!!input.error} message={input.error ?? prompt}
      data={{ 'data-testid': 'sketch-circle-numeric', 'data-diameter-locked': String(input.diameterLocked) }}>
      {(['x', 'y', 'diameter'] as const).map((field) => {
        const value = input.fields[field];
        const diameter = field === 'diameter';
        const label = diameter ? 'Диаметр' : `${pointLabel}: ${field}`;
        return (
          <div key={field} className={`k-pp-row${diameter && input.diameterLocked ? ' k-hl' : ''}`}>
            <label className="k-pp-label" htmlFor={`sketch-circle-${field}`}>{label}</label>
            <input ref={(node) => { if (node) nodes.current[field] = node; else delete nodes.current[field]; }}
              id={`sketch-circle-${field}`} data-circle-field={field} className={`k-pp-field${value.invalid ? ' k-invalid' : ''}`}
              type="text" inputMode="decimal" autoComplete="off" value={value.text}
              disabled={input.committing} aria-invalid={value.invalid} aria-label={diameter ? 'Диаметр, мм' : label}
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
            {diameter ? (
              <button type="button" className="k-pp-side" tabIndex={-1}
                disabled={!value.edited || input.committing} aria-pressed={input.diameterLocked}
                aria-label="Снять фиксацию диаметра" onClick={input.unlockDiameter}><KIcon name="fixed" size={15} /></button>
            ) : <span />}
          </div>
        );
      })}
      <p className="k-sk-hint">X/Y задают центр, затем точку окружности; Enter в X/Y выбирает точку. Диаметр — главный размер: первая цифра попадает в него, Tab — следующее поле, Enter — создать. Диаметр можно задать до первой точки — объект поедет за курсором.</p>
    </KompasParameterFrame>
  );
}
