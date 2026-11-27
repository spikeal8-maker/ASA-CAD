import React, { useLayoutEffect, useRef } from 'react';
import type { SketchCircleNumericInput } from '../SketchCircleNumericInput';
import { focusCadEditor } from '../CadKeyboardHandler';

/** Presentation of the existing shared Circle draft; no local geometry state. */
export function useFusionCirclePresentation(input: SketchCircleNumericInput, onCancel: () => void,
  frame: React.RefObject<HTMLElement>) {
  const field = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  useLayoutEffect(() => {
    if (!input.focusRevision || !field.current) return;
    field.current.focus();
    field.current.setSelectionRange(field.current.value.length, field.current.value.length);
  }, [input.focusRevision]);
  const submit = async () => {
    if (!input.canCommit || input.committing || pending.current) return;
    pending.current = true;
    try {
      focusCadEditor(field.current ?? frame.current);
      await input.enter('diameter');
    } finally { pending.current = false; }
  };
  const cancel = () => {
    focusCadEditor(field.current ?? frame.current);
    onCancel();
  };
  return {
    content: <FusionCircleParameters input={input} field={field} onEnter={submit} />,
    submit, cancel, valid: input.canCommit && !input.committing,
  };
}

function FusionCircleParameters({ input, field, onEnter }: {
  input: SketchCircleNumericInput;
  field: React.RefObject<HTMLInputElement>;
  onEnter(): Promise<void>;
}) {
  const value = input.fields.diameter;
  return <>
    <label className="live-param-row">
      <span>Диаметр</span><div>
        <input ref={field} type="text" inputMode="decimal" autoComplete="off"
          aria-label="Диаметр" aria-invalid={value.invalid} value={value.text}
          disabled={input.committing} data-circle-field="diameter"
          onFocus={event => event.currentTarget.select()}
          onInput={event => input.change('diameter', event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            // The parent frame must not submit an IME confirmation a second time.
            event.stopPropagation();
            if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault();
            void onEnter();
          }} />
        <small>мм</small>
      </div>
    </label>
    {input.error ? <p role="alert" className="live-param-error">{input.error}</p>
      : <p className="live-param-note">{input.phase === 'awaiting-center'
        ? 'Укажите центр окружности на эскизе.'
        : 'Задайте диаметр или укажите точку на окружности.'}</p>}
  </>;
}
